/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();
  
  async function insertInvoice(type: string, gstEnabled: boolean, items: any[], payments = 0) {
    const subtotal = items.reduce((sum, item) => sum + (item.unitPriceCents * item.quantity), 0);
    const gstRate = 10;
    const rateMultiplier = 0.10;
    
    let netExGst = subtotal;
    let gst = 0;
    const totalIncGst = subtotal;
    
    if (gstEnabled) {
      const exGst = totalIncGst / (1 + rateMultiplier);
      gst = Math.round(totalIncGst - exGst);
      netExGst = totalIncGst - gst;
    }
    
    const { data: numberData } = await supabase.rpc("next_invoice_number", { p_prefix: "AH" });

    const { data: inv, error } = await supabase.from("invoices").insert({
      status: payments > 0 ? (payments >= totalIncGst ? "paid" : "partially_paid") : "issued",
      invoice_number: numberData || ("AH-TEST-" + Math.floor(Math.random()*1000)),
      billing_name: "Test Customer - " + type,
      billing_email: "test@example.com",
      gst_enabled: gstEnabled,
      gst_rate: gstRate,
      prices_include_gst: true,
      subtotal_cents: subtotal,
      line_discounts_cents: 0,
      invoice_discount_cents: 0,
      net_ex_gst_cents: netExGst,
      gst_cents: gst,
      total_inc_gst_cents: totalIncGst,
      payments_cents: payments,
      due_date: new Date().toISOString().split("T")[0],
      issued_at: new Date().toISOString(),
    }).select("id").single();
    
    if (error) throw error;
    
    const itemsData = items.map((item, idx) => ({
      invoice_id: inv.id,
      description: item.description,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      discount_cents: 0,
      sort_order: idx,
    }));
    await supabase.from("invoice_items").insert(itemsData);
    
    if (payments > 0) {
      await supabase.from("invoice_payments").insert({
        invoice_id: inv.id,
        amount_cents: payments,
        payment_date: new Date().toISOString(),
        payment_method: "bank_transfer",
      });
    }
    
    return `/admin/invoices/${inv.id}`;
  }

  try {
    const urls = [];
    urls.push(await insertInvoice("A. One-Item", true, [{ description: "Vehicle Purchase Deposit", quantity: 1, unitPriceCents: 50000 }]));
    urls.push(await insertInvoice("B. 5-Item", true, Array.from({length: 5}).map((_, i) => ({ description: `Part ${i+1}`, quantity: 2, unitPriceCents: 15000 }))));
    urls.push(await insertInvoice("C. 20-Item", true, Array.from({length: 22}).map((_, i) => ({ description: `Service Item ${i+1}`, quantity: 1, unitPriceCents: 8500 }))));
    urls.push(await insertInvoice("D. Long Description", true, [{ description: "Comprehensive structural repair and repainting of the rear bumper following the incident on the 14th of September, including all materials, labor, and clear coat application to match factory finish.", quantity: 1, unitPriceCents: 120000 }]));
    urls.push(await insertInvoice("F. GST-Free", false, [{ description: "Export Vehicle Sale (GST Free)", quantity: 1, unitPriceCents: 4500000 }]));
    urls.push(await insertInvoice("G. Partial Payment", true, [{ description: "Used Car Sale", quantity: 1, unitPriceCents: 2500000 }], 500000));
    urls.push(await insertInvoice("H. Paid", true, [{ description: "Used Car Sale", quantity: 1, unitPriceCents: 2500000 }], 2500000));
    
    return NextResponse.json({ success: true, urls });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
