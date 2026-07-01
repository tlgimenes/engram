import { useState } from "react";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-muted)] transition hover:border-[var(--color-accent-dim)] hover:text-[var(--color-accent)]"
      aria-label={label ?? "Copy to clipboard"}
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}
