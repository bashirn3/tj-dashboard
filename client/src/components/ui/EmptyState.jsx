export default function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {Icon && (
        <div className="rounded-full border rule p-3 text-[color:var(--color-ink-4)]">
          <Icon size={18} strokeWidth={1.5} />
        </div>
      )}
      <p className="text-lg font-semibold text-[color:var(--color-ink)]">{title}</p>
      {hint && <p className="max-w-sm text-sm text-[color:var(--color-ink-3)]">{hint}</p>}
    </div>
  );
}
