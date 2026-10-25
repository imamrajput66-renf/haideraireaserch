import { Link } from "@tanstack/react-router";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--violet-soft)" />
          <stop offset=".55" stopColor="var(--magenta)" />
          <stop offset="1" stopColor="var(--cyan)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="none" stroke="url(#hg)" strokeWidth="2" />
      <path d="M12 11v18M28 11v18M12 20h16" stroke="url(#hg)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="12" cy="11" r="2.6" fill="var(--violet-soft)" />
      <circle cx="28" cy="29" r="2.6" fill="var(--cyan)" />
      <circle cx="20" cy="20" r="3" fill="var(--magenta)" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-tight">
        Haider <span className="text-gradient">AI Research</span>
      </span>
    </Link>
  );
}
