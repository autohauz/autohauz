"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { addEmailContact, createEmailSegment, deleteEmailSegment, unsubscribeEmailContact, type EmailActionResult } from "@/app/admin/email/actions";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<EmailActionResult>, onOk?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(res.message ?? "Saved");
      onOk?.();
      router.refresh();
    });
  return { pending, error, run };
}

export function AddContactForm() {
  const { pending, error, run } = useAction();
  const [formKey, setFormKey] = useState(0);

  return (
    <form
      key={formKey}
      className="grid gap-4 rounded-xl border border-border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () =>
            addEmailContact({
              email: String(f.get("email") ?? ""),
              firstName: String(f.get("firstName") ?? ""),
              lastName: String(f.get("lastName") ?? ""),
              tags: String(f.get("tags") ?? ""),
              consentNote: String(f.get("consentNote") ?? ""),
              consentConfirmed: f.get("consentConfirmed") === "on",
            }),
          () => setFormKey((k) => k + 1),
        );
      }}
    >
      <h2 className="font-semibold">Add a subscriber</h2>
      <p className="text-sm text-muted-foreground">
        Only add people who agreed to receive marketing email from you (for example on a signed form). People who signed up on the website are added
        automatically once they confirm.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="ac-email">Email *</Label>
          <Input id="ac-email" name="email" type="email" required maxLength={254} autoComplete="off" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ac-first">First name</Label>
          <Input id="ac-first" name="firstName" maxLength={80} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ac-last">Last name</Label>
          <Input id="ac-last" name="lastName" maxLength={80} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ac-tags">Tags (comma separated)</Label>
        <Input id="ac-tags" name="tags" maxLength={500} placeholder="e.g. suv, toyota" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ac-consent-note">How and when did they agree? *</Label>
        <Input id="ac-consent-note" name="consentNote" required minLength={5} maxLength={300} placeholder="e.g. Ticked the email box on the test-drive form, 12 Mar 2026" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consentConfirmed" required className="mt-0.5 size-4 accent-primary" />
        I confirm this person gave their consent to receive marketing email from us.
      </label>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          Add subscriber
        </Button>
      </div>
    </form>
  );
}

export function UnsubscribeContactButton({ id, email }: { id: string; email: string }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Unsubscribe ${email}`}>
        <UserMinus className="size-4" aria-hidden="true" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Unsubscribe this person?"
        description={`${email} will stop receiving marketing email and be added to the suppression list. Only they can re-subscribe, by confirming from the website.`}
        confirmLabel="Unsubscribe"
        destructive
        pending={pending}
        onConfirm={() => run(() => unsubscribeEmailContact(id), () => setOpen(false))}
      />
    </>
  );
}

export function CreateSegmentForm() {
  const { pending, error, run } = useAction();
  const [formKey, setFormKey] = useState(0);
  return (
    <form
      key={formKey}
      className="grid gap-4 rounded-xl border border-border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () =>
            createEmailSegment({
              name: String(f.get("name") ?? ""),
              description: String(f.get("description") ?? ""),
              tags: String(f.get("tags") ?? ""),
              source: String(f.get("source") ?? ""),
            }),
          () => setFormKey((k) => k + 1),
        );
      }}
    >
      <h2 className="font-semibold">New segment</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="sg-name">Name *</Label>
          <Input id="sg-name" name="name" required maxLength={80} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sg-desc">Description</Label>
          <Input id="sg-desc" name="description" maxLength={300} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sg-tags">Has any of these tags</Label>
          <Input id="sg-tags" name="tags" maxLength={500} placeholder="e.g. suv, ute" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sg-source">Signed up via</Label>
          <select id="sg-source" name="source" className="h-10 rounded-md border border-input bg-card px-3 text-sm">
            <option value="">Any source</option>
            <option value="footer">Website newsletter form</option>
            <option value="manual">Added by staff</option>
          </select>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          Create segment
        </Button>
      </div>
    </form>
  );
}

export function DeleteSegmentButton({ id, name }: { id: string; name: string }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setOpen(true)} aria-label={`Delete segment ${name}`}>
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete “${name}”?`}
        description="Draft campaigns using this segment will fall back to all subscribers. Contacts are not affected."
        confirmLabel="Delete segment"
        destructive
        pending={pending}
        onConfirm={() => run(() => deleteEmailSegment(id), () => setOpen(false))}
      />
    </>
  );
}
