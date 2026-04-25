import clsx from 'clsx';

const TONE = {
  green: 'bg-[color:var(--color-green-soft)] text-[color:var(--color-green)] border-[color:var(--color-green)]/20',
  amber: 'bg-[color:var(--color-amber-soft)] text-[color:var(--color-amber)] border-[color:var(--color-amber)]/20',
  red: 'bg-[color:var(--color-red-soft)] text-[color:var(--color-red)] border-[color:var(--color-red)]/20',
  gray: 'bg-[color:var(--color-gray-soft)] text-[color:var(--color-gray)] border-[color:var(--color-rule)]',
  primary: 'bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)] border-[color:var(--color-primary)]/20',
};

export default function Badge({ tone = 'gray', children, className, dot = false }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight tracking-tight whitespace-nowrap',
        TONE[tone] || TONE.gray,
        className
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
