-- 0022_invoices.sql
-- Down notes:
-- DROP TABLE invoice_events;
-- DROP TABLE invoice_payments;
-- DROP TABLE invoice_items;
-- DROP TABLE invoices;
-- DROP TABLE invoice_number_sequences;
-- DROP TYPE invoice_status;

BEGIN;

CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'partially_paid', 'paid', 'void');

-- Number sequence table
CREATE TABLE invoice_number_sequences (
    year int PRIMARY KEY,
    last_value int NOT NULL DEFAULT 0
);

-- Invoices
CREATE TABLE invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number text UNIQUE, -- Null for drafts, populated on issue
    status invoice_status NOT NULL DEFAULT 'draft',
    
    lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
    vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
    
    -- Billing party snapshot (frozen on issue)
    billing_name text NOT NULL,
    billing_email text,
    billing_phone text,
    billing_address text,
    billing_abn text,
    
    -- Config snapshot (frozen on issue)
    gst_enabled boolean NOT NULL DEFAULT true,
    gst_rate numeric(5,2) NOT NULL DEFAULT 10.00,
    prices_include_gst boolean NOT NULL DEFAULT true,
    
    -- Amounts (in cents)
    subtotal_cents bigint NOT NULL DEFAULT 0,
    line_discounts_cents bigint NOT NULL DEFAULT 0,
    invoice_discount_cents bigint NOT NULL DEFAULT 0,
    net_ex_gst_cents bigint NOT NULL DEFAULT 0,
    gst_cents bigint NOT NULL DEFAULT 0,
    total_inc_gst_cents bigint NOT NULL DEFAULT 0,
    payments_cents bigint NOT NULL DEFAULT 0,
    
    due_date date,
    issued_at timestamptz,
    paid_at timestamptz,
    voided_at timestamptz,
    
    notes text,
    payment_terms text,
    footer_note text,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issued_at ON invoices(issued_at);
CREATE INDEX idx_invoices_lead_id ON invoices(lead_id);
CREATE INDEX idx_invoices_vehicle_id ON invoices(vehicle_id);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);

-- Invoice items
CREATE TABLE invoice_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    description text NOT NULL,
    quantity int NOT NULL DEFAULT 1,
    unit_price_cents bigint NOT NULL DEFAULT 0,
    discount_cents bigint NOT NULL DEFAULT 0,
    
    sort_order int NOT NULL DEFAULT 0,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Invoice payments
CREATE TABLE invoice_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    amount_cents bigint NOT NULL,
    payment_date date NOT NULL,
    payment_method text NOT NULL,
    reference_number text,
    notes text,
    
    recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);

-- Invoice events (audit trail)
CREATE TABLE invoice_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    
    event text NOT NULL, -- e.g., 'created', 'issued', 'payment_recorded', 'voided', 'emailed'
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_events_invoice_id ON invoice_events(invoice_id);

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_invoices
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_invoice_items
    BEFORE UPDATE ON invoice_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate next invoice number safely
CREATE OR REPLACE FUNCTION next_invoice_number(p_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_year int := extract(year from now());
    v_seq int;
BEGIN
    INSERT INTO invoice_number_sequences (year, last_value)
    VALUES (v_year, 1)
    ON CONFLICT (year) DO UPDATE
    SET last_value = invoice_number_sequences.last_value + 1
    RETURNING last_value INTO v_seq;
    
    RETURN p_prefix || '-' || v_year::text || '-' || lpad(v_seq::text, 6, '0');
END;
$$;

-- Trigger to enforce state transitions
CREATE OR REPLACE FUNCTION enforce_invoice_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Allow normal updates if status didn't change
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Enforce valid transitions
    IF OLD.status = 'draft' AND NEW.status NOT IN ('issued', 'void') THEN
        RAISE EXCEPTION 'Invalid transition from draft to %', NEW.status;
    END IF;
    
    IF OLD.status = 'issued' AND NEW.status NOT IN ('partially_paid', 'paid', 'void') THEN
        RAISE EXCEPTION 'Invalid transition from issued to %', NEW.status;
    END IF;
    
    IF OLD.status = 'partially_paid' AND NEW.status NOT IN ('paid', 'void') THEN
        RAISE EXCEPTION 'Invalid transition from partially_paid to %', NEW.status;
    END IF;
    
    IF OLD.status IN ('paid', 'void') THEN
        RAISE EXCEPTION 'Cannot transition from final state %', OLD.status;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER check_invoice_status_transition
    BEFORE UPDATE OF status ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION enforce_invoice_status_transition();

-- Trigger to auto-update invoice status on payment insert
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_paid bigint;
    v_total_inc_gst bigint;
BEGIN
    -- Calculate total payments
    SELECT COALESCE(SUM(amount_cents), 0) INTO v_total_paid
    FROM invoice_payments
    WHERE invoice_id = NEW.invoice_id;
    
    -- Get total amount
    SELECT total_inc_gst_cents INTO v_total_inc_gst
    FROM invoices
    WHERE id = NEW.invoice_id;
    
    -- Update invoice
    UPDATE invoices
    SET payments_cents = v_total_paid,
        status = CASE 
            WHEN v_total_paid >= v_total_inc_gst THEN 'paid'::invoice_status
            ELSE 'partially_paid'::invoice_status
        END,
        paid_at = CASE 
            WHEN v_total_paid >= v_total_inc_gst THEN now()
            ELSE paid_at
        END
    WHERE id = NEW.invoice_id;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER after_payment_insert
    AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_payment_status();

-- Row Level Security (RLS)
ALTER TABLE invoice_number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_events ENABLE ROW LEVEL SECURITY;

-- Staff can do everything to invoices
CREATE POLICY "Staff can select all invoices" ON invoices FOR SELECT TO authenticated USING (app_private.is_staff());
CREATE POLICY "Staff can insert invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (app_private.is_staff());
CREATE POLICY "Staff can update invoices" ON invoices FOR UPDATE TO authenticated USING (app_private.is_staff());

CREATE POLICY "Staff can select invoice items" ON invoice_items FOR SELECT TO authenticated USING (app_private.is_staff());
CREATE POLICY "Staff can insert invoice items" ON invoice_items FOR INSERT TO authenticated WITH CHECK (app_private.is_staff());
CREATE POLICY "Staff can update invoice items" ON invoice_items FOR UPDATE TO authenticated USING (app_private.is_staff());
CREATE POLICY "Staff can delete invoice items" ON invoice_items FOR DELETE TO authenticated USING (app_private.is_staff());

CREATE POLICY "Staff can select invoice payments" ON invoice_payments FOR SELECT TO authenticated USING (app_private.is_staff());
CREATE POLICY "Staff can insert invoice payments" ON invoice_payments FOR INSERT TO authenticated WITH CHECK (app_private.is_staff());

CREATE POLICY "Staff can select invoice events" ON invoice_events FOR SELECT TO authenticated USING (app_private.is_staff());
CREATE POLICY "Staff can insert invoice events" ON invoice_events FOR INSERT TO authenticated WITH CHECK (app_private.is_staff());

COMMIT;
