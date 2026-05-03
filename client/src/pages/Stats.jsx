import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  MessageSquareReply,
  Percent,
  Rocket,
  Loader2,
  Users,
  CheckCheck,
  Eye,
  Activity,
  OctagonX,
  CalendarCheck,
  Timer,
  Clock,
} from 'lucide-react';
import { fetchStats, triggerFeeder, pollMessageStatuses, getAutoSend, setAutoSend, getFeederProgress } from '../lib/api.js';
import Skeleton from '../components/ui/Skeleton.jsx';
import { ToastContainer, useToast } from '../components/ui/Toast.jsx';

const BUCKET_META = [
  { key: 'today', label: 'Today', hint: 'last 24 hours' },
  { key: 'week', label: 'This week', hint: 'last 7 days' },
  { key: 'month', label: 'This month', hint: 'last 30 days' },
];

const STATUS_CARDS = [
  { key: 'sent', label: 'Sent', icon: Send, tone: 'clay' },
  { key: 'delivered', label: 'Delivered', icon: CheckCheck, tone: 'amber' },
  { key: 'read', label: 'Read', icon: Eye, tone: 'moss' },
  { key: 'replied', label: 'Replied', icon: MessageSquareReply, tone: 'amber' },
  { key: 'booked', label: 'Booked', icon: CalendarCheck, tone: 'moss' },
  { key: 'replyRate', label: 'Reply Rate', icon: Percent, tone: 'amber', suffix: '%' },
];

export default function StatsPage() {
  const { toasts, addToast, removeToast } = useToast();

  return (
    <div className="space-y-6 sm:space-y-8">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div>
        <h1 className="font-display text-[28px] sm:text-[34px] leading-none font-medium tracking-tight text-balance">
          Stats
        </h1>
        <p className="mt-1.5 sm:mt-2 text-[13px] sm:text-sm text-[color:var(--color-ink-3)]">
          Campaign performance at a glance.
        </p>
      </div>

      <OutreachVolume />
      <StatusBreakdown />
      <AutoSendControl />
      <FeederControl addToast={addToast} />
    </div>
  );
}

