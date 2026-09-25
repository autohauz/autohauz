import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getBusinessProfile } from "@/lib/data/business";
import { getInvoiceableVehicles } from "@/lib/data/invoices";
import { InvoiceForm } from "../invoice-form";
import { requirePermission } from "@/lib/security/auth";

export const metadata = { title: "Create Invoice" };
export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  await requirePermission("invoices.write");
  const [profile, vehicles] = await Promise.all([getBusinessProfile(), getInvoiceableVehicles()]);
  const { gstEnabled, gstRate, pricesIncludeGst, paymentTerms, footerNote } = profile.invoice;
  
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link 
          href="/admin/invoices" 
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Invoices
        </Link>
        <h1 className="font-heading text-2xl font-bold text-foreground">Create Draft Invoice</h1>
      </header>
      <InvoiceForm
        invoiceSettings={{ gstEnabled, gstRate, pricesIncludeGst, paymentTerms, footerNote }}
        vehicles={vehicles}
      />
    </div>
  );
}
