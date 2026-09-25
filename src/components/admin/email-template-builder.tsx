"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BLOCK_LABELS, renderEmailHtml, type EmailBlock, type EmailSender, type EmailVehicle } from "@/lib/email/blocks";
import { saveEmailTemplate, sendTemplateTest } from "@/app/admin/email/actions";

type BlockType = EmailBlock["type"];
type Keyed = { key: string; block: EmailBlock };

const NEW_BLOCK: Record<BlockType, () => EmailBlock> = {
  heading: () => ({ type: "heading", text: "", level: 2 }),
  paragraph: () => ({ type: "paragraph", text: "" }),
  image: () => ({ type: "image", url: "", alt: "" }),
  gallery: () => ({ type: "gallery", images: [{ url: "", alt: "" }, { url: "", alt: "" }] }),
  button: () => ({ type: "button", label: "View cars", href: "/used-cars" }),
  vehicle: () => ({ type: "vehicle", vehicleId: "" }),
  divider: () => ({ type: "divider" }),
  spacer: () => ({ type: "spacer", size: "md" }),
};

/**
 * Block-based email template editor. The preview is rendered by the same
 * code that renders real sends (lib/email/blocks), inside a sandboxed iframe
 * (no scripts, no same-origin access). The header and the compliance footer
 * are fixed and appear in the preview.
 */
