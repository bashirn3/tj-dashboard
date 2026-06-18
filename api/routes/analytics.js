import { Router } from 'express';
import { supabase, fetchAll } from '../lib/supabase.js';

const router = Router();

// Campaign restarted on the CSV-fallback path at 29 May 2026 09:31 Helsinki time.
// Bookings messaged on/after this are "since restart"; earlier ones are prior waves.
const CAMPAIGN_RESTART_AT = new Date('2026-05-29T09:31:00+03:00').getTime();
const CACHE_TTL_MS = 10 * 60 * 1000;
const BOOKED_STOP_REASONS = new Set(['booked', 'booked_from_snapshot']);

let cache = { at: 0, data: null };

router.get('/', async (req, res) => {
  const refresh = req.query.refresh === '1';
  if (!refresh && cache.data && Date.now() - cache.at < CACHE_TTL_MS) {
    return res.json(cache.data);
  }

  const data = await buildAnalytics();
  cache = { at: Date.now(), data };
  res.json(data);
});

async function buildAnalytics() {
  // PostgREST hard-caps each request at 1000 rows, so paginate to get every
  // session/status (we have >1200 sessions) instead of silently truncating.
  const [allSessions, allStatuses] = await Promise.all([
    fetchAll(() =>
      supabase
        .from('tj_outbound_sessions')
        .select('*')
        .not('last_outbound_at', 'is', null)
        .or('stop_reason.neq.business_customer,stop_reason.is.null')
        .order('id', { ascending: true })
    ),
    fetchAll(() =>
      supabase
        .from('tj_message_status')
        .select('number, status, stage, sent_at')
        .order('id', { ascending: true })
    ),
  ]);

  const sessions = allSessions
    .filter((session) => session.customer_id && session.customer_id !== 999999)
    .sort((a, b) => new Date(a.last_outbound_at) - new Date(b.last_outbound_at));
  const statusByNumber = buildStatusMap(allStatuses);
  const rows = sessions.map((session) => formatSession(session, statusByNumber));
  const base = buildBaseStats(rows);
  const activeRows = rows.filter((row) => row.sentMs >= CAMPAIGN_RESTART_AT);
  const activeBase = buildBaseStats(activeRows);

  const snapshotsByReg = await loadSnapshotsByReg();
  const bookings = buildBookings(sessions, snapshotsByReg);
  const reminders = buildReminderSummary(sessions, allStatuses, snapshotsByReg);

  const repliedBookings = bookings.filter((booking) => booking.customerReplied).length;
  const matchedBookings = bookings.filter((booking) => booking.calendarMatched).length;
  const bookingsByCampaign = countBy(bookings, (booking) => booking.campaignType || 'unknown');
  const botBooked = rows.filter((row) => row.botBooked).length;
  const dueSoonSent = rows.filter((row) => row.campaignType === 'due_soon').length;
  const dueSoonDelivered = rows.filter((row) => row.campaignType === 'due_soon' && row.delivered).length;
  const dueSoonBookings = bookings.filter((booking) => booking.campaignType === 'due_soon').length;
  const activeDueSoonSent = activeRows.filter((row) => row.campaignType === 'due_soon').length;
  const sendTimePerformance = buildSendTimePerformance(rows, bookings);
  const replyTiming = buildReplyTiming(rows);

  return {
    generated_at: new Date().toISOString(),
    bookingSource: 'snapshots',
    doris: { ok: true, error: null, source: 'snapshots' },
    summary: {
      contacted: base.contacted,
      delivered: base.delivered,
      read: base.read,
      replied: base.replied,
      botBooked,
      bookingsAfterWhatsApp: bookings.length,
      bookingsAfterWhatsAppReplied: repliedBookings,
      bookingsAfterWhatsAppSilent: bookings.length - repliedBookings,
      bookingsAfterWhatsAppByCampaign: bookingsByCampaign,
      calendarMatchedBookings: matchedBookings,
      highConfidenceBookings: matchedBookings,
      reviewBookings: bookings.length - matchedBookings,
      totalAttributedBookings: bookings.length,
      currentSent: activeBase.contacted,
      currentDueSoonSent: activeDueSoonSent,
      currentDelivered: activeBase.delivered,
      currentReplied: activeBase.replied,
      currentBookingConversionRate: percent(bookings.length, activeDueSoonSent || activeBase.contacted),
      dueSoonSentReachouts: dueSoonSent,
      dueSoonDeliveredReachouts: dueSoonDelivered,
      dueSoonBookings,
      dueSoonConversions: dueSoonBookings,
      dueSoonBookingConversionRate: percent(bookings.length, activeDueSoonSent || activeBase.contacted),
      remindersSent: reminders.sent,
      pendingReminders: reminders.pending,
      reminderBacklog: reminders.pending,
      nextReminderAt: reminders.nextReminderAt,
      remindersByStage: reminders.byStage,
      replyRate: percent(base.replied, base.contacted),
      deliveredReplyRate: percent(base.replied, base.delivered),
      attributedBookingRate: percent(bookings.length, base.contacted),
      deliveredBookingRate: percent(bookings.length, base.delivered),
    },
    bookingsAfterWhatsApp: bookings,
    sendTimePerformance,
    bestSendWindows: sendTimePerformance
      .filter((bucket) => bucket.sent >= 5)
      .slice()
      .sort((a, b) => b.replyRate - a.replyRate || b.bookingsAfterWhatsApp - a.bookingsAfterWhatsApp)
      .slice(0, 8),
    replyTiming,
  };
}

