import { CopyButton } from "./CopyButton";

const ROWS: { label: string; cmd: string }[] = [
  { label: "Claude Code", cmd: "/plugin marketplace add tlgimenes/recall" },
  { label: "…then", cmd: "/plugin install recall@recall" },
  { label: "Codex", cmd: "codex plugin marketplace add tlgimenes/recall" },
  { label: "npm / npx", cmd: "npx -y @tlgimenes/recall" },
  { label: "Homebrew", cmd: "brew install tlgimenes/recall/recall" },
  { label: "curl", cmd: "curl -fsSL https://github.com/tlgimenes/recall/releases/latest/download/recall-installer.sh | sh" },
];

export function Install() {
  return (
    <section id="install" className="mx-auto max-w-3xl px-6 py-20">
      <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">Install</h2>
      <p className="mt-3 text-center text-sm text-[var(--color-muted)]">
        Install the plugin in your agent — the MCP server runs via npx, no separate setup.
      </p>
      <div className="mt-8 divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        {ROWS.map((r) => (
          <div key={r.cmd} className="flex items-center gap-3 px-4 py-3">
            <span className="w-28 shrink-0 text-xs text-[var(--color-muted)]">{r.label}</span>
            <code className="flex-1 overflow-x-auto font-mono text-sm">{r.cmd}</code>
            <CopyButton text={r.cmd} />
          </div>
        ))}
      </div>
    </section>
  );
}
