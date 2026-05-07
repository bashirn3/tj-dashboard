import { Router } from 'express';
import axios from 'axios';
import { supabase } from '../lib/supabase.js';

const router = Router();

const SITE_CALENDAR_MAP = {
  58: { calendarId: 61, name: 'Vaajakoski' },
  59: { calendarId: 62, name: 'Jämsä' },
  60: { calendarId: 63, name: 'Laukaa' },
  61: { calendarId: 64, name: 'Muurame' },
};

const DEFAULT_BRIDGE_URL = 'https://doris-bridge.yellowpond-051e3dca.eastus.azurecontainerapps.io';
const CACHE_TTL_MS = 10 * 60 * 1000;

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
  const [sessionsRes, statusesRes] = await Promise.all([
    supabase
      .from('tj_outbound_sessions')
      .select('*')
      .not('last_outbound_at', 'is', null)
      .or('stop_reason.neq.business_customer,stop_reason.is.null')
      .order('last_outbound_at', { ascending: true })
      .limit(2000),
    supabase.from('tj_message_status').select('number, status').limit(5000),
  ]);

  if (sessionsRes.error) throw sessionsRes.error;
  if (statusesRes.error) throw statusesRes.error;

  const sessions = (sessionsRes.data || []).filter(
    (session) => session.customer_id && session.customer_id !== 999999
  );
  const statusByNumber = buildStatusMap(statusesRes.data || []);
  const rows = sessions.map((session) => formatSession(session, statusByNumber));
  const base = buildBaseStats(rows);

  let doris = { ok: true, error: null };
  let attributedBookings = [];

  try {
    attributedBookings = await findAttributedBookings(sessions);
  } catch (err) {
    doris = {
      ok: false,
      error: err.response?.data?.error || err.message || 'Failed to load DORIS bookings',
    };
  }

  const directBookings = attributedBookings.filter((booking) => booking.kind === 'doris_after_whatsapp');
  const repliedBookings = directBookings.filter((booking) => booking.customerReplied).length;
  const bookingsByCampaign = countBy(directBookings, (booking) => booking.campaignType || 'unknown');
  const botBooked = rows.filter((row) => row.botBooked).length;
  const dueSoonDelivered = rows.filter((row) => row.campaignType === 'due_soon' && row.delivered).length;
  const dueSoonBotBooked = rows.filter((row) => row.campaignType === 'due_soon' && row.botBooked).length;
  const dueSoonBookings = dueSoonBotBooked + (bookingsByCampaign.due_soon || 0);
  const sendTimePerformance = buildSendTimePerformance(rows, directBookings);
  const replyTiming = buildReplyTiming(rows);

  return {
    generated_at: new Date().toISOString(),
    doris,
    summary: {
      contacted: base.contacted,
      delivered: base.delivered,
      read: base.read,
      replied: base.replied,
      botBooked,
      bookingsAfterWhatsApp: directBookings.length,
      bookingsAfterWhatsAppReplied: repliedBookings,
      bookingsAfterWhatsAppSilent: directBookings.length - repliedBookings,
      bookingsAfterWhatsAppByCampaign: bookingsByCampaign,
      highConfidenceBookings: directBookings.filter((booking) => booking.confidence === 'high').length,
      reviewBookings: directBookings.filter((booking) => booking.confidence !== 'high').length,
      totalAttributedBookings: botBooked + directBookings.length,
      dueSoonDeliveredReachouts: dueSoonDelivered,
      dueSoonBookings,
      dueSoonBookingConversionRate: percent(dueSoonBookings, dueSoonDelivered),
      replyRate: percent(base.replied, base.contacted),
      deliveredReplyRate: percent(base.replied, base.delivered),
      attributedBookingRate: percent(botBooked + directBookings.length, base.contacted),
      deliveredBookingRate: percent(botBooked + directBookings.length, base.delivered),
    },
    bookingsAfterWhatsApp: directBookings,
    sendTimePerformance,
    bestSendWindows: sendTimePerformance
      .filter((bucket) => bucket.sent >= 5)
      .slice()
      .sort((a, b) => b.replyRate - a.replyRate || b.bookingsAfterWhatsApp - a.bookingsAfterWhatsApp)
      .slice(0, 8),
    replyTiming,
  };
}