// While DORIS API access is blocked, bookings are attributed by matching the
// vehicle registrations we messaged against tj_booking_snapshots (manual/Tier-2
// calendar captures). A session counts as a booking if its registration is on a
// captured calendar OR it was booked in-chat (stop_reason='booked').
async function loadSnapshotsByReg() {
  const snapshots = await fetchAll(() =>
    supabase
      .from('tj_booking_snapshots')
      .select('reg, station_name, station_id, week, appointment_week_start, appointment_date, customer_name, is_baseline, first_seen_at')
      .order('id', { ascending: true })
  );
  const byReg = new Map();
  for (const snap of snapshots) {
    const reg = normalizeRegistration(snap.reg);
    if (!reg || byReg.has(reg)) continue;
    byReg.set(reg, snap);
  }
  return byReg;
}

function buildBookings(sessions, snapshotsByReg) {
  const bookings = [];
  for (const session of sessions) {
    const raw = parseRaw(session.raw_data);
    const outbound = raw.tj_outbound || raw;
    const regs = (outbound.vehicles || [])
      .map((vehicle) => normalizeRegistration(vehicle.registration))
      .filter(Boolean);

    const matchedSnap = regs.map((reg) => snapshotsByReg.get(reg)).find(Boolean) || null;
    const isBooked = session.stop_reminders && BOOKED_STOP_REASONS.has(session.stop_reason);
    if (!matchedSnap && !isBooked) continue;

    const registration = matchedSnap ? normalizeRegistration(matchedSnap.reg) : regs[0] || '';
    const sentAt = session.last_outbound_at;
    const sentMs = new Date(sentAt).getTime();
    const appointmentAt = matchedSnap?.appointment_date || matchedSnap?.appointment_week_start || null;
    const bookingDetectedAt = matchedSnap?.first_seen_at || (isBooked ? session.last_inbound_at || sentAt : null);

    bookings.push({
      kind: matchedSnap ? 'calendar_match' : 'bot_booked',
      calendarMatched: Boolean(matchedSnap),
      confidence: 'high',
      name:
        outbound.customer_name ||
        outbound.contact_person ||
        matchedSnap?.customer_name ||
        `Customer #${session.customer_id}`,
      number: session.number,
      customer_id: session.customer_id,
      registration,
      whatsappSentAt: sentAt,
      whatsappSentLocal: formatHelsinki(sentAt),
      contactedWeekLocal: formatApptWeek(sentAt),
      customerReplied: Boolean(session.last_inbound_at),
      replyAt: session.last_inbound_at,
      replyAtLocal: session.last_inbound_at ? formatHelsinki(session.last_inbound_at) : '',
      // Without DORIS booking-created timestamps, first_seen_at is the cleanest
      // week-level proxy for when a booking entered our captured calendar.
      dorisBookingCreatedAt: bookingDetectedAt,
      dorisBookingCreatedLocal: bookingDetectedAt ? formatApptWeek(bookingDetectedAt) : '',
      bookingDetectedAt,
      bookingDetectedLocal: bookingDetectedAt ? formatApptWeek(bookingDetectedAt) : '',
      minutesAfterWhatsApp: null,
      minutesAfterReply: null,
      appointmentAt,
      appointmentLocal: appointmentAt ? formatApptWeek(appointmentAt) : '',
      bookedWeek: matchedSnap?.week ?? null,
      isBaseline: Boolean(matchedSnap?.is_baseline),
      messagedAfterRestart: Number.isFinite(sentMs) && sentMs >= CAMPAIGN_RESTART_AT,
      station: matchedSnap?.station_name || '',
      stopReason: session.stop_reason || 'active',
      campaignType: session.campaign_type || outbound.campaign_type || '',
      sendDayHour: dayHourKey(sentAt),
    });
  }
  return bookings.sort((a, b) => new Date(b.appointmentAt || 0) - new Date(a.appointmentAt || 0));
}

