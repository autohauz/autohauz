import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessProfile } from "@/lib/data/business";
import { getFinanceParams } from "@/lib/data/settings";
import { SettingsForms } from "./settings-forms";
import { requirePermission } from "@/lib/security/auth";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requirePermission("settings.manage");
  const supabase = createAdminClient();
  const [business, finance, { data: recipientsRow }] = await Promise.all([
    getBusinessProfile(),
    getFinanceParams(),
    supabase.from("settings").select("value").eq("key", "notification_recipients").maybeSingle(),
  ]);
  const recipients = (((recipientsRow?.value as { emails?: string[] } | null)?.emails) ?? []).filter(Boolean);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Business identity, contact details, invoice defaults and notifications. Everything here drives the public site and invoices — nothing is hard-coded.
        </p>
      </header>
      <SettingsForms business={business} finance={finance} recipients={recipients} />
    </div>
  );
}
