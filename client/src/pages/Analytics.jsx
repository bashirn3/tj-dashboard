import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCheck,
  Eye,
  MessageCircle,
  Send,
} from 'lucide-react';
import { fetchAnalytics } from '../lib/api.js';
import Badge from '../components/ui/Badge.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function AnalyticsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) return <AnalyticsSkeleton />;
  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Analytics could not load"
        hint={error?.message || 'Check the API logs and try again.'}
      />
    );
  }

  const summary = data?.summary || {};
  const bookings = data?.bookingsAfterWhatsApp || [];
  const sendWindows = data?.bestSendWindows || [];
  const timing = data?.replyTiming || {};

  return (
    <div className="space-y-6">
      <PageHeader generatedAt={data?.generated_at} doris={data?.doris} />
      <ResultCards summary={summary} />

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <BookingsTable bookings={bookings} />
        <SidePanel summary={summary} timing={timing} />
      </section>

      <SendTimesTable windows={sendWindows} />
    </div>
  );
}

function PageHeader({ generatedAt, doris }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[32px] leading-none font-medium tracking-tight sm:text-[40px]">
          Analytics
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--color-ink-3)]">
          Customer replies and DORIS bookings after outreach.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--color-ink-4)]">
        {!doris?.ok && <Badge tone="sienna">DORIS refresh failed</Badge>}
        {generatedAt && <span>Updated {formatLocal(generatedAt)}</span>}
      </div>
    </header>
  );
}

function ResultCards({ summary }) {
  const cards = [
    { label: 'Sent', value: summary.contacted, icon: Send, tone: 'clay' },
    { label: 'Read', value: summary.read, icon: Eye, tone: 'teal' },
    { label: 'Replied', value: summary.replied, icon: MessageCircle, tone: 'amber' },
    { label: 'Bot booked', value: summary.botBooked, icon: CalendarCheck, tone: 'moss' },
    {
      label: 'DORIS bookings',
      value: summary.bookingsAfterWhatsApp,
      icon: CheckCheck,
      tone: 'moss',
      featured: true,
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(({ label, value, icon: Icon, tone, featured }) => (
        <div
          key={label}
          className={`rounded-xl border rule bg-[color:var(--color-canvas-raised)] p-4 ${
            featured ? 'ring-1 ring-[color:var(--color-moss)]/25' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-[color:var(--color-ink-3)]">{label}</p>
            <Icon size={15} strokeWidth={1.75} style={{ color: `var(--color-${tone})` }} />
          </div>
          <p className={`mt-3 font-display text-[40px] leading-none tabular-nums ${featured ? 'text-[color:var(--color-moss)]' : ''}`}>
            {formatNumber(value)}
          </p>
        </div>
      ))}
    </section>
  );
}

function SidePanel({ summary, timing }) {
  return (
    <aside className="space-y-4">
      <div className="card p-5">
        <h2 className="text-sm font-medium">What counts here?</h2>
        <p className="mt-2 text-[12px] leading-5 text-[color:var(--color-ink-3)]">
          Bookings created in DORIS after a message was sent for the same registration.
        </p>
        <div className="mt-4 rounded-xl bg-[color:var(--color-canvas-sunk)] p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--color-ink-4)]">
            Matched bookings
          </p>
          <p className="mt-2 font-display text-[52px] leading-none text-[color:var(--color-moss)]">
            {formatNumber(summary.totalAttributedBookings)}
          </p>
          <p className="mt-2 text-[12px] text-[color:var(--color-ink-3)]">
            {formatNumber(summary.botBooked)} by bot +{' '}
            {formatNumber(summary.bookingsAfterWhatsApp)} matched in DORIS.
          </p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-medium">Booking reply split</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <SmallNumber label="Replied before booking" value={summary.bookingsAfterWhatsAppReplied} tone="amber" />
          <SmallNumber label="No reply before booking" value={summary.bookingsAfterWhatsAppSilent} tone="moss" />
        </div>
        <p className="mt-3 text-[12px] leading-5 text-[color:var(--color-ink-3)]">
          Based on whether the customer replied before the matched DORIS booking.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-medium">Reply timing</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <SmallNumber label="Under 15 min" value={timing.under15m} tone="moss" />
          <SmallNumber label="Under 60 min" value={timing.under60m} tone="amber" />
        </div>
        <p className="mt-3 text-[12px] text-[color:var(--color-ink-3)]">
          Median reply time: {formatDuration(timing.medianReplyMinutes)}.
        </p>
      </div>
    </aside>
  );
}

function BookingsTable({ bookings }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b rule px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-medium">DORIS Bookings After Outreach</h2>
            <p className="mt-1 text-[12px] text-[color:var(--color-ink-3)]">
              Bookings created in DORIS after outreach for the same registration.
            </p>
          </div>
          <Badge tone="moss">{bookings.length} bookings</Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full text-left text-[12px]">
          <thead className="bg-[color:var(--color-canvas-sunk)]/70 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-ink-4)]">
            <tr>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-3 py-3 font-medium">Car</th>
              <th className="px-3 py-3 font-medium">WhatsApp sent</th>
              <th className="px-3 py-3 font-medium">DORIS booking</th>
              <th className="px-3 py-3 font-medium">Time after</th>
              <th className="px-3 py-3 font-medium">Chat</th>
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
                  <Badge tone={booking.customerReplied ? 'amber' : 'teal'}>
                    {booking.customerReplied ? 'Replied' : 'No reply'}
                  </Badge>
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
    </section>
  );
}

function SendTimesTable({ windows }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b rule px-5 py-4">
        <h2 className="text-sm font-medium">Send-Time Performance</h2>
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-3)]">
          Message volume, replies, and matched DORIS bookings by send window.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-left text-[12px]">
          <thead className="bg-[color:var(--color-canvas-sunk)]/70 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-ink-4)]">
            <tr>
              <th className="px-5 py-3 font-medium">Send time</th>
              <th className="px-3 py-3 font-medium">Sent</th>
              <th className="px-3 py-3 font-medium">Read</th>
              <th className="px-3 py-3 font-medium">Replies</th>
              <th className="px-3 py-3 font-medium">Reply rate</th>
              <th className="px-5 py-3 font-medium">Bookings</th>
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
    </section>
  );
}

function SmallNumber({ label, value, tone }) {
  return (
    <div className="rounded-xl border rule bg-[color:var(--color-canvas-sunk)]/65 p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-ink-4)]">
        {label}
      </p>
      <p className="mt-2 font-display text-[34px] leading-none" style={{ color: `var(--color-${tone})` }}>
        {formatNumber(value)}
      </p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-96" />
      <Skeleton className="h-72" />
    </div>
  );
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
