type Line = { kind: "cmd" | "out" | "dim" | "accent"; text: string };

const SESSION_A: Line[] = [
  { kind: "dim", text: "# repo: acme/api · agent: Claude Code" },
  { kind: "cmd", text: "you: stop creating barrel files — import directly" },
  { kind: "accent", text: "recall ✓ learned: \"Import directly; no barrel files\" (global)" },
];

const SESSION_B: Line[] = [
  { kind: "dim", text: "# a week later · repo: acme/web · agent: Codex" },
  { kind: "cmd", text: "you: add a users service" },
  { kind: "out", text: "codex: created users.service.ts, imported directly from ./user" },
  { kind: "accent", text: "↳ already follows your convention — you never said a word" },
];

function Block({ title, lines }: { title: string; lines: Line[] }) {
  const color: Record<Line["kind"], string> = {
    cmd: "text-[var(--color-fg)]",
    out: "text-[var(--color-muted)]",
    dim: "text-[var(--color-muted)]/60",
    accent: "text-[var(--color-accent)]",
  };
  return (
    <div className="flex-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-red-500/70" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
        <span className="h-3 w-3 rounded-full bg-green-500/70" />
        <span className="ml-2 text-xs text-[var(--color-muted)]">{title}</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
        {lines.map((l, i) => (
          <div key={i} className={color[l.kind]}>
            {l.text}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function Terminal() {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <Block title="session 1" lines={SESSION_A} />
      <Block title="session 2" lines={SESSION_B} />
    </div>
  );
}
