import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Send,
  MessageSquareReply,
  Percent,
  Search,
  ChevronRight,
  Rocket,
  Loader2,
  Users,
  Phone,
  CheckCheck,
  Eye,
  ArrowUpDown,
} from 'lucide-react';
import { fetchStats, fetchCustomers, triggerFeeder, pollMessageStatuses } from '../lib/api.js';
import { relativeTime, formatPhone } from '../lib/format.js';
import StatusPill from '../components/ui/StatusPill.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <StatsBar />
      <FeederControl />
      <CustomerList />
    </div>
  );
}

function StatsBar() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    pollMessageStatuses().catch(() => {});
    const id = setInterval(() => pollMessageStatuses().catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Sent', value: data?.total?.sent ?? 0, icon: Send, tone: 'clay' },
    { label: 'Delivered', value: data?.total?.delivered ?? 0, icon: CheckCheck, tone: 'amber' },
    { label: 'Read', value: data?.total?.read ?? 0, icon: Eye, tone: 'moss' },
    { label: 'Replied', value: data?.total?.replied ?? 0, icon: MessageSquareReply, tone: 'moss' },
    { label: 'Reply Rate', value: `${data?.total?.replyRate ?? 0}%`, icon: Percent, tone: 'amber' },
    { label: 'This Week', value: data?.week?.sent ?? 0, sub: `${data?.week?.replied ?? 0} replies`, icon: Users, tone: 'clay' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="card px-4 py-3.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-[color:var(--color-ink-4)] uppercase tracking-[0.12em]">
              {c.label}
            </span>
            <c.icon size={14} className={`text-[color:var(--color-${c.tone})]`} strokeWidth={1.75} />
          </div>
          <span className="font-display text-[22px] font-semibold text-[color:var(--color-ink)] leading-none">{c.value}</span>
          {c.sub && <span className="text-[10px] text-[color:var(--color-ink-4)]">{c.sub}</span>}
        </div>
      ))}
    </div>
  );
}