async function findAttributedBookings(sessions) {
  const sessionsByRegistration = new Map();
  const earliestOutbound = sessions.reduce((min, session) => {
    const ts = new Date(session.last_outbound_at).getTime();
    return Number.isFinite(ts) ? Math.min(min, ts) : min;
  }, Date.now());

  for (const session of sessions) {
    const raw = parseRaw(session.raw_data);
    const outbound = raw.tj_outbound || raw;
    const registrations = (outbound.vehicles || [])
      .map((vehicle) => normalizeRegistration(vehicle.registration))
      .filter(Boolean);

    for (const registration of registrations) {
      if (!sessionsByRegistration.has(registration)) {
        sessionsByRegistration.set(registration, []);
      }
      sessionsByRegistration.get(registration).push({ session, outbound });
    }
  }

  if (sessionsByRegistration.size === 0) return [];

  const start = dateOnly(new Date(earliestOutbound - 24 * 60 * 60 * 1000));
  const end = dateOnly(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));
  const saleCache = new Map();
  const bookings = [];
  const seen = new Set();

  for (const [siteId, site] of Object.entries(SITE_CALENDAR_MAP)) {
    const calendar = await bridgeGet(`/api/doris/calendar/${site.calendarId}/events`, { start, end });
    const events = Array.isArray(calendar) ? calendar : calendar.events || [];

    for (const event of events) {
      if (![2, 4].includes(event.eventType)) continue;
      const registration = eventRegistration(event);
      if (!registration || !sessionsByRegistration.has(registration)) continue;

      for (const { session, outbound } of sessionsByRegistration.get(registration)) {
        const saleId = event.info?.saleId;
        if (!saleId) continue;

        const saleKey = `${siteId}:${saleId}`;
        if (!saleCache.has(saleKey)) {
          saleCache.set(saleKey, bridgeGet(`/api/doris/sites/${siteId}/sales/${saleId}`));
        }

        const salePayload = await saleCache.get(saleKey);
        const sale = salePayload.sale || {};
        const task = (sale.tasks || []).find((item) => item.id === event.info?.taskId) || sale.tasks?.[0] || {};
        const createdAt = task.dorisInfo?.createdAt || sale.createdAt;
        const bookingCreated = createdAt ? new Date(createdAt).getTime() : 0;
        const whatsappSent = new Date(session.last_outbound_at).getTime();
        const replyAt = session.last_inbound_at ? new Date(session.last_inbound_at).getTime() : null;
        const source = sale.source ?? event.info?.saleSource;
        const isAfterWhatsApp = bookingCreated >= whatsappSent;
        const isBotBooked = session.stop_reason === 'booked';

        if (!isAfterWhatsApp || source !== 2 || isBotBooked) continue;

        const uniqueKey = `${session.customer_id}:${saleId}:${registration}`;
        if (seen.has(uniqueKey)) continue;
        seen.add(uniqueKey);

        const sessionName = outbound.customer_name || outbound.contact_person || '';
        const dorisName = event.info?.customerName || sale.customer?.name || '';
        const nameScoreValue = nameScore(sessionName, dorisName);

        bookings.push({
          kind: 'doris_after_whatsapp',
          confidence: nameScoreValue === 'mismatch' || nameScoreValue === 'unknown' ? 'review' : 'high',
          nameScore: nameScoreValue,
          name: sessionName || dorisName || `Customer #${session.customer_id}`,
          dorisName,
          number: session.number,
          customer_id: session.customer_id,
          registration,
          whatsappSentAt: session.last_outbound_at,
          whatsappSentLocal: formatHelsinki(session.last_outbound_at),
          customerReplied: Boolean(session.last_inbound_at),
          replyAt: session.last_inbound_at,
          replyAtLocal: session.last_inbound_at ? formatHelsinki(session.last_inbound_at) : '',
          dorisBookingCreatedAt: createdAt,
          dorisBookingCreatedLocal: formatHelsinki(createdAt),
          minutesAfterWhatsApp: Math.round((bookingCreated - whatsappSent) / 60000),
          minutesAfterReply: replyAt && bookingCreated >= replyAt
            ? Math.round((bookingCreated - replyAt) / 60000)
            : null,
          appointmentAt: event.duration?.start,
          appointmentLocal: formatHelsinki(event.duration?.start),
          station: site.name,
          saleId,
          source,
          eventType: event.eventType,
          stopReason: session.stop_reason || 'active',
          campaignType: session.campaign_type || outbound.campaign_type || '',
          sendDayHour: dayHourKey(session.last_outbound_at),
        });
      }
    }
  }

  return bookings.sort((a, b) => a.minutesAfterWhatsApp - b.minutesAfterWhatsApp);
}

async function bridgeGet(path, params = {}) {
  const baseURL = process.env.DORIS_BRIDGE_URL || DEFAULT_BRIDGE_URL;
  const apiKey = process.env.DORIS_BRIDGE_API_KEY || process.env.BRIDGE_API_KEY;
  const headers = apiKey ? { 'X-API-Key': apiKey } : {};
  const { data } = await axios.get(`${baseURL}${path}`, { params, headers, timeout: 120000 });
  if (data?.success === false) throw new Error(data.error || 'DORIS bridge request failed');
  return data?.data ?? data;
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
    repliedAt,
    stopReason: session.stop_reason || '',
    campaignType: session.campaign_type || outbound.campaign_type || '',
    botBooked: session.stop_reminders && session.stop_reason === 'booked',
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

function countBy(rows, getKey) {
  return rows.reduce((acc, row) => {
    const key = getKey(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function eventRegistration(event) {
  return normalizeRegistration(
    event.info?.registrationNumber || event.info?.dorisRegistrationNumber || event.name
  );
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

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameScore(left, right) {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return 'unknown';
  if (a === b) return 'exact';
  const aParts = a.split(' ');
  const bParts = b.split(' ');
  const overlap = aParts.filter((part) => bParts.includes(part));
  if (overlap.length >= 2) return 'strong';
  if (overlap.length >= 1) return 'partial';
  return 'mismatch';
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator * 1000) / denominator) / 10;
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
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
