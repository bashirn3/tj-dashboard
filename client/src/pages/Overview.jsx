import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Send,
  MessageSquareReply,
  Percent,
  Search,
  ChevronRight,
  Rocket,
  OctagonX,
  Loader2,
  Users,
  Phone,
} from 'lucide-react';
import { fetchStats, fetchCustomers, triggerFeeder } from '../lib/api.js';
import { relativeTime, formatPhone, STATUS_META } from '../lib/format.js';
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
  const { data, isLoading } = useQuery({ queryKey: ['stats'], queryFn: fetchStats });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total Sent', value: data?.total?.sent ?? 0, icon: Send, color: 'primary' },
    { label: 'Total Replied', value: data?.total?.replied ?? 0, icon: MessageSquareReply, color: 'green' },
    { label: 'Reply Rate', value: `${data?.total?.replyRate ?? 0}%`, icon: Percent, color: 'amber' },
    { label: 'This Week', value: data?.week?.sent ?? 0, sub: `${data?.week?.replied ?? 0} replies`, icon: Users, color: 'primary' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="card px-4 py-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[color:var(--color-ink-3)] uppercase tracking-wider">
              {c.label}
            </span>
            <c.icon size={16} className={`text-[color:var(--color-${c.color})]`} strokeWidth={1.75} />
          </div>
          <span className="text-2xl font-bold text-[color:var(--color-ink)] leading-none">{c.value}</span>
          {c.sub && <span className="text-xs text-[color:var(--color-ink-4)]">{c.sub}</span>}
        </div>
      ))}
    </div>
  );
}

function FeederControl() {
  const queryClient = useQueryClient();
  const [count, setCount] = useState(50);
  const [result, setResult] = useState(null);

  const mutation = useMutation({
    mutationFn: () => triggerFeeder(count),
    onSuccess: (data) => {
      setResult({ ok: true, msg: `Triggered ${count} leads` });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => {
      setResult({ ok: false, msg: err.response?.data?.error || err.message });
    },
  });

  return (
    <div className="card px-5 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">Send Campaigns</h3>
          <p className="text-xs text-[color:var(--color-ink-3)] mt-0.5">
            Trigger the feeder workflow to contact new leads via WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[color:var(--color-ink-3)]">
            Leads
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-20 rounded-lg border rule bg-[color:var(--color-canvas)] px-3 py-1.5 text-sm text-[color:var(--color-ink)] focus:border-[color:var(--color-primary)] focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
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
          className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
            result.ok
              ? 'bg-[color:var(--color-green-soft)] text-[color:var(--color-green)]'
              : 'bg-[color:var(--color-red-soft)] text-[color:var(--color-red)]'
          }`}
        >
          {result.msg}
        </div>
      )}
    </div>
  );
}

function CustomerList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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

  return (
    <div className="card overflow-hidden">
      <div className="border-b rule px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <h3 className="text-sm font-semibold text-[color:var(--color-ink)] flex-1">
          Customers
          {data && (
            <span className="ml-2 text-xs font-normal text-[color:var(--color-ink-4)]">
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
              className="w-48 rounded-lg border rule bg-[color:var(--color-canvas)] pl-8 pr-3 py-1.5 text-xs text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-4)] focus:border-[color:var(--color-primary)] focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border rule bg-[color:var(--color-canvas)] px-3 py-1.5 text-xs text-[color:var(--color-ink)] focus:border-[color:var(--color-primary)] focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="replied">Replied</option>
            <option value="sent">Sent</option>
            <option value="stopped">Stopped</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No customers" hint="Trigger the feeder to start contacting leads." />
      ) : (
        <div className="divide-y divide-[color:var(--color-rule)]">
          {filtered.map((c) => (
            <Link
              key={c.number}
              to={`/customers/${c.number}`}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[color:var(--color-canvas-sunk)]"
            >
              <div className="size-9 rounded-full bg-[color:var(--color-canvas-sunk)] grid place-items-center text-[color:var(--color-ink-4)]">
                <Phone size={14} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[color:var(--color-ink)] truncate">
                    {c.name || formatPhone(c.number)}
                  </span>
                  <StatusPill status={c.status} />
                </div>
                <div className="text-xs text-[color:var(--color-ink-4)] truncate">
                  {formatPhone(c.number)}
                  {c.reminder_stage && <span className="ml-2">{c.reminder_stage}</span>}
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs text-[color:var(--color-ink-3)]">
                  {relativeTime(c.last_outbound_at)}
                </div>
              </div>
              <ChevronRight size={14} className="text-[color:var(--color-ink-5)]" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
