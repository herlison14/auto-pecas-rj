export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <a
          href="/"
          className="block text-center font-display text-4xl tracking-[4px] text-[var(--color-accent)] glow-accent mb-2"
        >
          LEAD <span className="text-[var(--color-orange)]">RADAR</span>
        </a>
        <p className="text-center font-mono text-[10px] uppercase tracking-[2px] text-[var(--color-text-mute)] mb-8">
          Prospecção B2B Multi-Setor
        </p>
        {children}
      </div>
    </div>
  );
}
