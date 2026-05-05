import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarCheck,
  CheckCheck,
  Eye,
  MessageSquareReply,
  Send,
  Table2,
} from 'lucide-react';
import { fetchAnalytics, fetchStats, pollMessageStatuses } from '../lib/api.js';
import Badge from '../components/ui/Badge.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';

const PERIODS = [
  { key: 'today', label: 'Today', hint: 'calendar day' },
  { key: 'week', label: 'This week', hint: 'Mon-Sun' },
  { key: 'month', label: 'This month', hint: 'calendar month' },
];

export default function StatsPage() {
  const [bookingView, setBookingView] = useState('chart');
  const [bookingSort, setBookingSort] = useState('desc');
  const [sendView, setSendView] = useState('chart');
  const [sendSort, setSendSort] = useState('desc');

  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 60_000,
  });

  const analyticsQuery = useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
    refetchInterval: 5 * 60_000,
  });

  useEffect(() => {
    pollMessageStatuses().catch(() => {});
    const id = setInterval(() => pollMessageStatuses().catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, []);

  const stats = statsQuery.data || {};
  const analytics = analyticsQuery.data || {};
  const summary = analytics.summary || {};
  const bookings = analytics.bookingsAfterWhatsApp || [];
  const sendWindows = analytics.bestSendWindows || [];
  const loading = statsQuery.isLoading || analyticsQuery.isLoading;

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const aTime = new Date(a.dorisBookingCreatedAt || 0).getTime();
      const bTime = new Date(b.dorisBookingCreatedAt || 0).getTime();
      return bookingSort === 'desc' ? bTime - aTime : aTime - bTime;
    });
  }, [bookings, bookingSort]);

  const sortedSendWindows = useMemo(() => {
    return [...sendWindows].sort((a, b) => {
      const diff = (b.replyRate || 0) - (a.replyRate || 0);
      return sendSort === 'desc' ? diff : -diff;
    });
  }, [sendWindows, sendSort]);

  const bookingChartRows = useMemo(() => buildBookingChartRows(bookings), [bookings]);

  if (loading) return <StatsSkeleton />;
  if (statsQuery.isError || analyticsQuery.isError) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Stats could not load"
        hint="Check the API logs and refresh the page."
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader generatedAt={analytics.generated_at} />
      <KpiGrid stats={stats} summary={summary} />
      <PeriodCards stats={stats} />

      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel
          title="DORIS Bookings After Outreach"
          description="Bookings created in DORIS after outreach for the same registration."
          action={
            <ViewToggle
              value={bookingView}
              onChange={setBookingView}
              firstLabel="Chart"
              secondLabel="Table"
            />
          }
        >
          {bookingView === 'chart' ? (
            <BookingsChart rows={bookingChartRows} bookings={bookings} />
          ) : (
            <BookingsTable
              bookings={sortedBookings}
              sort={bookingSort}
              onSortChange={setBookingSort}
            />
          )}
        </Panel>

        <BookingSummary summary={summary} />
      </section>

      <Panel
        title="Send-Time Performance"
        description="Message volume, replies, and matched DORIS bookings by send window."
        action={
          <ViewToggle
            value={sendView}
            onChange={setSendView}
            firstLabel="Chart"
            secondLabel="Table"
          />
        }
      >
        {sendView === 'chart' ? (
          <SendTimeChart rows={sortedSendWindows} />
        ) : (
          <SendTimesTable
            windows={sortedSendWindows}
            sort={sendSort}
            onSortChange={setSendSort}
          />
        )}
      </Panel>
    </div>
  );
}

function PageHeader({ generatedAt }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[30px] sm:text-[38px] leading-none font-medium tracking-tight">
          Stats
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--color-ink-3)]">
          Customer replies and DORIS bookings after outreach.
        </p>
      </div>
      {generatedAt && (
        <p className="text-[11px] text-[color:var(--color-ink-4)]">
          Updated {formatLocal(generatedAt)}
        </p>
      )}
    </header>
  );
}

