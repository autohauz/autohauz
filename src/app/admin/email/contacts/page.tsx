import { getEmailContacts } from "@/lib/data/email-contacts";
import { requireAdminRole } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { format } from "date-fns";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Email Contacts | AutoHauz Admin",
};

export default async function EmailContactsPage() {
  await requireAdminRole(["admin", "owner", "content", "sales"]);
  const { data: contacts, count } = await getEmailContacts({ limit: 100 });

  return (
    <Container>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-foreground">Email Contacts</h1>
          <p className="text-muted-foreground mt-1">Manage newsletter subscribers and leads. Total: {count}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Subscribed Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No contacts found.
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {contact.email}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {contact.subscriptionStatus === "subscribed" && <CheckCircle2 className="size-4 text-success" />}
                        {contact.subscriptionStatus === "unsubscribed" && <XCircle className="size-4 text-muted-foreground" />}
                        {contact.subscriptionStatus === "bounced" && <AlertTriangle className="size-4 text-danger" />}
                        <span className="capitalize font-medium text-foreground">
                          {contact.subscriptionStatus}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {contact.source || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(contact.createdAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Container>
  );
}