function FeederControl() {
  const queryClient = useQueryClient();
  const [count, setCount] = useState(50);
  const [result, setResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const COST_PER_MSG = 0.05;

  const mutation = useMutation({
    mutationFn: () => triggerFeeder(count),
    onSuccess: () => {
      setResult({ ok: true, msg: `Triggered ${count} leads` });
      setShowConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => {
      setResult({ ok: false, msg: err.response?.data?.error || err.message });
      setShowConfirm(false);
    },
  });

  return (
    <div className="card px-5 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-[color:var(--color-ink)]">Send Campaigns</h3>
          <p className="text-[11px] text-[color:var(--color-ink-4)] mt-0.5">
            Trigger the feeder to contact new leads via WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[11px] text-[color:var(--color-ink-3)]">
            Leads
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-20 rounded-lg border rule bg-[color:var(--color-canvas)] px-3 py-1.5 text-sm text-[color:var(--color-ink)] focus:border-[color:var(--color-clay)] focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-clay)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Rocket size={14} />
            )}
            Send
          </button>
        </div>
      </div>
      {result && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-[11px] font-medium ${
            result.ok
              ? 'bg-[color:var(--color-moss-soft)] text-[color:var(--color-moss)]'
              : 'bg-[color:var(--color-sienna-soft)] text-[color:var(--color-sienna)]'
          }`}
        >
          {result.msg}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="card mx-4 w-full max-w-sm px-6 py-5 shadow-xl">
            <h3 className="text-base font-display font-semibold text-[color:var(--color-ink)]">
              Confirm Campaign
            </h3>
            <div className="mt-3 space-y-2 text-[13px] text-[color:var(--color-ink-3)]">
              <div className="flex justify-between">
                <span>Recipients</span>
                <span className="font-medium text-[color:var(--color-ink)]">{count} people</span>
              </div>
              <div className="flex justify-between">
                <span>Cost per message</span>
                <span className="font-medium text-[color:var(--color-ink)]">${COST_PER_MSG.toFixed(2)}</span>
              </div>
              <div className="border-t rule my-2" />
              <div className="flex justify-between">
                <span className="font-medium text-[color:var(--color-ink)]">Estimated total</span>
                <span className="font-display font-semibold text-[color:var(--color-ink)]">
                  ${(count * COST_PER_MSG).toFixed(2)}
                </span>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-[color:var(--color-ink-4)]">
              This will send WhatsApp template messages to up to {count} new customers. Are you sure?
            </p>
            <div className="mt-4 flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border rule px-4 py-2 text-sm font-medium text-[color:var(--color-ink-3)] transition-colors hover:bg-[color:var(--color-canvas-sunk)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-clay)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {mutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Confirm Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerList() {
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || '';
  const sortBy = searchParams.get('sort') || 'last_outbound_at';

  const setStatusFilter = (val) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set('status', val); else next.delete('status');
    setSearchParams(next, { replace: true });
  };
  const setSortBy = (val) => {
    const next = new URLSearchParams(searchParams);
    if (val && val !== 'last_outbound_at') next.set('sort', val); else next.delete('sort');
    setSearchParams(next, { replace: true });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['customers', statusFilter],
    queryFn: () => fetchCustomers({ status: statusFilter || undefined }),
  });

  const customers = data?.customers || [];

  const filtered = search
    ? customers.filter(
        (c) =>
          c.number?.includes(search) ||
          c.name?.toLowerCase().includes(search.toLowerCase()) ||
          String(c.customer_id).includes(search)
      )
    : customers;

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortBy] || '';
    const bVal = b[sortBy] || '';
    if (!aVal && !bVal) return 0;
    if (!aVal) return 1;
    if (!bVal) return -1;
    return new Date(bVal) - new Date(aVal);
  });

  return (
    <div className="card overflow-hidden">
      <div className="border-b rule px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <h3 className="text-sm font-medium text-[color:var(--color-ink)] flex-1">
          Customers
          {data && (
            <span className="ml-2 text-[11px] font-normal text-[color:var(--color-ink-4)]">
              {filtered.length}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--color-ink-4)]"
            />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 rounded-lg border rule bg-[color:var(--color-canvas)] pl-8 pr-3 py-1.5 text-[11px] text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-4)] focus:border-[color:var(--color-clay)] focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border rule bg-[color:var(--color-canvas)] px-3 py-1.5 text-[11px] text-[color:var(--color-ink)] focus:border-[color:var(--color-clay)] focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="replied">Replied</option>
            <option value="sent">Sent</option>
            <option value="stopped">Stopped</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border rule bg-[color:var(--color-canvas)] px-3 py-1.5 text-[11px] text-[color:var(--color-ink)] focus:border-[color:var(--color-clay)] focus:outline-none"
          >
            <option value="last_outbound_at">Last sent</option>
            <option value="last_inbound_at">Last replied</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={Users} title="No customers" hint="Trigger the feeder to start contacting leads." />
      ) : (
        <div className="divide-y divide-[color:var(--color-rule)]">
          {sorted.map((c) => (
            <Link
              key={c.number}
              to={`/customers/${c.number}`}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[color:var(--color-canvas-sunk)]/60"
            >
              <div className="size-9 rounded-full bg-[color:var(--color-canvas-sunk)] grid place-items-center text-[color:var(--color-ink-4)]">
                <Phone size={14} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[color:var(--color-ink)] truncate">
                    {c.name || formatPhone(c.number)}
                  </span>
                  <StatusPill status={c.status} />
                </div>
                <div className="text-[11px] text-[color:var(--color-ink-4)] truncate">
                  {formatPhone(c.number)}
                  {c.reminder_stage && <span className="ml-2">{c.reminder_stage}</span>}
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-[11px] text-[color:var(--color-ink-3)]">
                  {relativeTime(c.last_outbound_at)}
                </div>
                {c.last_inbound_at && (
                  <div className="text-[10px] text-[color:var(--color-moss)]">
                    replied {relativeTime(c.last_inbound_at)}
                  </div>
                )}
              </div>
              <ChevronRight size={14} className="text-[color:var(--color-ink-5)]" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
