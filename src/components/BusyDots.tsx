// ============================================================
// BusyDots — animated “…” so waits don’t look frozen
// ============================================================

interface BusyDotsProps {
  /** Accessible label for the whole waiting phrase (optional) */
  label?: string;
  className?: string;
}

/** Three pulsing dots — use after a status word: Connecting<BusyDots /> */
export function BusyDots({ label, className = '' }: BusyDotsProps) {
  return (
    <span
      className={`busy-dots ${className}`.trim()}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'status' : undefined}
    >
      <span className="busy-dots__dot">.</span>
      <span className="busy-dots__dot">.</span>
      <span className="busy-dots__dot">.</span>
    </span>
  );
}
