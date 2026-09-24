"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createEmailCampaign, updateEmailCampaign, sendEmailCampaign } from "@/app/admin/email/actions";
import type { EmailCampaign, EmailTemplate } from "@/lib/domain";

export function EmailCampaignForm({ 
  campaign, 
  templates 
}: { 
  campaign?: EmailCampaign;
  templates: EmailTemplate[];
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      if (campaign) {
        const res = await updateEmailCampaign(campaign.id, formData);
        if (res.error) throw new Error(res.error);
        router.push("/admin/email/campaigns");
      } else {
        const res = await createEmailCampaign(formData);
        if (res.error) throw new Error(res.error);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsPending(false);
    }
  };

  const handleSend = async () => {
    if (!campaign) return;
    if (!confirm("Are you sure you want to SEND this campaign right now? This will immediately start sending emails to all subscribed contacts.")) return;
    
    setIsPending(true);
    const res = await sendEmailCampaign(campaign.id);
    if (res.error) {
      setError(res.error);
      setIsPending(false);
    } else {
      router.push("/admin/email/campaigns");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl pb-12">
      {error && <div className="p-4 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

      <div className="space-y-6 bg-card border border-border p-6 rounded-xl">
        <div className="space-y-1.5">
          <Label htmlFor="name">Campaign Name * (Internal use)</Label>
          <Input id="name" name="name" defaultValue={campaign?.name} required placeholder="e.g. EOFY Sale 2026" disabled={campaign?.status === "sent" || campaign?.status === "sending"} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="subject">Email Subject *</Label>
          <Input id="subject" name="subject" defaultValue={campaign?.subject} required placeholder="Don't miss out on these deals!" disabled={campaign?.status === "sent" || campaign?.status === "sending"} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="templateId">Email Template *</Label>
          <Select id="templateId" name="templateId" defaultValue={campaign?.templateId || ""} required disabled={campaign?.status === "sent" || campaign?.status === "sending"}>
            <option value="" disabled>-- Select Template --</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.subject})</option>
            ))}
          </Select>
        </div>

        {campaign && (
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={campaign.status} disabled={campaign.status === "sent" || campaign.status === "sending"}>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="cancelled">Cancelled</option>
              {(campaign.status === "sent" || campaign.status === "sending") && (
                <option value={campaign.status}>{campaign.status}</option>
              )}
            </Select>
          </div>
        )}
      </div>

      <div className="flex justify-between gap-4 pt-6 border-t border-border">
        {campaign && campaign.status !== "sent" && campaign.status !== "sending" ? (
          <Button type="button" onClick={handleSend} disabled={isPending} className="bg-success hover:bg-success/90 text-white shadow-md">
            SEND CAMPAIGN NOW
          </Button>
        ) : (
          <div /> // spacer
        )}

        <div className="flex gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
            Cancel
          </Button>
          {(campaign?.status !== "sent" && campaign?.status !== "sending") && (
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : campaign ? "Save Changes" : "Create Campaign"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