function KpiGrid({ stats, summary }) {
  const total = stats.total || {};
  const cards = [
    { label: 'Sent', value: total.sent ?? summary.contacted, icon: Send, tone: 'clay' },
    { label: 'Delivered', value: total.delivered ?? summary.delivered, icon: CheckCheck, tone: 'amber' },
    { label: 'Read', value: total.read ?? summary.read, icon: Eye, tone: 'teal' },
    { label: 'Replied', value: total.replied ?? summary.replied, icon: MessageSquareReply, tone: 'amber' },
    { label: 'Booked by WhatsApp bot', value: summary.botBooked ?? total.bookedByBot, icon: CalendarCheck, tone: 'moss' },
    { label: 'DORIS bookings', value: summary.bookingsAfterWhatsApp, icon: BarChart3, tone: 'moss', featured: true },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {cards.map(({ label, value, icon: Icon, tone, featured }) => (
        <div
          key={label}
          className={`rounded-xl border rule bg-[color:var(--color-canvas-raised)] p-4 transition-colors duration-150 hover:border-[color:var(--color-rule-strong)] ${
            featured ? 'ring-1 ring-[color:var(--color-moss)]/20' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-[color:var(--color-ink-3)]">{label}</p>
            <Icon size={15} strokeWidth={1.75} style={{ color: `var(--color-${tone})` }} />
          </div>
          <p className={`mt-3 font-display text-[34px] leading-none tabular-nums ${featured ? 'text-[color:var(--color-moss)]' : ''}`}>
            {formatNumber(value)}
          </p>
        </div>
      ))}
    </section>
  );
}

function PeriodCards({ stats }) {
  return (
    <section>
      <h2 className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-ink-4)]">
        Calendar periods
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {PERIODS.map(({ key, label, hint }) => (
          <div key={key} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-[color:var(--color-ink-3)]">{label}</p>
              <span className="text-[10px] text-[color:var(--color-ink-5)]">{hint}</span>
            </div>
            <p className="mt-3 font-display text-[36px] leading-none tabular-nums">
              {formatNumber(stats?.[key]?.sent)}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-4)]">
              {formatNumber(stats?.[key]?.replied)} replies
              {stats?.[key]?.replyRate !== undefined && (
                <span className="ml-2">{formatPercent(stats[key].replyRate)} reply rate</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Panel({ title, description, action, children }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b rule px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          {description && (
            <p className="mt-1 text-[12px] text-[color:var(--color-ink-3)]">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ViewToggle({ value, onChange, firstLabel, secondLabel }) {
  return (
    <div className="inline-flex rounded-lg border rule bg-[color:var(--color-canvas-sunk)] p-1">
      {[
        { key: 'chart', label: firstLabel, icon: BarChart3 },
        { key: 'table', label: secondLabel, icon: Table2 },
      ].map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors duration-150 ${
            value === key
              ? 'bg-[color:var(--color-canvas-raised)] text-[color:var(--color-ink)] shadow-sm'
              : 'text-[color:var(--color-ink-4)] hover:text-[color:var(--color-ink)]'
          }`}
        >
          <Icon size={13} strokeWidth={1.75} />
          {label}
        </button>
      ))}
    </div>
  );
}

