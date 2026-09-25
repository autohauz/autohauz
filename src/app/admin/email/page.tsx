import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/security/auth";

export default async function EmailAdminIndex() {
  await requirePermission("email.view");
  redirect("/admin/email/contacts");
}
