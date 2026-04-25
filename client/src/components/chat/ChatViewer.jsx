import { useMemo, useRef, useEffect, useState } from 'react';
import { Bot, User, ArrowDown, Check, CheckCheck, Eye } from 'lucide-react';
import { dayLabel, timeOfDay } from '../../lib/format.js';

export default function ChatViewer({ messages, loading }) {
  const scrollRef = useRef(null);
  const [showJump, setShowJump] = useState(false);

  const grouped = useMemo(() => groupByDay(messages || []), [messages]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages?.length]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowJump(!atBottom);
  };

  const jumpToBottom = () => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-[640px] space-y-4">
          <div className="h-14 rounded-2xl bg-[color:var(--color-canvas-sunk)] animate-pulse" />
          <div className="h-10 w-2/3 ml-auto rounded-2xl bg-[color:var(--color-canvas-sunk)] animate-pulse" />
          <div className="h-20 rounded-2xl bg-[color:var(--color-canvas-sunk)] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-[color:var(--color-ink-4)]">
        No messages yet.
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[680px] px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
          {grouped.map(({ day, items }) => (
            <section key={day} className="space-y-3">
              <DaySeparator label={day} />
              <div className="space-y-2">
                {items.map((m) => (
                  <Message key={m.id} m={m} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      {showJump && (
        <button
          type="button"
          onClick={jumpToBottom}
          className="absolute bottom-4 right-6 inline-flex items-center gap-1.5 rounded-full border rule-strong bg-[color:var(--color-canvas-raised)] px-3 py-1.5 text-[11px] text-[color:var(--color-ink-2)] shadow-sm transition-colors hover:bg-[color:var(--color-canvas-sunk)]"
        >
          <ArrowDown size={12} strokeWidth={1.75} />
          Latest
        </button>
      )}
    </div>
  );
}

function groupByDay(messages) {
  const byDay = new Map();
  for (const m of messages) {
    const key = m.created_at ? new Date(m.created_at).toDateString() : 'unknown';
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(m);
  }
  return Array.from(byDay.entries()).map(([, items]) => ({
    day: dayLabel(items[0].created_at),
    items,
  }));
}

function DaySeparator({ label }) {
  return (
    <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-ink-4)]">
      <span className="h-px flex-1 bg-[color:var(--color-rule)]" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-[color:var(--color-rule)]" />
    </div>
  );
}

function Message({ m }) {
  if (m.type === 'ai') return <AiBubble m={m} />;
  return <HumanBubble m={m} />;
}

function DeliveryTick({ status }) {
  if (status === 'read') return <Eye size={10} strokeWidth={1.75} className="text-[color:var(--color-moss)]" />;
  if (status === 'delivered') return <CheckCheck size={10} strokeWidth={1.75} className="text-[color:var(--color-ink-4)]" />;
  if (status === 'sent') return <Check size={10} strokeWidth={1.75} className="text-[color:var(--color-ink-4)]" />;
  return null;
}

function HumanBubble({ m }) {
  return (
    <div className="flex flex-col items-end">
      <div className="max-w-[90%] sm:max-w-[85%] rounded-2xl rounded-br-md border rule bg-[color:var(--color-canvas-raised)] px-3 sm:px-3.5 py-2 sm:py-2.5 text-[14px] leading-[1.55] text-[color:var(--color-ink)] whitespace-pre-wrap">
        {m.text}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[color:var(--color-ink-4)]">
        <User size={10} strokeWidth={1.75} />
        <span>{timeOfDay(m.created_at)}</span>
      </div>
    </div>
  );
}

function AiBubble({ m }) {
  return (
    <div className="flex flex-col items-start">
      <div className="max-w-[90%] sm:max-w-[85%] rounded-2xl rounded-bl-md border rule bg-[color:var(--color-canvas)] px-3 sm:px-3.5 py-2 sm:py-2.5 text-[14px] leading-[1.55] text-[color:var(--color-ink)] whitespace-pre-wrap">
        {m.text || <em className="text-[color:var(--color-ink-4)]">(empty)</em>}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[color:var(--color-ink-4)]">
        <Bot size={10} strokeWidth={1.75} />
        <span>{timeOfDay(m.created_at)}</span>
        {m.delivery_status && <DeliveryTick status={m.delivery_status} />}
      </div>
    </div>
  );
}
