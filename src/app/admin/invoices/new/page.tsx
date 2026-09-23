import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getBusinessProfile } from "@/lib/data/business";
import { InvoiceForm } from "../invoice-form";

export const metadata = { title: "Create Invoice" };
export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const profile = await getBusinessProfile();
  
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
      <InvoiceForm invoiceSettings={profile.invoice} />
    </div>
  );
}
