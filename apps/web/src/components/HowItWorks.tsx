const STEPS = [
  { n: "1", t: "Correct it once", d: "Tell any agent how you like things — or just work, and Recall distills your conventions from the session." },
  { n: "2", t: "Recall remembers", d: "Curated, compact rules — scoped to you, a language, a repo, or a branch. Stale rules are superseded, never piled up." },
  { n: "3", t: "Applied everywhere", d: "Every new session in every repo and every agent starts already knowing your conventions. No copy-pasting CLAUDE.md." },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">How it works</h2>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="font-mono text-sm text-[var(--color-accent)]">{s.n}</div>
            <h3 className="mt-2 text-lg font-semibold">{s.t}</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