function buildStatusMap(statuses) {
  const statusByNumber = new Map();
  for (const status of statuses) {
    const number = normalizePhone(status.number);
    if (!statusByNumber.has(number)) statusByNumber.set(number, new Set());
    statusByNumber.get(number).add(String(status.status || '').toLowerCase());
  }
  return statusByNumber;
}

function formatSession(session, statusByNumber) {
  const statuses = statusByNumber.get(normalizePhone(session.number)) || new Set();
  const raw = parseRaw(session.raw_data);
  const outbound = raw.tj_outbound || raw;
  const sentAt = session.last_outbound_at;
  const repliedAt = session.last_inbound_at;
  const sentMs = new Date(sentAt).getTime();
  const repliedMs = repliedAt ? new Date(repliedAt).getTime() : null;

  return {
    number: session.number,
    customer_id: session.customer_id,
    name: outbound.customer_name || outbound.contact_person || '',
    sentAt,
    sentMs,
    repliedAt,
    stopReason: session.stop_reason || '',
    campaignType: session.campaign_type || outbound.campaign_type || '',
    botBooked: session.stop_reminders && BOOKED_STOP_REASONS.has(session.stop_reason),
    delivered: statuses.has('delivered') || statuses.has('read'),
    read: statuses.has('read'),
    replied: Boolean(repliedAt),
    replyLagMinutes: repliedMs ? Math.round((repliedMs - sentMs) / 60000) : null,
    sendHour: hourKey(sentAt),
    sendDayHour: dayHourKey(sentAt),
    replyDayHour: repliedAt ? dayHourKey(repliedAt) : null,
  };
}

function buildBaseStats(rows) {
  return {
    contacted: rows.length,
    delivered: rows.filter((row) => row.delivered).length,
    read: rows.filter((row) => row.read).length,
    replied: rows.filter((row) => row.replied).length,
  };
}

function buildSendTimePerformance(rows, bookings) {
  const buckets = new Map();
  for (const row of rows) {
    const key = row.sendDayHour;
    if (!buckets.has(key)) {
      buckets.set(key, emptyTimeBucket(key));
    }
    const bucket = buckets.get(key);
    bucket.sent++;
    if (row.delivered) bucket.delivered++;
    if (row.read) bucket.read++;
    if (row.replied) bucket.replied++;
    if (row.botBooked) bucket.botBooked++;
    if (row.replyLagMinutes !== null) bucket.replyLags.push(row.replyLagMinutes);
  }

  for (const booking of bookings) {
    const key = booking.sendDayHour;
    if (!buckets.has(key)) {
      buckets.set(key, emptyTimeBucket(key));
    }
    buckets.get(key).bookingsAfterWhatsApp++;
  }

  return Array.from(buckets.values())
    .map((bucket) => {
      const replyLags = bucket.replyLags.slice().sort((a, b) => a - b);
      return {
        ...bucket,
        totalAttributedBookings: bucket.botBooked + bucket.bookingsAfterWhatsApp,
        replyRate: percent(bucket.replied, bucket.sent),
        deliveredReplyRate: percent(bucket.replied, bucket.delivered),
        bookingRate: percent(bucket.botBooked + bucket.bookingsAfterWhatsApp, bucket.sent),
        medianReplyMinutes: replyLags[Math.floor(replyLags.length / 2)] ?? null,
        replyLags: undefined,
      };
    })
    .sort((a, b) => b.sent - a.sent);
}

