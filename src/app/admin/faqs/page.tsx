import { createAdminClient } from "@/lib/supabase/admin";
import { FaqsManager } from "./faqs-manager";
import { requirePermission } from "@/lib/security/auth";

export const metadata = { title: "FAQs" };
export const dynamic = "force-dynamic";

export default async function AdminFaqsPage() {
  await requirePermission("content.write");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("faqs")
    .select("id, category, question, answer, sort_order, is_published")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  return <FaqsManager items={data ?? []} />;
}
