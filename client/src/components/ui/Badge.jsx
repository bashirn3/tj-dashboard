import clsx from 'clsx';

const TONE = {
  moss: 'bg-[color:var(--color-moss-soft)]/70 text-[color:var(--color-moss)] border-[color:var(--color-moss)]/20',
  amber: 'bg-[color:var(--color-amber-soft)]/60 text-[color:var(--color-amber)] border-[color:var(--color-amber)]/25',
  clay: 'bg-[color:var(--color-clay-soft)]/70 text-[color:var(--color-clay)] border-[color:var(--color-clay)]/25',
  sienna: 'bg-[color:var(--color-sienna-soft)]/70 text-[color:var(--color-sienna)] border-[color:var(--color-sienna)]/25',
  teal: 'bg-[color:var(--color-teal-soft)]/70 text-[color:var(--color-teal)] border-[color:var(--color-teal)]/25',
  green: 'bg-[color:var(--color-moss-soft)]/70 text-[color:var(--color-moss)] border-[color:var(--color-moss)]/20',
  red: 'bg-[color:var(--color-sienna-soft)]/70 text-[color:var(--color-sienna)] border-[color:var(--color-sienna)]/25',
  gray: 'bg-[color:var(--color-canvas-sunk)] text-[color:var(--color-ink-3)] border-[color:var(--color-rule)]',
  primary: 'bg-[color:var(--color-clay-soft)]/70 text-[color:var(--color-clay)] border-[color:var(--color-clay)]/25',
  neutral: 'bg-[color:var(--color-canvas-sunk)] text-[color:var(--color-ink-2)] border-[color:var(--color-rule)]',
};

export default function Badge({ tone = 'neutral', children, className, dot = false }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight tracking-tight whitespace-nowrap',
        TONE[tone] || TONE.neutral,
        className
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
