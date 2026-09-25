"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Loader2, RotateCcw, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { renderEmailHtml, type EmailBlock, type EmailSender, type EmailVehicle } from "@/lib/email/blocks";
import { CAMPAIGN_STATUS } from "@/lib/email/status";
import type { EmailCampaign } from "@/lib/domain";
import {
  cancelEmailCampaign,
  continueEmailCampaign,
  retryFailedSends,
  saveEmailCampaign,
  scheduleEmailCampaign,
  sendCampaignTest,
  sendEmailCampaignNow,
  unscheduleEmailCampaign,
  type EmailActionResult,
} from "@/app/admin/email/actions";

type Stats = { total: number; pending: number; sent: number; failed: number; unsubscribed: number };

export function EmailCampaignEditor({
  campaign,
  templates,
  segments,
  audience,
  stats,
  sender,
  previewVehicles,
  canSend,
}: {
  campaign?: EmailCampaign;
  templates: { id: string; name: string; subject: string; blocks: EmailBlock[] | null }[];
  segments: { id: string; name: string }[];
  audience: Record<string, number>;
  stats: Stats | null;
  sender: EmailSender;
  previewVehicles: Record<string, EmailVehicle>;
  canSend: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(campaign?.name ?? "");
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [previewText, setPreviewText] = useState(campaign?.previewText ?? "");
  const [templateId, setTemplateId] = useState(campaign?.templateId ?? "");
  const [segmentId, setSegmentId] = useState(campaign?.segmentId ?? "");
  const [scheduleAt, setScheduleAt] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = campaign?.status ?? "draft";
  const editable = status === "draft" || status === "scheduled";
  const template = templates.find((t) => t.id === templateId);
  const audienceSize = audience[segmentId] ?? 0;

  const previewHtml = useMemo(() => {
    if (!template?.blocks) return null;
    return renderEmailHtml(
      template.blocks,
      { sender, vehicles: previewVehicles, firstName: "Alex", unsubscribeUrl: `${sender.siteUrl}/newsletter/unsubscribe`, preheader: previewText },
      subject || template.subject,
    );
  }, [template, sender, previewVehicles, previewText, subject]);

  const run = (action: () => Promise<EmailActionResult>, onOk?: (res: Extract<EmailActionResult, { ok: true }>) => void) =>
    startTransition(async () => {
      setError(null);
      const res = await action();
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      if (res.message) toast.success(res.message);
      onOk?.(res);
      router.refresh();
    });

  const save = () =>
    run(
      () => saveEmailCampaign(campaign?.id ?? null, { name, subject, previewText, templateId, segmentId }),
      (res) => {
        toast.success("Campaign saved");
        if (!campaign && res.id) router.push(`/admin/email/campaigns/${res.id}`);
      },
    );

  // While a campaign is mid-send, keep delivering batches as long as this page is open.
  const draining = useRef(false);
  useEffect(() => {
    if (status !== "sending" || !campaign || !canSend || draining.current) return;
    draining.current = true;
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        const res = await continueEmailCampaign(campaign.id);
        router.refresh();
        if (!res.ok || res.done) break;
      }
      draining.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [status, campaign, canSend, router]);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_620px]">
      <div className="space-y-6">
        {campaign ? (
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={CAMPAIGN_STATUS[status].variant}>{CAMPAIGN_STATUS[status].label}</Badge>
            {status === "scheduled" && campaign.scheduledAt ? (
              <span className="text-sm text-muted-foreground">
                Sends on the first send run after {new Date(campaign.scheduledAt).toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" })} (Sydney)
              </span>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg bg-danger/10 p-4 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {stats && stats.total > 0 ? (
          <section aria-labelledby="delivery-heading" className="rounded-xl border border-border bg-card p-6">
            <h2 id="delivery-heading" className="mb-4 font-semibold">Delivery</h2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5" aria-live="polite">
              {([
                ["Recipients", stats.total],
                ["Sent", stats.sent],
                ["Waiting", stats.pending],
                ["Failed", stats.failed],
                ["Unsubscribed", stats.unsubscribed],
              ] as const).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-2xl font-bold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {status === "sending" ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Sending in batches. You can leave this page; the daily send run finishes anything left.
              </p>
            ) : null}
            {canSend && stats.failed > 0 && (status === "sent" || status === "sending") ? (
              <Button className="mt-4" variant="outline" disabled={pending} onClick={() => run(() => retryFailedSends(campaign!.id))}>
                <RotateCcw className="mr-2 size-4" aria-hidden="true" /> Retry {stats.failed} failed
              </Button>
            ) : null}
          </section>
        ) : null}

        <section className="space-y-4 rounded-xl border border-border bg-card p-6" aria-labelledby="campaign-details">
          <h2 id="campaign-details" className="font-semibold">Campaign</h2>
          <div className="grid gap-2">
            <Label htmlFor="c-name">Name (internal) *</Label>
            <Input id="c-name" value={name} maxLength={120} disabled={!editable} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-template">Template *</Label>
            <Select
              id="c-template"
              value={templateId}
              disabled={!editable}
              onChange={(e) => {
                setTemplateId(e.target.value);
                const t = templates.find((x) => x.id === e.target.value);
                if (t && !subject) setSubject(t.subject);
              }}
            >
              <option value="">Choose a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id} disabled={!t.blocks}>
                  {t.name}
                  {t.blocks ? "" : " (needs rebuilding)"}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-subject">Subject line *</Label>
            <Input id="c-subject" value={subject} maxLength={150} disabled={!editable} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-preview">Inbox preview text</Label>
            <Input id="c-preview" value={previewText} maxLength={150} disabled={!editable} onChange={(e) => setPreviewText(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-segment">Audience</Label>
            <Select id="c-segment" value={segmentId} disabled={!editable} onChange={(e) => setSegmentId(e.target.value)}>
              <option value="">All subscribers (about {audience[""] ?? 0})</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (about {audience[s.id] ?? 0})
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              Only people who confirmed their subscription receive marketing email. Unsubscribed and suppressed addresses are always excluded.
            </p>
          </div>

          {editable ? (
            <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
              {campaign ? (
                <Button variant="ghost" disabled={pending} onClick={() => run(() => cancelEmailCampaign(campaign.id))}>
                  <XCircle className="mr-2 size-4" aria-hidden="true" /> Cancel campaign
                </Button>
              ) : null}
              {campaign ? (
                <Button variant="outline" disabled={pending} onClick={() => run(() => sendCampaignTest(campaign.id))}>
                  <Send className="mr-2 size-4" aria-hidden="true" /> Send me a test
                </Button>
              ) : null}
              <Button onClick={save} disabled={pending} aria-busy={pending}>
                {campaign ? "Save" : "Create campaign"}
              </Button>
            </div>
          ) : null}
        </section>

        {campaign && editable && canSend ? (
          <section className="space-y-4 rounded-xl border border-border bg-card p-6" aria-labelledby="campaign-send">
            <h2 id="campaign-send" className="font-semibold">Send</h2>
            <p className="text-sm text-muted-foreground">Save your changes first. Sending uses the saved version.</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-2">
                <Label htmlFor="c-schedule">Schedule for (your local time)</Label>
                <Input id="c-schedule" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
              </div>
              <Button variant="outline" disabled={pending || !scheduleAt} onClick={() => run(() => scheduleEmailCampaign(campaign.id, new Date(scheduleAt).toISOString()))}>
                <CalendarClock className="mr-2 size-4" aria-hidden="true" /> Schedule
              </Button>
              {status === "scheduled" ? (
                <Button variant="ghost" disabled={pending} onClick={() => run(() => unscheduleEmailCampaign(campaign.id))}>
                  Unschedule
                </Button>
              ) : null}
              <Button className="ml-auto" disabled={pending} onClick={() => setConfirmSend(true)}>
                <Send className="mr-2 size-4" aria-hidden="true" /> Send now
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Scheduled campaigns go out on the first send run after the chosen time (the send job runs daily, about 7–8 am Sydney time).</p>
          </section>
        ) : null}

        <ConfirmDialog
          open={confirmSend}
          onOpenChange={setConfirmSend}
          title="Send this campaign now?"
          description={`It will go to about ${audienceSize} confirmed subscriber${audienceSize === 1 ? "" : "s"}. This can't be undone.`}
          confirmLabel="Send now"
          pending={pending}
          onConfirm={() => run(() => sendEmailCampaignNow(campaign!.id), () => setConfirmSend(false))}
        />
      </div>

      <section aria-labelledby="c-preview-heading" className="space-y-2 xl:sticky xl:top-6 xl:self-start">
        <h2 id="c-preview-heading" className="text-sm font-semibold">Preview</h2>
        {previewHtml ? (
          <iframe title="Campaign preview" sandbox="" srcDoc={previewHtml} className="h-[720px] w-full rounded-xl border border-border bg-white" />
        ) : (
          <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            Choose a template to preview this campaign.
          </div>
        )}
      </section>
    </div>
  );
}
