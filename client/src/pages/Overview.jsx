import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  ChevronRight,
  Users,
  Phone,
  ArrowUpDown,
} from 'lucide-react';
import { fetchCustomers } from '../lib/api.js';
import { relativeTime, formatPhone } from '../lib/format.js';
import StatusPill from '../components/ui/StatusPill.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function CustomersPage() {
  return <CustomerList />;
}

function CustomerList() {
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || '';
  const campaignFilter = searchParams.get('campaign') || '';
  const sortBy = searchParams.get('sort') || 'last_outbound_at';

  const setStatusFilter = (val) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set('status', val); else next.delete('status');
    setSearchParams(next, { replace: true });
  };
  const setCampaignFilter = (val) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set('campaign', val); else next.delete('campaign');
    setSearchParams(next, { replace: true });
  };
  const setSortBy = (val) => {
    const next = new URLSearchParams(searchParams);
    if (val && val !== 'last_outbound_at') next.set('sort', val); else next.delete('sort');
    setSearchParams(next, { replace: true });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['customers', statusFilter, campaignFilter],
    queryFn: () => fetchCustomers({
      status: statusFilter || undefined,
      campaign: campaignFilter || undefined,
    }),
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
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="font-display text-[28px] sm:text-[34px] leading-none font-medium tracking-tight text-balance">
          Customers
        </h1>
        <p className="mt-1.5 sm:mt-2 text-[13px] sm:text-sm text-[color:var(--color-ink-3)]">
          Everyone contacted via WhatsApp.{' '}
          {customers.length > 0 && (
            <span className="text-[color:var(--color-ink-4)]">
              {customers.length} total.
            </span>
          )}
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b rule px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 sm:flex-initial">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--color-ink-4)]"
              />
              <input
                type="text"
                placeholder="Search name, phone, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-48 rounded-lg border rule bg-[color:var(--color-canvas)] pl-8 pr-3 py-1.5 text-[11px] text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-4)] focus:border-[color:var(--color-clay)] focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="rounded-lg border rule bg-[color:var(--color-canvas)] px-3 py-1.5 text-[11px] text-[color:var(--color-ink)] focus:border-[color:var(--color-clay)] focus:outline-none"
            >
              <option value="">All campaigns</option>
              <option value="passed">Passed (lapsed)</option>
              <option value="due_soon">Due soon</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border rule bg-[color:var(--color-canvas)] px-3 py-1.5 text-[11px] text-[color:var(--color-ink)] focus:border-[color:var(--color-clay)] focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="booked">Booked</option>
              <option value="replied">Replied</option>
              <option value="read">Read</option>
              <option value="delivered">Delivered</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
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
          <EmptyState icon={Users} title="No customers" hint="Trigger the feeder from Stats to start contacting leads." />
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
                    {c.campaign_type && (
                      <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-ink-4)]">
                        {c.campaign_type === 'passed' ? 'Lapsed' : 'Due Soon'}
                      </span>
                    )}
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
    </div>
  );
}
