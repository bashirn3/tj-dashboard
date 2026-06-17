import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Clock,
  Loader2,
  MapPin,
  PauseCircle,
  Rocket,
  Send,
  Timer,
} from 'lucide-react';
import {
  getAutoSend,
  getFeederProgress,
  getStationPause,
  setAutoSend,
  setStationPause,
  triggerFeeder,
} from '../lib/api.js';
import Skeleton from '../components/ui/Skeleton.jsx';
import { ToastContainer, useToast } from '../components/ui/Toast.jsx';

export default function SettingsPage() {
  const { toasts, addToast, removeToast } = useToast();

  return (
    <div className="space-y-6 sm:space-y-8">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div>
        <h1 className="font-display text-[28px] sm:text-[34px] leading-none font-medium tracking-tight text-balance">
          Settings
        </h1>
        <p className="mt-1.5 sm:mt-2 text-[13px] sm:text-sm text-[color:var(--color-ink-3)]">
          Campaign controls and scheduled outreach.
        </p>
      </div>

      <AutoSendControl />
      <StationPauseControl addToast={addToast} />
      <FeederControl addToast={addToast} />
    </div>
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
  const activeScheduleLabel = dueSoonOn && passedOn
    ? 'up to 12 due soon + 4 passed every 2h'
    : dueSoonOn
      ? 'up to 12 every 2h'
      : 'up to 4 every 2h';

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
              Sends up to 12 due-soon leads and 4 passed leads every 2 hours from 8:00-18:00.
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
            Active - sending {dueSoonOn && passedOn ? 'due soon + passed' : dueSoonOn ? 'due soon' : 'passed'} ({activeScheduleLabel})
          </div>
        )}
      </div>
    </section>
  );
}

function StationPauseControl({ addToast }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['station-pause'],
    queryFn: getStationPause,
    refetchInterval: 30_000,
  });

  const mutation = useMutation({
    mutationFn: ({ stationId, paused }) => setStationPause(stationId, paused),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['station-pause'] });
      addToast(
        variables.paused ? 'Station paused for outbound + reminders' : 'Station resumed',
        variables.paused ? 'info' : 'success'
      );
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.message;
      addToast(`Failed to update station pause: ${msg}`, 'error');
    },
  });

  const stations = data?.stations || [];
  const pausedCount = stations.filter((station) => station.paused).length;

  return (
    <section>
      <h2 className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-ink-4)]">
        Station outreach
      </h2>
      <div className="card px-5 py-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-full border rule text-[color:var(--color-clay)]">
            <PauseCircle size={16} strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[color:var(--color-ink)]">Active by Station</h3>
            <p className="text-[11px] text-[color:var(--color-ink-4)] mt-0.5">
              Turn a station off to pause both new outreach and reminder sends.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stations.map((station) => (
              <div
                key={station.station_id}
                className="flex items-center justify-between rounded-lg border rule px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <MapPin
                    size={14}
                    className={station.paused ? 'text-[color:var(--color-sienna)]' : 'text-[color:var(--color-moss)]'}
                  />
                  <div>
                    <p className="text-[13px] font-medium text-[color:var(--color-ink)]">
                      {station.station_name}
                    </p>
                    <p className="text-[10px] text-[color:var(--color-ink-4)]">
                      {station.paused ? 'Outreach + reminders paused' : 'Outreach + reminders enabled'}
                    </p>
                  </div>
                </div>
                <Toggle
                  enabled={!station.paused}
                  disabled={mutation.isPending}
                  onToggle={() => mutation.mutate({
                    stationId: station.station_id,
                    paused: !station.paused,
                  })}
                />
              </div>
            ))}
          </div>
        )}

        {pausedCount > 0 && (
          <div className="mt-3 rounded-lg bg-[color:var(--color-sienna-soft)] px-3 py-2 text-[11px] font-medium text-[color:var(--color-sienna)] flex items-center gap-2">
            <PauseCircle size={12} />
            {pausedCount} station{pausedCount !== 1 ? 's' : ''} paused - no first contact or reminders will send there.
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
          queryClient.invalidateQueries({ queryKey: ['analytics'] });
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
          queryClient.invalidateQueries({ queryKey: ['analytics'] });
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
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              Due Soon
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm('passed')}
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-clay)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
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
