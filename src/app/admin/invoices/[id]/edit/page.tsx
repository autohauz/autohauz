import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getBusinessProfile } from "@/lib/data/business";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { InvoiceForm } from "../../invoice-form";

export const metadata = { title: "Edit Invoice" };
export const dynamic = "force-dynamic";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getInvoiceDetail(id);
  
  if (!detail) {
    notFound();
  }
  
  if (detail.invoice.status !== "draft") {
    // Only drafts can be edited
    redirect(`/admin/invoices/${id}`);
  }

  const profile = await getBusinessProfile();
  
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link 
          href={`/admin/invoices/${id}`} 
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Invoice
        </Link>
        <h1 className="font-heading text-2xl font-bold text-foreground">Edit Draft Invoice</h1>
      </header>
      <InvoiceForm 
        initialData={{ invoice: detail.invoice, items: detail.items }}
        invoiceSettings={profile.invoice} 
      />
    </div>
  );
}
