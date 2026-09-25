import { createAdminClient } from "@/lib/supabase/admin";
import { TestimonialsManager } from "./testimonials-manager";
import { requirePermission } from "@/lib/security/auth";

export const metadata = { title: "Testimonials" };
export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage() {
  await requirePermission("content.write");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("testimonials")
    .select("id, customer_name, rating, quote, source, review_date, is_approved, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return <TestimonialsManager items={data ?? []} />;
}
