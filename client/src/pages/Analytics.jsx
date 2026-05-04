import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCheck,
  Clock,
  Eye,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { fetchAnalytics } from '../lib/api.js';
import Badge from '../components/ui/Badge.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

const METRICS = [
  { key: 'contacted', label: 'Contacted', icon: Send, tone: 'clay' },
  { key: 'delivered', label: 'Delivered', icon: CheckCheck, tone: 'amber' },
  { key: 'read', label: 'Read', icon: Eye, tone: 'teal' },
  { key: 'replied', label: 'Replied', icon: MessageCircle, tone: 'amber' },
  { key: 'botBooked', label: 'Bot booked', icon: CalendarCheck, tone: 'moss' },
  { key: 'bookingsAfterWhatsApp', label: 'Bookings after WhatsApp', icon: Target, tone: 'moss' },
];

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
  const bestWindows = data?.bestSendWindows || [];
  const timing = data?.replyTiming || {};

  return (
    <div className="space-y-6 sm:space-y-8">
      <Hero summary={summary} generatedAt={data?.generated_at} doris={data?.doris} />
      <MetricGrid summary={summary} />
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Funnel summary={summary} />
        <ReplySpeed timing={timing} />
      </div>
      <TopWins bookings={bookings} />
      <BestSendTimes windows={bestWindows} />
      <BookingsTable bookings={bookings} />
    </div>
  );
}

