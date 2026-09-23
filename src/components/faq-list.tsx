import { ChevronDown } from "lucide-react";
import type { Faq } from "@/lib/domain";
import { cn } from "@/lib/utils";

/**
 * Native <details> accordion — no JavaScript, keyboard-accessible, and
 * `hidden="until-found"`-friendly so browser find-in-page opens the answer.
 * `name` groups items so only one in a group stays open where supported.
 */
export function FaqList({ faqs, name, className }: { faqs: Pick<Faq, "id" | "question" | "answer">[]; name?: string; className?: string }) {
  return (
    <div className={cn("divide-y divide-border border-y border-border", className)}>
      {faqs.map((f) => (
        <details key={f.id} name={name} className="group py-4" suppressHydrationWarning>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
            {f.question}
            <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <p className="mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed text-body">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}
