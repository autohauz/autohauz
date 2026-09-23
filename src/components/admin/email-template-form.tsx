"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createEmailTemplate, updateEmailTemplate } from "@/app/admin/email/actions";
import type { EmailTemplate } from "@/lib/domain";

export function EmailTemplateForm({ template }: { template?: EmailTemplate }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      if (template) {
        const res = await updateEmailTemplate(template.id, formData);
        if (res.error) throw new Error(res.error);
        router.push("/admin/email/templates");
      } else {
        const res = await createEmailTemplate(formData);
        if (res.error) throw new Error(res.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl pb-12">
      {error && <div className="p-4 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1.5  md:col-span-2">
          <Label htmlFor="name">Template Name * (Internal use)</Label>
          <Input id="name" name="name" defaultValue={template?.name} required placeholder="e.g. Monthly Newsletter v1" />
        </div>

        <div className="space-y-1.5  md:col-span-2">
          <Label htmlFor="subject">Email Subject *</Label>
          <Input id="subject" name="subject" defaultValue={template?.subject} required placeholder="Check out our latest cars!" />
        </div>

        <div className="space-y-1.5  md:col-span-2">
          <Label htmlFor="previewText">Preview Text</Label>
          <Input id="previewText" name="previewText" defaultValue={template?.previewText || ""} placeholder="Shows up in the inbox preview..." />
        </div>

        <div className="space-y-1.5  md:col-span-2">
          <Label htmlFor="htmlBody">HTML Body *</Label>
          <Textarea 
            id="htmlBody" 
            name="htmlBody" 
            defaultValue={template?.htmlBody} 
            required 
            rows={15} 
            className="font-mono text-xs" 
            placeholder="<h1>Hello {{firstName}}</h1>..." 
          />
          <p className="text-xs text-muted-foreground mt-2">
            Available variables: <code className="bg-muted px-1 rounded">{"{{firstName}}"}</code>, <code className="bg-muted px-1 rounded">{"{{unsubscribeUrl}}"}</code>
          </p>
        </div>

        <div className="space-y-1.5  md:col-span-2">
          <Label htmlFor="textBody">Plain Text Body (Optional fallback)</Label>
          <Textarea 
            id="textBody" 
            name="textBody" 
            defaultValue={template?.textBody || ""} 
            rows={8} 
            className="font-mono text-xs" 
          />
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t border-border">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : template ? "Save Changes" : "Create Template"}
        </Button>
      </div>
    </form>
  );
}
