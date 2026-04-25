import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../lib/useTheme.js';

export default function Shell({ children }) {
  const location = useLocation();
  const onDetail = location.pathname.startsWith('/customers/');
  const { isDark, toggle } = useTheme();

  return (
    <div className="relative z-10 min-h-dvh">
      <header className="sticky top-0 z-20 border-b rule bg-[color:var(--color-canvas)]/90 backdrop-blur-sm">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <NavLink to="/" className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-[color:var(--color-primary)] grid place-items-center">
                <span className="text-white text-xs font-bold">TJ</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[color:var(--color-ink)] leading-tight">
                  TJ Katsastus
                </span>
                <span className="text-[10px] text-[color:var(--color-ink-4)] leading-tight">
                  WhatsApp Dashboard
                </span>
              </div>
            </NavLink>
            <div className="flex items-center gap-2">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  [
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)]'
                      : 'text-[color:var(--color-ink-3)] hover:text-[color:var(--color-ink)] hover:bg-[color:var(--color-canvas-sunk)]',
                  ].join(' ')
                }
              >
                <LayoutDashboard size={14} strokeWidth={1.75} />
                <span className="hidden sm:inline">Overview</span>
              </NavLink>
              <button
                type="button"
                onClick={toggle}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="grid size-8 place-items-center rounded-lg border rule text-[color:var(--color-ink-3)] transition-colors hover:text-[color:var(--color-ink)] hover:border-[color:var(--color-rule-strong)]"
              >
                {isDark ? <Sun size={14} strokeWidth={1.75} /> : <Moon size={14} strokeWidth={1.75} />}
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className={onDetail ? '' : 'mx-auto max-w-[1200px] px-4 sm:px-6 py-5 sm:py-8'}>
        {children}
      </main>
    </div>
  );
}
