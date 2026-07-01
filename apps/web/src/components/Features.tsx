const FEATURES = [
  { t: "Cross-agent", d: "One brain for Claude Code and Codex. Your conventions don't live trapped in one tool." },
  { t: "Cross-repo & cross-branch", d: "Scoped to you, not the project. Global style follows you; repo/branch rules stay put." },
  { t: "Curated, not logged", d: "Compact, imperative rules — not a dump of everything you ever did." },
  { t: "Local-first", d: "A single fast Rust binary + SQLite on your machine. Inspectable and editable." },
  { t: "Uses your own agent", d: "No extra model to run or pay for — Recall distills via the Claude Code / Codex you already have." },
  { t: "Enforced (soon)", d: "Opt-in PreToolUse gating blocks edits that violate a convention, not just reminds." },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
        The convention brain nobody else ships
      </h2>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.t} className="rounded-xl border border-[var(--color-border)] p-6">
            <h3 className="text-base font-semibold text-[var(--color-accent)]">{f.t}</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{f.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
