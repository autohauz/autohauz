import { redirect } from "next/navigation";

export default function EmailAdminIndex() {
  redirect("/admin/email/contacts");
}