function BookingsChart({ rows, bookings }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  const replied = bookings.filter((booking) => booking.customerReplied).length;

  return (
    <div className="p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <CompactStat label="Matched bookings" value={bookings.length} tone="moss" />
        <CompactStat label="Replied before booking" value={replied} tone="amber" />
        <CompactStat label="No reply before booking" value={bookings.length - replied} tone="teal" />
      </div>
      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[88px_1fr_34px] items-center gap-3">
            <span className="text-[11px] text-[color:var(--color-ink-4)]">{row.label}</span>
            <div className="h-8 overflow-hidden rounded-lg bg-[color:var(--color-canvas-sunk)]">
              <div
                className="h-full rounded-lg bg-[color:var(--color-moss)] transition-[width] duration-200"
                style={{ width: `${Math.max((row.count / max) * 100, 4)}%` }}
              />
            </div>
            <span className="text-right text-[12px] font-medium tabular-nums">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingsTable({ bookings, sort, onSortChange }) {
  return (
    <div>
      <TableToolbar
        label={`${bookings.length} bookings`}
        sortLabel={sort === 'desc' ? 'Newest first' : 'Oldest first'}
        onSortToggle={() => onSortChange(sort === 'desc' ? 'asc' : 'desc')}
      />
      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full text-left text-[12px]">
          <thead className="bg-[color:var(--color-canvas-sunk)]/70 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-ink-4)]">
            <tr>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-3 py-3 font-medium">Car</th>
              <th className="px-3 py-3 font-medium">Message sent</th>
              <th className="px-3 py-3 font-medium">DORIS booking</th>
              <th className="px-3 py-3 font-medium">After message</th>
              <th className="px-3 py-3 font-medium">After reply</th>
              <th className="px-3 py-3 font-medium">Appointment</th>
              <th className="px-5 py-3 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y rule">
            {bookings.map((booking) => (
              <tr key={`${booking.saleId}-${booking.registration}-${booking.customer_id}`} className="hover:bg-[color:var(--color-canvas-sunk)]/45">
                <td className="px-5 py-3">
                  <div className="font-medium text-[color:var(--color-ink)]">{booking.name}</div>
                  {booking.dorisName && booking.dorisName !== booking.name && (
                    <div className="mt-0.5 text-[10px] text-[color:var(--color-ink-4)]">
                      DORIS: {booking.dorisName}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="font-mono text-[11px]">{booking.registration}</div>
                  <div className="text-[10px] text-[color:var(--color-ink-4)]">{booking.station}</div>
                </td>
                <td className="px-3 py-3 text-[color:var(--color-ink-3)]">{booking.whatsappSentLocal}</td>
                <td className="px-3 py-3 text-[color:var(--color-ink-3)]">{booking.dorisBookingCreatedLocal}</td>
                <td className="px-3 py-3 font-medium text-[color:var(--color-moss)]">
                  {formatDuration(booking.minutesAfterWhatsApp)}
                </td>
                <td className="px-3 py-3">
                  {booking.minutesAfterReply !== null && booking.minutesAfterReply !== undefined ? (
                    <span className="font-medium text-[color:var(--color-amber)]">
                      {formatDuration(booking.minutesAfterReply)}
                    </span>
                  ) : (
                    <span className="text-[color:var(--color-ink-4)]">No reply</span>
                  )}
                </td>
                <td className="px-3 py-3 text-[color:var(--color-ink-3)]">{booking.appointmentLocal}</td>
                <td className="px-5 py-3">
                  <Badge tone={booking.confidence === 'high' ? 'green' : 'amber'}>
                    {booking.confidence === 'high' ? 'High' : 'Review'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BookingSummary({ summary }) {
  return (
    <aside className="space-y-4">
      <div className="card p-5">
        <h2 className="text-sm font-medium">Booking summary</h2>
        <div className="mt-4 rounded-xl bg-[color:var(--color-canvas-sunk)] p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--color-ink-4)]">
            Matched bookings
          </p>
          <p className="mt-2 font-display text-[50px] leading-none text-[color:var(--color-moss)]">
            {formatNumber(summary.totalAttributedBookings)}
          </p>
          <p className="mt-2 text-[12px] text-[color:var(--color-ink-3)]">
            {formatNumber(summary.botBooked)} by WhatsApp bot +{' '}
            {formatNumber(summary.bookingsAfterWhatsApp)} matched in DORIS.
          </p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-medium">Booking reply split</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <CompactStat label="Replied before booking" value={summary.bookingsAfterWhatsAppReplied} tone="amber" />
          <CompactStat label="No reply before booking" value={summary.bookingsAfterWhatsAppSilent} tone="teal" />
        </div>
      </div>
    </aside>
  );
}

function SendTimeChart({ rows }) {
  const maxReplyRate = Math.max(...rows.map((row) => row.replyRate || 0), 1);

  return (
    <div className="p-5">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="grid gap-2 sm:grid-cols-[92px_1fr_170px] sm:items-center">
            <div>
              <p className="font-medium">{row.key}:00</p>
              <p className="text-[10px] text-[color:var(--color-ink-4)]">{row.sent} sent</p>
            </div>
            <div className="h-8 overflow-hidden rounded-lg bg-[color:var(--color-canvas-sunk)]">
              <div
                className="h-full rounded-lg bg-[color:var(--color-amber)] transition-[width] duration-200"
                style={{ width: `${Math.max(((row.replyRate || 0) / maxReplyRate) * 100, 3)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniMetric label="Replies" value={row.replied} />
              <MiniMetric label="Rate" value={formatPercent(row.replyRate)} />
              <MiniMetric label="Bookings" value={row.totalAttributedBookings} tone="moss" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SendTimesTable({ windows, sort, onSortChange }) {
  return (
    <div>
      <TableToolbar
        label={`${windows.length} windows`}
        sortLabel={sort === 'desc' ? 'Highest reply rate' : 'Lowest reply rate'}
        onSortToggle={() => onSortChange(sort === 'desc' ? 'asc' : 'desc')}
      />
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-[12px]">
          <thead className="bg-[color:var(--color-canvas-sunk)]/70 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-ink-4)]">
            <tr>
              <th className="px-5 py-3 font-medium">Send time</th>
              <th className="px-3 py-3 font-medium">Sent</th>
              <th className="px-3 py-3 font-medium">Read</th>
              <th className="px-3 py-3 font-medium">Replies</th>
              <th className="px-3 py-3 font-medium">Reply rate</th>
              <th className="px-5 py-3 font-medium">Matched bookings</th>
            </tr>
          </thead>
          <tbody className="divide-y rule">
            {windows.map((window) => (
              <tr key={window.key} className="hover:bg-[color:var(--color-canvas-sunk)]/45">
                <td className="px-5 py-3 font-medium">{window.key}:00</td>
                <td className="px-3 py-3 tabular-nums">{formatNumber(window.sent)}</td>
                <td className="px-3 py-3 tabular-nums">{formatNumber(window.read)}</td>
                <td className="px-3 py-3 tabular-nums">{formatNumber(window.replied)}</td>
                <td className="px-3 py-3 font-medium tabular-nums text-[color:var(--color-amber)]">
                  {formatPercent(window.replyRate)}
                </td>
                <td className="px-5 py-3 font-medium tabular-nums text-[color:var(--color-moss)]">
                  {formatNumber(window.totalAttributedBookings)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableToolbar({ label, sortLabel, onSortToggle }) {
  return (
    <div className="flex items-center justify-between border-b rule bg-[color:var(--color-canvas-sunk)]/25 px-5 py-3">
      <Badge tone="neutral">{label}</Badge>
      <button
        type="button"
        onClick={onSortToggle}
        className="rounded-lg border rule bg-[color:var(--color-canvas-raised)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--color-ink-3)] transition-colors duration-150 hover:text-[color:var(--color-ink)]"
      >
        {sortLabel}
      </button>
    </div>
  );
}

function CompactStat({ label, value, tone }) {
  return (
    <div className="rounded-xl border rule bg-[color:var(--color-canvas-sunk)]/60 p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-ink-4)]">
        {label}
      </p>
      <p className="mt-2 font-display text-[30px] leading-none" style={{ color: `var(--color-${tone})` }}>
        {formatNumber(value)}
      </p>
    </div>
  );
}

function MiniMetric({ label, value, tone }) {
  return (
    <div className="rounded-lg border rule bg-[color:var(--color-canvas-raised)] px-2 py-1.5">
      <p className="text-[9px] text-[color:var(--color-ink-4)]">{label}</p>
      <p className={`mt-0.5 font-medium tabular-nums ${tone === 'moss' ? 'text-[color:var(--color-moss)]' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
      <Skeleton className="h-72" />
    </div>
  );
}

function buildBookingChartRows(bookings) {
  const grouped = new Map();
  for (const booking of bookings) {
    const key = dateKey(booking.dorisBookingCreatedAt);
    if (!grouped.has(key)) grouped.set(key, { key, label: shortDate(booking.dorisBookingCreatedAt), count: 0 });
    grouped.get(key).count++;
  }
  return Array.from(grouped.values()).sort((a, b) => new Date(b.key) - new Date(a.key));
}

function dateKey(value) {
  if (!value) return 'unknown';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const keyed = {};
  for (const part of parts) keyed[part.type] = part.value;
  return `${keyed.year}-${keyed.month}-${keyed.day}`;
}

function shortDate(value) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Helsinki',
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function formatLocal(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Helsinki',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-GB');
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(Number(value || 0) % 1 ? 1 : 0)}%`;
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `${days}d ${rest}h` : `${days}d`;
}