export function EmailTemplateBuilder({
  template,
  sender,
  vehicleOptions,
  previewVehicles,
}: {
  template?: { id: string; name: string; subject: string; previewText: string | null; blocks: EmailBlock[] | null };
  sender: EmailSender;
  vehicleOptions: { id: string; label: string }[];
  previewVehicles: Record<string, EmailVehicle>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [previewText, setPreviewText] = useState(template?.previewText ?? "");
  const [blocks, setBlocks] = useState<Keyed[]>(() =>
    (template?.blocks?.length ? template.blocks : [NEW_BLOCK.heading(), NEW_BLOCK.paragraph()]).map((block) => ({
      key: crypto.randomUUID(),
      block,
    })),
  );
  const [addType, setAddType] = useState<BlockType>("paragraph");
  const [error, setError] = useState<string | null>(null);

  const vehiclesForPreview = useMemo(() => {
    const map: Record<string, EmailVehicle> = { ...previewVehicles };
    for (const o of vehicleOptions) {
      map[o.id] ??= { id: o.id, title: o.label.split(" · ").slice(1).join(" · ") || o.label, priceText: "Price", detailText: "Details shown when sent", imageUrl: null, url: "/used-cars" };
    }
    return map;
  }, [previewVehicles, vehicleOptions]);

  const previewHtml = useMemo(
    () =>
      renderEmailHtml(
        blocks.map((b) => b.block),
        { sender, vehicles: vehiclesForPreview, firstName: "Alex", unsubscribeUrl: `${sender.siteUrl}/newsletter/unsubscribe`, preheader: previewText },
        subject || "Preview",
      ),
    [blocks, sender, vehiclesForPreview, previewText, subject],
  );

  const update = (key: string, patch: Partial<EmailBlock>) =>
    setBlocks((prev) => prev.map((b) => (b.key === key ? { ...b, block: { ...b.block, ...patch } as EmailBlock } : b)));
  const move = (index: number, delta: number) =>
    setBlocks((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveEmailTemplate(template?.id ?? null, { name, subject, previewText, blocks: blocks.map((b) => b.block) });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Template saved");
      if (!template) router.push(`/admin/email/templates/${res.id}`);
      else router.refresh();
    });

  const test = () =>
    startTransition(async () => {
      if (!template) return;
      const res = await sendTemplateTest(template.id);
      if (res.ok) toast.success(res.message ?? "Test sent");
      else toast.error(res.error);
    });

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_620px]">
      <div className="space-y-6">
        {error ? (
          <p role="alert" className="rounded-lg bg-danger/10 p-4 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <section className="space-y-4 rounded-xl border border-border bg-card p-6" aria-labelledby="tpl-details">
          <h2 id="tpl-details" className="font-semibold">Details</h2>
          <div className="grid gap-2">
            <Label htmlFor="tpl-name">Template name (internal) *</Label>
            <Input id="tpl-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tpl-subject">Subject line *</Label>
            <Input id="tpl-subject" value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tpl-preview">Inbox preview text</Label>
            <Input id="tpl-preview" value={previewText} maxLength={150} onChange={(e) => setPreviewText(e.target.value)} />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-6" aria-labelledby="tpl-content">
          <h2 id="tpl-content" className="font-semibold">Content</h2>
          <p className="text-sm text-muted-foreground">
            Use <code className="rounded bg-muted px-1">{"{{firstName}}"}</code> to personalise text. Your logo, business details and the unsubscribe link are
            added automatically.
          </p>
          <ol className="space-y-3">
            {blocks.map(({ key, block }, index) => (
              <li key={key} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{BLOCK_LABELS[block.type]}</span>
                  <div className="flex gap-1">
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move ${BLOCK_LABELS[block.type]} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move ${BLOCK_LABELS[block.type]} down`} disabled={index === blocks.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-danger"
                      aria-label={`Remove ${BLOCK_LABELS[block.type]}`}
                      onClick={() => setBlocks((prev) => prev.filter((b) => b.key !== key))}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <BlockFields id={key} block={block} onChange={(patch) => update(key, patch)} vehicleOptions={vehicleOptions} />
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <div className="grid gap-2">
              <Label htmlFor="tpl-add">Add a block</Label>
              <Select id="tpl-add" value={addType} onChange={(e) => setAddType(e.target.value as BlockType)} wrapperClassName="w-48">
                {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => (
                  <option key={t} value={t}>
                    {BLOCK_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={() => setBlocks((prev) => [...prev, { key: crypto.randomUUID(), block: NEW_BLOCK[addType]() }])}>
              <Plus className="mr-2 size-4" aria-hidden="true" /> Add
            </Button>
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-3">
          {template ? (
            <Button type="button" variant="outline" onClick={test} disabled={pending}>
              <Send className="mr-2 size-4" aria-hidden="true" /> Send me a test
            </Button>
          ) : null}
          <Button type="button" onClick={save} disabled={pending} aria-busy={pending}>
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
            {template ? "Save template" : "Create template"}
          </Button>
        </div>
      </div>

      <section aria-labelledby="tpl-preview-heading" className="space-y-2 xl:sticky xl:top-6 xl:self-start">
        <h2 id="tpl-preview-heading" className="text-sm font-semibold">Preview</h2>
        <iframe
          title="Email preview"
          sandbox=""
          srcDoc={previewHtml}
          className="h-[720px] w-full rounded-xl border border-border bg-white"
        />
      </section>
    </div>
  );
}

function BlockFields({
  id,
  block,
  onChange,
  vehicleOptions,
}: {
  id: string;
  block: EmailBlock;
  onChange: (patch: Partial<EmailBlock>) => void;
  vehicleOptions: { id: string; label: string }[];
}) {
  const f = (name: string) => `${id}-${name}`;
  switch (block.type) {
    case "heading":
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <div className="grid gap-2">
            <Label htmlFor={f("text")}>Text</Label>
            <Input id={f("text")} value={block.text} maxLength={200} onChange={(e) => onChange({ text: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={f("level")}>Size</Label>
            <Select id={f("level")} value={String(block.level)} onChange={(e) => onChange({ level: Number(e.target.value) as 1 | 2 })}>
              <option value="1">Large</option>
              <option value="2">Medium</option>
            </Select>
          </div>
        </div>
      );
    case "paragraph":
      return (
        <div className="grid gap-2">
          <Label htmlFor={f("text")}>Text</Label>
          <Textarea id={f("text")} rows={4} value={block.text} maxLength={5000} onChange={(e) => onChange({ text: e.target.value })} />
        </div>
      );
    case "image":
      return (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor={f("url")}>Image URL (https)</Label>
            <Input id={f("url")} type="url" value={block.url} onChange={(e) => onChange({ url: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={f("alt")}>Alt text (describes the image) *</Label>
            <Input id={f("alt")} value={block.alt} maxLength={300} onChange={(e) => onChange({ alt: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={f("href")}>Link (optional)</Label>
            <Input id={f("href")} value={block.href ?? ""} onChange={(e) => onChange({ href: e.target.value || undefined })} />
          </div>
        </div>
      );
    case "gallery":
      return (
        <div className="grid gap-3">
          {block.images.map((im, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={f(`url${i}`)}>Image {i + 1} URL</Label>
                <Input
                  id={f(`url${i}`)}
                  type="url"
                  value={im.url}
                  onChange={(e) => onChange({ images: block.images.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={f(`alt${i}`)}>Image {i + 1} alt text</Label>
                <Input
                  id={f(`alt${i}`)}
                  value={im.alt}
                  onChange={(e) => onChange({ images: block.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)) })}
                />
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            {block.images.length < 4 ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onChange({ images: [...block.images, { url: "", alt: "" }] })}>
                Add image
              </Button>
            ) : null}
            {block.images.length > 2 ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ images: block.images.slice(0, -1) })}>
                Remove last
              </Button>
            ) : null}
          </div>
        </div>
      );
    case "button":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={f("label")}>Label</Label>
            <Input id={f("label")} value={block.label} maxLength={60} onChange={(e) => onChange({ label: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={f("href")}>Link</Label>
            <Input id={f("href")} value={block.href} onChange={(e) => onChange({ href: e.target.value })} />
          </div>
        </div>
      );
    case "vehicle":
      return (
        <div className="grid gap-2">
          <Label htmlFor={f("vehicle")}>Vehicle</Label>
          <Select id={f("vehicle")} value={block.vehicleId} onChange={(e) => onChange({ vehicleId: e.target.value })}>
            <option value="">Choose a car for sale…</option>
            {vehicleOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">If the car sells before the email goes out, the card is left out automatically.</p>
        </div>
      );
    case "spacer":
      return (
        <div className="grid max-w-xs gap-2">
          <Label htmlFor={f("size")}>Height</Label>
          <Select id={f("size")} value={block.size} onChange={(e) => onChange({ size: e.target.value as "sm" | "md" | "lg" })}>
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </Select>
        </div>
      );
    case "divider":
      return <p className="text-sm text-muted-foreground">A thin horizontal line.</p>;
  }
}
