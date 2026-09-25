import { format } from "date-fns";
import { getAudienceSizes, getEmailSegments } from "@/lib/data/email-contacts";
import { requirePermission } from "@/lib/security/auth";
import { roleCan } from "@/lib/security/permissions";
import { Container } from "@/components/ui/container";
import { CreateSegmentForm, DeleteSegmentButton } from "@/components/admin/email-audience-forms";

export const metadata = { title: "Email segments" };

function describe(filters: Record<string, unknown>): string {
  const parts: string[] = [];
  if (Array.isArray(filters.tags) && filters.tags.length) parts.push(`tagged ${(filters.tags as string[]).join(" or ")}`);
  if (typeof filters.source === "string") parts.push(filters.source === "manual" ? "added by staff" : "signed up on the website");
  return parts.length ? parts.join(", ") : "All subscribers";
}

export default async function EmailSegmentsPage() {
  const user = await requirePermission("email.view");
  const canWrite = roleCan(user.staffRole, "email.write");
  const segments = await getEmailSegments();
  const audience = await getAudienceSizes(segments);

  return (
    <Container>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-extrabold text-foreground">Email segments</h1>
        <p className="mt-1 text-muted-foreground">Target a campaign at part of your list. Only confirmed subscribers are ever included.</p>
      </div>

      {canWrite ? (
        <div className="mb-8">
          <CreateSegmentForm />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Email segments</caption>
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Segment</th>
                <th scope="col" className="px-4 py-3 font-medium">Who</th>
                <th scope="col" className="px-4 py-3 font-medium">Subscribers</th>
                <th scope="col" className="px-4 py-3 font-medium">Created</th>
                {canWrite ? (
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {segments.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 5 : 4} className="px-4 py-10 text-center text-muted-foreground">
                    No segments yet. Without one, campaigns go to all confirmed subscribers.
                  </td>
                </tr>
              ) : (
                segments.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {s.name}
                      {s.description ? <div className="text-xs font-normal text-muted-foreground">{s.description}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{describe(s.filters)}</td>
                    <td className="px-4 py-3 tabular-nums">{audience[s.id] ?? 0}</td>
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(s.createdAt), "d MMM yyyy")}</td>
                    {canWrite ? (
                      <td className="px-4 py-3 text-right">
                        <DeleteSegmentButton id={s.id} name={s.name} />
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