function emptyTimeBucket(key) {
  return {
    key,
    sent: 0,
    delivered: 0,
    read: 0,
    replied: 0,
    botBooked: 0,
    bookingsAfterWhatsApp: 0,
    replyLags: [],
  };
}

function buildReplyTiming(rows) {
  const replied = rows.filter((row) => row.replied);
  const lags = replied
    .map((row) => row.replyLagMinutes)
    .filter((lag) => lag !== null)
    .sort((a, b) => a - b);
  const replyDistribution = new Map();

  for (const row of replied) {
    if (!row.replyDayHour) continue;
    replyDistribution.set(row.replyDayHour, (replyDistribution.get(row.replyDayHour) || 0) + 1);
  }

  return {
    replied: replied.length,
    under15m: replied.filter((row) => row.replyLagMinutes < 15).length,
    under60m: replied.filter((row) => row.replyLagMinutes < 60).length,
    oneToSixHours: replied.filter(
      (row) => row.replyLagMinutes >= 60 && row.replyLagMinutes < 360
    ).length,
    over24h: replied.filter((row) => row.replyLagMinutes >= 1440).length,
    medianReplyMinutes: lags[Math.floor(lags.length / 2)] ?? null,
    distribution: Array.from(replyDistribution.entries())
      .map(([key, replies]) => ({ key, replies }))
      .sort((a, b) => b.replies - a.replies)
      .slice(0, 12),
  };
}

function buildReminderSummary(sessions, statuses, snapshotsByReg) {
  const now = Date.now();
  const pendingByStage = {};
  let pending = 0;
  let nextReminderAt = null;

  for (const session of sessions) {
    const sentMs = new Date(session.last_outbound_at).getTime();
    if (!Number.isFinite(sentMs) || sentMs < CAMPAIGN_RESTART_AT) continue;
    if (session.stop_reminders) continue;
    if (hasSnapshotBooking(session, snapshotsByReg)) continue;

    const stage = session.reminder_stage || 'first_contact';
    const delayHours = stage === 'first_contact'
      ? 48
      : ['reminder_1d', 'reminder_3d', 'first_followup', 'second_followup', 'final_followup'].includes(stage)
        ? 72
        : null;
    if (!delayHours) continue;

    const dueAt = sentMs + delayHours * 60 * 60 * 1000;
    if (dueAt <= now) {
      pending += 1;
      pendingByStage[stage] = (pendingByStage[stage] || 0) + 1;
    } else if (!nextReminderAt || dueAt < new Date(nextReminderAt).getTime()) {
      nextReminderAt = new Date(dueAt).toISOString();
    }
  }

  const sent = statuses.filter((status) => {
    const stage = String(status.stage || '');
    const sentMs = new Date(status.sent_at).getTime();
    return stage.startsWith('reminder_') && Number.isFinite(sentMs) && sentMs >= CAMPAIGN_RESTART_AT;
  }).length;

  return {
    sent,
    pending,
    nextReminderAt,
    byStage: pendingByStage,
  };
}

function hasSnapshotBooking(session, snapshotsByReg) {
  const raw = parseRaw(session.raw_data);
  const outbound = raw.tj_outbound || raw;
  return (outbound.vehicles || [])
    .map((vehicle) => normalizeRegistration(vehicle.registration))
    .filter(Boolean)
    .some((reg) => snapshotsByReg.has(reg));
}

function countBy(rows, getKey) {
  return rows.reduce((acc, row) => {
    const key = getKey(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function parseRaw(rawData) {
  if (!rawData) return {};
  if (typeof rawData === 'string') {
    try {
      return JSON.parse(rawData);
    } catch {
      return {};
    }
  }
  return rawData;
}

function normalizeRegistration(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, '').trim();
}

function normalizePhone(value) {
  let phone = String(value || '').replace(/[^0-9]/g, '');
  if (phone.startsWith('0')) phone = `358${phone.slice(1)}`;
  return phone;
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator * 1000) / denominator) / 10;
}

function formatApptWeek(value) {
  if (!value) return '';
  return `wk of ${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Helsinki',
    day: '2-digit',
    month: 'short',
  }).format(new Date(value))}`;
}

function formatHelsinki(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Helsinki',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function hourKey(value) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Helsinki',
    hour: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function dayHourKey(value) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Helsinki',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).format(new Date(value)).replace(',', '');
}

export default router;