function OutreachVolume() {
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

  return (
    <section>
      <h2 className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-ink-4)]">
        Outreach volume
      </h2>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {BUCKET_META.map(({ key, label, hint }) => (
          <div
            key={key}
            className="rounded-lg border rule bg-[color:var(--color-canvas-raised)] p-3 sm:p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-[12px] text-[color:var(--color-ink-3)]">{label}</span>
              <Activity size={14} strokeWidth={1.75} className="text-[color:var(--color-ink-4)] hidden sm:block" />
            </div>
            <p className="mt-2 sm:mt-3 font-display text-[32px] sm:text-[44px] leading-none font-medium text-[color:var(--color-ink)] tabular-nums">
              {isLoading ? <Skeleton className="h-8 sm:h-10 w-12 sm:w-16" /> : data?.[key]?.sent ?? 0}
            </p>
            <p className="mt-1 text-[10px] sm:text-[11px] text-[color:var(--color-ink-4)]">
              {isLoading ? '' : `${data?.[key]?.replied ?? 0} replies`}
              <span className="ml-2 text-[color:var(--color-ink-5)]">{hint}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusBreakdown() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 60_000,
  });

  return (
    <section>
      <h2 className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-ink-4)]">
        Status breakdown
      </h2>
      <div className="overflow-hidden rounded-lg border rule bg-[color:var(--color-canvas-raised)]">
        <div className="grid grid-cols-2 divide-y rule sm:grid-cols-3 sm:divide-y lg:grid-cols-3 lg:divide-y-0 lg:divide-x">
          {STATUS_CARDS.map(({ key, label, icon: Icon, tone, suffix }) => (
            <div key={key} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4">
              <div
                className="grid size-8 sm:size-10 shrink-0 place-items-center rounded-full border rule"
                style={{ color: `var(--color-${tone})` }}
              >
                <Icon size={14} strokeWidth={1.75} className="sm:hidden" />
                <Icon size={16} strokeWidth={1.75} className="hidden sm:block" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] sm:text-[12px] text-[color:var(--color-ink-3)]">{label}</p>
                <p className="font-display text-[22px] sm:text-[26px] leading-none font-medium tabular-nums">
                  {isLoading ? (
                    <Skeleton className="h-6 sm:h-7 w-8 sm:w-10" />
                  ) : (
                    `${data?.total?.[key] ?? 0}${suffix || ''}`
                  )}
                </p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 col-span-2 sm:col-span-1">
            <div className="grid size-8 sm:size-10 shrink-0 place-items-center rounded-full border rule text-[color:var(--color-ink-2)]">
              <Users size={14} strokeWidth={1.75} className="sm:hidden" />
              <Users size={16} strokeWidth={1.75} className="hidden sm:block" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] sm:text-[12px] text-[color:var(--color-ink-3)]">Total</p>
              <p className="font-display text-[22px] sm:text-[26px] leading-none font-medium tabular-nums">
                {isLoading ? <Skeleton className="h-6 sm:h-7 w-8 sm:w-10" /> : data?.total?.sent ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Toggle({ enabled, onToggle, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled ? 'bg-[color:var(--color-moss)]' : 'bg-[color:var(--color-ink-5)]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function AutoSendControl() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['auto-send'],
    queryFn: getAutoSend,
    refetchInterval: 30_000,
  });

  const mutation = useMutation({
    mutationFn: ({ type, enabled }) => setAutoSend(type, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auto-send'] }),
  });

  const dueSoonOn = data?.auto_send_due_soon ?? false;
  const passedOn = data?.auto_send_passed ?? false;

  return (
    <section>
      <h2 className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-ink-4)]">
        Auto-send
      </h2>
      <div className="card px-5 py-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-full border rule text-[color:var(--color-amber)]">
            <Timer size={16} strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[color:var(--color-ink)]">Scheduled Outreach</h3>
            <p className="text-[11px] text-[color:var(--color-ink-4)] mt-0.5">
              Sends 4 leads every 2 hours from 8:00–18:00. Toggle each type independently.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-lg border rule px-4 py-3">
              <div className="flex items-center gap-3">
                <Clock size={14} className="text-[color:var(--color-amber)]" />
                <div>
                  <p className="text-[13px] font-medium text-[color:var(--color-ink)]">Due Soon</p>
                  <p className="text-[10px] text-[color:var(--color-ink-4)]">Inspection coming up</p>
                </div>
              </div>
              <Toggle
                enabled={dueSoonOn}
                disabled={mutation.isPending}
                onToggle={() => mutation.mutate({ type: 'due_soon', enabled: !dueSoonOn })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border rule px-4 py-3">
              <div className="flex items-center gap-3">
                <Clock size={14} className="text-[color:var(--color-clay)]" />
                <div>
                  <p className="text-[13px] font-medium text-[color:var(--color-ink)]">Passed</p>
                  <p className="text-[10px] text-[color:var(--color-ink-4)]">Oldest lapsed leads</p>
                </div>
              </div>
              <Toggle
                enabled={passedOn}
                disabled={mutation.isPending}
                onToggle={() => mutation.mutate({ type: 'passed', enabled: !passedOn })}
              />
            </div>
          </div>
        )}

        {(dueSoonOn || passedOn) && (
          <div className="mt-3 rounded-lg bg-[color:var(--color-moss-soft)] px-3 py-2 text-[11px] font-medium text-[color:var(--color-moss)] flex items-center gap-2">
            <Activity size={12} />
            Active — sending {dueSoonOn && passedOn ? 'due soon + passed' : dueSoonOn ? 'due soon' : 'passed'} (4 each, every 2h)
          </div>
        )}
      </div>
    </section>
  );
}

const POLL_INTERVAL = 5_000;
const POLL_TIMEOUT = 5 * 60 * 1000;

