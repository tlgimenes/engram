export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-[var(--color-muted)] sm:flex-row">
        <span className="font-mono">recall</span>
        <nav className="flex gap-6">
          <a href="https://github.com/tlgimenes/recall" className="hover:text-[var(--color-fg)]">GitHub</a>
          <a href="https://github.com/tlgimenes/recall#readme" className="hover:text-[var(--color-fg)]">Docs</a>
          <a href="#install" className="hover:text-[var(--color-fg)]">Install</a>
        </nav>
        <span>MIT · built in Rust</span>
      </div>
    </footer>
  );
}