function Hero({ summary, generatedAt, doris }) {
  return (
    <section
      className="relative overflow-hidden rounded-[24px] border rule-strong bg-[color:var(--color-canvas-raised)] px-5 py-6 sm:px-8 sm:py-8"
      style={{
        background:
          'radial-gradient(circle at top left, color-mix(in srgb, var(--color-moss) 18%, transparent), transparent 34%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--color-clay) 16%, transparent), transparent 38%), var(--color-canvas-raised)',
      }}
    >
      <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
        <div>
          <Badge tone="moss" dot>
            Campaign impact
          </Badge>
          <h1 className="mt-4 max-w-3xl font-display text-[38px] leading-[0.95] tracking-tight sm:text-[56px]">
            WhatsApp did more than the bot booking number shows.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[color:var(--color-ink-3)] sm:text-[15px]">
            This page attributes DORIS bookings to WhatsApp when the same registration was booked
            after the message was sent.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="green">
              {summary.highConfidenceBookings || 0} high confidence
            </Badge>
            {(summary.reviewBookings || 0) > 0 && (
              <Badge tone="amber">{summary.reviewBookings} needs review</Badge>
            )}
            {!doris?.ok && <Badge tone="sienna">DORIS refresh failed</Badge>}
          </div>
        </div>

        <div className="rounded-2xl border rule bg-[color:var(--color-canvas)]/70 p-5 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-ink-4)]">
                Total attributed bookings
              </p>
              <p className="mt-3 font-display text-[64px] leading-none text-[color:var(--color-moss)]">
                {formatNumber(summary.totalAttributedBookings)}
              </p>
            </div>
            <div className="grid size-11 place-items-center rounded-full border rule text-[color:var(--color-moss)]">
              <Sparkles size={20} strokeWidth={1.75} />
            </div>
          </div>
          <p className="mt-4 text-sm text-[color:var(--color-ink-3)]">
            {formatNumber(summary.botBooked)} bot booked +{' '}
            {formatNumber(summary.bookingsAfterWhatsApp)} DORIS bookings after WhatsApp.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border rule bg-[color:var(--color-canvas-sunk)]/55 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-ink-4)]">
                Replied first
              </p>
              <p className="mt-1 font-display text-[28px] leading-none text-[color:var(--color-amber)]">
                {formatNumber(summary.bookingsAfterWhatsAppReplied)}
              </p>
            </div>
            <div className="rounded-xl border rule bg-[color:var(--color-canvas-sunk)]/55 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-ink-4)]">
                Silent bookings
              </p>
              <p className="mt-1 font-display text-[28px] leading-none text-[color:var(--color-moss)]">
                {formatNumber(summary.bookingsAfterWhatsAppSilent)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t rule pt-3 text-[11px] text-[color:var(--color-ink-4)]">
            <span>Impact rate</span>
            <span className="font-medium text-[color:var(--color-ink)]">
              {formatPercent(summary.attributedBookingRate)}
            </span>
          </div>
          {generatedAt && (
            <p className="mt-2 text-[10px] text-[color:var(--color-ink-5)]">
              Refreshed {formatLocal(generatedAt)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function MetricGrid({ summary }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {METRICS.map(({ key, label, icon: Icon, tone }) => (
        <div key={key} className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-[color:var(--color-ink-4)]">{label}</p>
            <Icon size={15} strokeWidth={1.75} style={{ color: `var(--color-${tone})` }} />
          </div>
          <p className="mt-3 font-display text-[34px] leading-none tabular-nums">
            {formatNumber(summary[key])}
          </p>
        </div>
      ))}
    </section>
  );
}

function Funnel({ summary }) {
  const steps = [
    { label: 'Contacted', value: summary.contacted, tone: 'clay' },
    { label: 'Delivered', value: summary.delivered, tone: 'amber' },
    { label: 'Read', value: summary.read, tone: 'teal' },
    { label: 'Replied', value: summary.replied, tone: 'amber' },
    { label: 'Attributed bookings', value: summary.totalAttributedBookings, tone: 'moss' },
  ];
  const max = Math.max(summary.contacted || 0, 1);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Attribution funnel</h2>
          <p className="mt-1 text-[11px] text-[color:var(--color-ink-4)]">
            From sent WhatsApp to measured DORIS booking impact.
          </p>
        </div>
        <TrendingUp size={18} strokeWidth={1.75} className="text-[color:var(--color-moss)]" />
      </div>

      <div className="mt-5 space-y-3">
        {steps.map((step) => (
          <div key={step.label}>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-[color:var(--color-ink-3)]">{step.label}</span>
              <span className="font-medium tabular-nums text-[color:var(--color-ink)]">
                {formatNumber(step.value)} · {formatPercent(percentOf(step.value, max))}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[color:var(--color-canvas-sunk)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(percentOf(step.value, max), 2)}%`,
                  backgroundColor: `var(--color-${step.tone})`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReplySpeed({ timing }) {
  const replied = timing.replied || 0;
  const cards = [
    { label: 'Under 15 min', value: timing.under15m, tone: 'moss' },
    { label: 'Under 60 min', value: timing.under60m, tone: 'amber' },
    { label: 'Median reply', value: formatDuration(timing.medianReplyMinutes), tone: 'teal', text: true },
  ];

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Reply speed</h2>
          <p className="mt-1 text-[11px] text-[color:var(--color-ink-4)]">
            Most replies arrive while the message is still fresh.
          </p>
        </div>
        <Zap size={18} strokeWidth={1.75} className="text-[color:var(--color-amber)]" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border rule bg-[color:var(--color-canvas)] p-3">
            <p className="text-[10px] text-[color:var(--color-ink-4)]">{card.label}</p>
            <p
              className={`mt-2 font-display leading-none ${card.text ? 'text-[28px]' : 'text-[34px]'}`}
              style={{ color: `var(--color-${card.tone})` }}
            >
              {card.text ? card.value : formatNumber(card.value)}
            </p>
            {!card.text && (
              <p className="mt-1 text-[10px] text-[color:var(--color-ink-5)]">
                {formatPercent(percentOf(card.value, replied))} of replies
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--color-ink-4)]">
          When replies came in
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(timing.distribution || []).slice(0, 6).map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-lg bg-[color:var(--color-canvas-sunk)] px-3 py-2">
              <span className="text-[11px] text-[color:var(--color-ink-3)]">{item.key}:00</span>
              <span className="text-[12px] font-medium tabular-nums">{item.replies}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TopWins({ bookings }) {
  const wins = bookings.slice(0, 3);
  if (wins.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Fastest wins</h2>
          <p className="mt-1 text-[11px] text-[color:var(--color-ink-4)]">
            The clearest examples of WhatsApp influence.
          </p>
        </div>
        <Badge tone="green">Proof points</Badge>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {wins.map((booking, index) => (
          <div key={`${booking.saleId}-${booking.registration}`} className="relative overflow-hidden rounded-2xl border rule bg-[color:var(--color-canvas-raised)] p-5">
            <div className="absolute right-4 top-4 font-display text-[48px] leading-none text-[color:var(--color-canvas-sunk)]">
              {index + 1}
            </div>
            <Badge tone={booking.confidence === 'high' ? 'green' : 'amber'}>
              {booking.confidence === 'high' ? 'High confidence' : 'Review'}
            </Badge>
            <p className="mt-4 text-lg font-medium">{booking.name}</p>
            <p className="text-[12px] text-[color:var(--color-ink-4)]">
              {booking.registration} · {booking.station}
            </p>
            <p className="mt-4 font-display text-[36px] leading-none text-[color:var(--color-moss)]">
              {formatDuration(booking.minutesAfterWhatsApp)}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-4)]">
              from WhatsApp sent to DORIS booking created
            </p>
            <div className="mt-4">
              <Badge tone={booking.customerReplied ? 'amber' : 'teal'}>
                {booking.customerReplied ? 'Replied first' : 'Silent booking'}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BestSendTimes({ windows }) {
  const top = windows || [];
  const maxReplyRate = Math.max(...top.map((item) => item.replyRate || 0), 1);

  return (
    <section className="card overflow-hidden">
      <div className="border-b rule px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Best send windows</h2>
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-4)]">
              Ranked by reply rate, with attributed bookings included.
            </p>
          </div>
          <Clock size={18} strokeWidth={1.75} className="text-[color:var(--color-amber)]" />
        </div>
      </div>

      <div className="divide-y rule">
        {top.map((window) => (
          <div key={window.key} className="grid gap-3 px-5 py-4 sm:grid-cols-[92px_1fr_220px] sm:items-center">
            <div>
              <p className="font-display text-[26px] leading-none">{window.key}:00</p>
              <p className="mt-1 text-[10px] text-[color:var(--color-ink-4)]">{window.sent} sent</p>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-[color:var(--color-ink-4)]">Reply rate</span>
                <span className="font-medium">{formatPercent(window.replyRate)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[color:var(--color-canvas-sunk)]">
                <div
                  className="h-full rounded-full bg-[color:var(--color-amber)]"
                  style={{ width: `${Math.max((window.replyRate / maxReplyRate) * 100, 3)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Read" value={window.read} />
              <MiniStat label="Replies" value={window.replied} />
              <MiniStat label="Bookings" value={window.totalAttributedBookings} tone="moss" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BookingsTable({ bookings }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b rule px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-medium">Bookings after WhatsApp</h2>
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-4)]">
              Same registration booked in DORIS after WhatsApp outreach.
            </p>
          </div>
          <Badge tone="moss">{bookings.length} attributed</Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-[12px]">
          <thead className="bg-[color:var(--color-canvas-sunk)]/70 text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-ink-4)]">
            <tr>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-3 py-3 font-medium">Reg</th>
              <th className="px-3 py-3 font-medium">WhatsApp sent</th>
              <th className="px-3 py-3 font-medium">DORIS booked</th>
              <th className="px-3 py-3 font-medium">After</th>
              <th className="px-3 py-3 font-medium">Engagement</th>
              <th className="px-3 py-3 font-medium">Appointment</th>
              <th className="px-3 py-3 font-medium">Station</th>
              <th className="px-5 py-3 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y rule">
            {bookings.map((booking) => (
              <tr key={`${booking.saleId}-${booking.registration}-${booking.customer_id}`} className="hover:bg-[color:var(--color-canvas-sunk)]/45">
                <td className="px-5 py-3">
                  <div className="font-medium text-[color:var(--color-ink)]">{booking.name}</div>
                  {booking.dorisName && booking.dorisName !== booking.name && (
                    <div className="text-[10px] text-[color:var(--color-ink-4)]">
                      DORIS: {booking.dorisName}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 font-mono text-[11px]">{booking.registration}</td>
                <td className="px-3 py-3 text-[color:var(--color-ink-3)]">{booking.whatsappSentLocal}</td>
                <td className="px-3 py-3 text-[color:var(--color-ink-3)]">{booking.dorisBookingCreatedLocal}</td>
                <td className="px-3 py-3">
                  <span className="font-medium text-[color:var(--color-moss)]">
                    {formatDuration(booking.minutesAfterWhatsApp)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <Badge tone={booking.customerReplied ? 'amber' : 'teal'}>
                    {booking.customerReplied ? 'Replied' : 'Silent'}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-[color:var(--color-ink-3)]">{booking.appointmentLocal}</td>
                <td className="px-3 py-3 text-[color:var(--color-ink-3)]">{booking.station}</td>
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

function MiniStat({ label, value, tone = 'neutral' }) {
  return (
    <div className="rounded-lg border rule bg-[color:var(--color-canvas)] px-2 py-2">
      <p className="text-[10px] text-[color:var(--color-ink-4)]">{label}</p>
      <p className={`mt-1 font-display text-[22px] leading-none tabular-nums ${tone === 'moss' ? 'text-[color:var(--color-moss)]' : ''}`}>
        {formatNumber(value)}
      </p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-72 rounded-[24px]" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
      <Skeleton className="h-96" />
    </div>
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-GB');
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(Number(value || 0) % 1 ? 1 : 0)}%`;
}

function percentOf(value, total) {
  if (!total) return 0;
  return Math.round((Number(value || 0) * 1000) / total) / 10;
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
