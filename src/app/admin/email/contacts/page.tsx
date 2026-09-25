import { format } from "date-fns";
import { getEmailContacts } from "@/lib/data/email-contacts";
import { requirePermission } from "@/lib/security/auth";
import { roleCan } from "@/lib/security/permissions";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { AddContactForm, UnsubscribeContactButton } from "@/components/admin/email-audience-forms";
import type { EmailContact } from "@/lib/domain";

export const metadata = { title: "Email contacts" };

const STATUS: Record<EmailContact["subscriptionStatus"], { label: string; variant: "success" | "neutral" | "warning" | "danger" | "info" }> = {
  subscribed: { label: "Subscribed", variant: "success" },
  pending: { label: "Awaiting confirmation", variant: "info" },
  unsubscribed: { label: "Unsubscribed", variant: "neutral" },
  bounced: { label: "Bounced", variant: "danger" },
  complained: { label: "Complained", variant: "danger" },
};

const SOURCE_LABEL: Record<string, string> = { manual: "Added by staff", footer: "Website" };

export default async function EmailContactsPage() {
  const user = await requirePermission("email.view");
  const canWrite = roleCan(user.staffRole, "email.write");
  const { data: contacts, count } = await getEmailContacts({ limit: 200 });

  return (
    <Container>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-extrabold text-foreground">Email contacts</h1>
        <p className="mt-1 text-muted-foreground">
          {count} contact{count === 1 ? "" : "s"}. Website sign-ups become subscribers only after they confirm by email.
        </p>
      </div>

      {canWrite ? (
        <div className="mb-8">
          <AddContactForm />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Email contacts (newest first, up to 200)</caption>
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Email</th>
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Source</th>
                <th scope="col" className="px-4 py-3 font-medium">Consent</th>
                {canWrite ? (
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 6 : 5} className="px-4 py-10 text-center text-muted-foreground">
                    No contacts yet. Sign-ups from the website newsletter form appear here.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {c.email}
                      {c.tags.length ? <div className="mt-1 text-xs font-normal text-muted-foreground">{c.tags.join(", ")}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS[c.subscriptionStatus].variant}>{STATUS[c.subscriptionStatus].label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{(c.source && SOURCE_LABEL[c.source]) || c.source || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.consentGiven && c.consentAt ? format(new Date(c.consentAt), "d MMM yyyy") : "—"}
                    </td>
                    {canWrite ? (
                      <td className="px-4 py-3 text-right">
                        {c.subscriptionStatus === "subscribed" || c.subscriptionStatus === "pending" ? (
                          <UnsubscribeContactButton id={c.id} email={c.email} />
                        ) : null}
                      </td>
                    ) : null}
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
