import { getEmailTemplates } from "@/lib/data/email-campaigns";
import { requireAdminRole } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { Button, ButtonLink } from "@/components/ui/button";
import { format } from "date-fns";
import { Plus, Edit } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Email Templates | AutoHauz Admin",
};

export default async function EmailTemplatesPage() {
  await requireAdminRole(["admin", "owner", "content"]);
  const templates = await getEmailTemplates();

  return (
    <Container>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-foreground">Email Templates</h1>
          <p className="text-muted-foreground mt-1">Manage HTML templates for your marketing campaigns.</p>
        </div>
        <ButtonLink href="/admin/email/templates/new">
            <Plus className="size-4 mr-2" /> New Template
          </ButtonLink>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Subject Line</th>
                <th className="px-4 py-3 font-medium">Last Updated</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No templates found. Create one to get started!
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {template.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">
                      {template.subject}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(template.updatedAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ButtonLink href={`/admin/email/templates/\${template.id}`} variant="ghost" size="sm"  >
                          <Edit className="size-4" />
                        </ButtonLink>
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
