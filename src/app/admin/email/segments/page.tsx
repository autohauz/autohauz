import { getEmailSegments } from "@/lib/data/email-contacts";
import { requireAdminRole } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { format } from "date-fns";

export const metadata = {
  title: "Email Segments | AutoHauz Admin",
};

export default async function EmailSegmentsPage() {
  await requireAdminRole(["admin", "owner", "content"]);
  const segments = await getEmailSegments();

  return (
    <Container>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-foreground">Email Segments</h1>
          <p className="text-muted-foreground mt-1">Manage audience segments for targeted campaigns.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Segment Name</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {segments.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    No segments defined. Future updates will allow visual segment creation.
                  </td>
                </tr>
              ) : (
                segments.map((segment) => (
                  <tr key={segment.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {segment.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {segment.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(segment.createdAt), "MMM d, yyyy")}
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