function FeederControl({ addToast }) {
  const queryClient = useQueryClient();
  const [count, setCount] = useState(50);
  const [result, setResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(null);
  const pollRef = useRef(null);
  const triggerTimeRef = useRef(null);

  const COST_PER_MSG = 0.06;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback((triggerTime, leadLabel) => {
    const startedAt = Date.now();
    let lastCount = 0;
    let stableChecks = 0;

    pollRef.current = setInterval(async () => {
      try {
        const { new_sessions } = await getFeederProgress(triggerTime);

        if (new_sessions > 0) {
          setProgress(`Sending... ${new_sessions} lead${new_sessions !== 1 ? 's' : ''} queued`);
        }

        if (new_sessions > 0 && new_sessions === lastCount) {
          stableChecks++;
        } else {
          stableChecks = 0;
        }
        lastCount = new_sessions;

        if (stableChecks >= 3 && new_sessions > 0) {
          stopPolling();
          setScanning(false);
          setProgress(null);
          setResult({ ok: true, msg: `Done! ${new_sessions} new lead${new_sessions !== 1 ? 's' : ''} sent (${leadLabel})` });
          addToast(`${new_sessions} new ${leadLabel} lead${new_sessions !== 1 ? 's' : ''} sent`, 'success');
          queryClient.invalidateQueries({ queryKey: ['stats'] });
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          return;
        }

        if (Date.now() - startedAt > POLL_TIMEOUT) {
          stopPolling();
          setScanning(false);
          setProgress(null);
          if (new_sessions > 0) {
            setResult({ ok: true, msg: `${new_sessions} lead${new_sessions !== 1 ? 's' : ''} sent so far. Processing may still be running.` });
            addToast(`${new_sessions} leads sent. May still be processing.`, 'info');
          } else {
            setResult({ ok: true, msg: 'Scan complete — no new eligible leads found.' });
            addToast('Scan complete — no new eligible leads.', 'info');
          }
          queryClient.invalidateQueries({ queryKey: ['stats'] });
        }
      } catch {
        // ignore polling errors, keep trying
      }
    }, POLL_INTERVAL);
  }, [stopPolling, addToast, queryClient]);

  const handleTrigger = useCallback(async (leadType) => {
    const label = leadType === 'due_soon' ? 'Due Soon' : leadType === 'passed' ? 'Passed' : 'Mixed';
    setShowConfirm(null);
    setResult(null);
    setScanning(true);
    setProgress('Scanning leads...');

    try {
      const { triggered_at } = await triggerFeeder(count, leadType);
      triggerTimeRef.current = triggered_at;
      startPolling(triggered_at, label);
    } catch (err) {
      setScanning(false);
      setProgress(null);
      const msg = err.response?.data?.error || err.message;
      setResult({ ok: false, msg });
      addToast(`Failed to trigger feeder: ${msg}`, 'error');
    }
  }, [count, startPolling, addToast]);

  const isRunning = scanning;
  const typeLabel = showConfirm === 'due_soon' ? 'Due Soon' : showConfirm === 'passed' ? 'Passed' : 'Mixed';

  return (
    <section>
      <h2 className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-ink-4)]">
        Send campaigns
      </h2>
      <div className="card px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-[color:var(--color-ink)]">Trigger Feeder</h3>
            <p className="text-[11px] text-[color:var(--color-ink-4)] mt-0.5">
              Contact new leads via WhatsApp inspection reminders.
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
                disabled={isRunning}
                className="w-20 rounded-lg border rule bg-[color:var(--color-canvas)] px-3 py-1.5 text-sm text-[color:var(--color-ink)] focus:border-[color:var(--color-clay)] focus:outline-none disabled:opacity-50"
              />
            </label>
            <button
              type="button"
              onClick={() => setShowConfirm('due_soon')}
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-amber)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {isRunning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Rocket size={14} />
              )}
              Due Soon
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm('passed')}
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-clay)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {isRunning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Rocket size={14} />
              )}
              Passed
            </button>
          </div>
        </div>

        {progress && (
          <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-[11px] font-medium text-blue-700 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" />
            {progress}
          </div>
        )}

        {result && !progress && (
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
                Confirm Campaign — {typeLabel}
              </h3>
              <div className="mt-3 space-y-2 text-[13px] text-[color:var(--color-ink-3)]">
                <div className="flex justify-between">
                  <span>Type</span>
                  <span className="font-medium text-[color:var(--color-ink)]">{typeLabel}</span>
                </div>
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
                This will send WhatsApp template messages to up to {count} {typeLabel.toLowerCase()} customers. Are you sure?
              </p>
              <div className="mt-4 flex items-center gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowConfirm(null)}
                  className="rounded-lg border rule px-4 py-2 text-sm font-medium text-[color:var(--color-ink-3)] transition-colors hover:bg-[color:var(--color-canvas-sunk)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleTrigger(showConfirm)}
                  disabled={isRunning}
                  className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-clay)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  <Send size={14} />
                  Confirm Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
