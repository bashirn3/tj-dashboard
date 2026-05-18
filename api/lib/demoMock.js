const DEMO_DEFAULT_ENABLED = true;

const STATIONS = [
  { id: 58, name: 'Vaajakoski' },
  { id: 59, name: 'Jämsä' },
  { id: 60, name: 'Laukaa' },
  { id: 61, name: 'Muurame' },
];

const FIRST_NAMES = [
  'Aino', 'Mikko', 'Jukka', 'Sari', 'Antti', 'Riikka', 'Timo', 'Laura',
  'Pekka', 'Maija', 'Jari', 'Minna', 'Ville', 'Kaisa', 'Markus', 'Noora',
  'Heikki', 'Elina', 'Juha', 'Katariina', 'Samu', 'Anni', 'Petri', 'Leena',
];

const LAST_NAMES = [
  'Korhonen', 'Virtanen', 'Mäkinen', 'Nieminen', 'Hämäläinen', 'Laine',
  'Heikkinen', 'Koskinen', 'Järvinen', 'Lehtonen', 'Salonen', 'Kallio',
];

const MAKES = ['Toyota', 'Volkswagen', 'Volvo', 'Skoda', 'Ford', 'Nissan', 'Kia', 'BMW'];
const TEMPLATES = {
  due_soon: 'first_message_inspection_due_soon_2',
  passed: 'first_message_inspection_passed_3_customer_corner',
};

const now = () => new Date();
const isoHoursAgo = (hours) => new Date(now().getTime() - hours * 60 * 60 * 1000).toISOString();
const isoHoursAhead = (hours) => new Date(now().getTime() + hours * 60 * 60 * 1000).toISOString();

export function isDemoMockEnabled() {
  const value = process.env.DEMO_MOCK_DATA;
  if (value === undefined) return DEMO_DEFAULT_ENABLED;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const customers = buildCustomers();
const bookings = buildBookings(customers);

export function getMockStats() {
  return {
    total: {
      sent: 1184,
      delivered: 1042,
      read: 835,
      replied: 276,
      replyRate: 23,
      stopped: 42,
      booked: 18,
      bookedByBot: 18,
    },
    today: {
      sent: 36,
      replied: 11,
      replyRate: 31,
    },
    week: {
      sent: 214,
      replied: 63,
      replyRate: 29,
    },
    month: {
      sent: 694,
      replied: 176,
      replyRate: 25,
    },
  };
}

export function getMockLeadPool() {
  return {
    status: 'done',
    lead_type: 'due_soon',
    total_remaining: 1012,
    generated_at: now().toISOString(),
    cached_until: isoHoursAhead(12),
    window: {
      start: dateOnly(new Date(now().getTime() - 335 * 24 * 60 * 60 * 1000)),
      end: dateOnly(new Date(now().getTime() - 245 * 24 * 60 * 60 * 1000)),
    },
    station_counts: {
      Vaajakoski: 286,
      Jämsä: 214,
      Laukaa: 247,
      Muurame: 265,
    },
    deadline_buckets: {
      within_30_days: 124,
      days_31_to_60: 392,
      days_61_to_90: 472,
      unknown: 24,
    },
    contacted_sessions_excluded: 1184,
    existing_due_soon_sessions: 842,
    existing_passed_sessions: 342,
  };
}

export function getMockAnalytics() {
  const directBookings = bookings;
  const botBooked = 18;
  const contacted = 1184;
  const delivered = 1042;
  const read = 835;
  const replied = 276;
  const dueSoonBookings = 54;
  const dueSoonDeliveredReachouts = 340;

  return {
    generated_at: now().toISOString(),
    doris: { ok: true, error: null },
    summary: {
      contacted,
      delivered,
      read,
      replied,
      botBooked,
      bookingsAfterWhatsApp: directBookings.length,
      bookingsAfterWhatsAppReplied: directBookings.filter((booking) => booking.customerReplied).length,
      bookingsAfterWhatsAppSilent: directBookings.filter((booking) => !booking.customerReplied).length,
      bookingsAfterWhatsAppByCampaign: {
        due_soon: directBookings.filter((booking) => booking.campaignType === 'due_soon').length,
        passed: directBookings.filter((booking) => booking.campaignType === 'passed').length,
        unknown: directBookings.filter((booking) => !['due_soon', 'passed'].includes(booking.campaignType)).length,
      },
      highConfidenceBookings: directBookings.filter((booking) => booking.confidence === 'high').length,
      reviewBookings: directBookings.filter((booking) => booking.confidence !== 'high').length,
      totalAttributedBookings: 65,
      dueSoonDeliveredReachouts,
      dueSoonBookings,
      dueSoonBookingConversionRate: percent(dueSoonBookings, dueSoonDeliveredReachouts),
      replyRate: percent(replied, contacted),
      deliveredReplyRate: percent(replied, delivered),
      attributedBookingRate: percent(65, contacted),
      deliveredBookingRate: percent(65, delivered),
    },
    bookingsAfterWhatsApp: directBookings,
    sendTimePerformance: buildSendWindows(),
    bestSendWindows: buildSendWindows().slice(0, 8),
    replyTiming: {
      under_1h: 68,
      hours_1_to_6: 89,
      hours_6_to_24: 74,
      days_1_to_3: 35,
      days_3_plus: 10,
    },
  };
}

function buildCustomers() {
  return Array.from({ length: 132 }, (_, index) => {
    const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
    const lastName = LAST_NAMES[index % LAST_NAMES.length];
    const station = STATIONS[index % STATIONS.length];
    const campaign = index % 5 === 0 ? 'passed' : 'due_soon';
    const status = statusForIndex(index);
    const registration = registrationForIndex(index);
    const sentHoursAgo = 2 + index * 3;
    const lastOutboundAt = isoHoursAgo(sentHoursAgo);
    const replied = ['replied', 'booked'].includes(status);
    const booked = status === 'booked';
    const template = TEMPLATES[campaign];
    const firstMessage = campaign === 'due_soon'
      ? `Hei ${firstName}! Muistutuksena, että autosi (${registration}) katsastus lähestyy. Voin varata sinulle ajan nopeasti tästä.`
      : `Hei ${firstName}! Olet ollut aiemmin asiakkaamme TJ Katsastuksella. Haluaisitko varata ajan katsastukseen autollesi (${registration})?`;

    return {
      number: `35840${String(7000000 + index * 137).slice(-7)}`,
      customer_id: 720000 + index,
      name: `${firstName} ${lastName}`,
      station_id: station.id,
      status,
      first_message: firstMessage,
      campaign_type: campaign,
      template_name: template,
      reminder_stage: booked ? 'booked' : 'first_contact',
      last_outbound_at: lastOutboundAt,
      last_inbound_at: replied ? isoHoursAgo(sentHoursAgo - (1 + (index % 9))) : null,
      next_reminder_at: booked || replied ? null : isoHoursAhead(18 + (index % 12)),
      stop_reminders: booked || status === 'stopped',
      registration,
      vehicle_make: MAKES[index % MAKES.length],
    };
  }).sort((a, b) => new Date(b.last_outbound_at) - new Date(a.last_outbound_at));
}

function buildBookings(sourceCustomers) {
  return sourceCustomers.slice(0, 47).map((customer, index) => {
    const sentAt = new Date(customer.last_outbound_at);
    const replyAt = customer.last_inbound_at ? new Date(customer.last_inbound_at) : null;
    const minutesAfterWhatsApp = [28, 55, 140, 260, 520, 980, 1680, 3120, 4680][index % 9];
    const bookedAt = new Date(sentAt.getTime() + minutesAfterWhatsApp * 60 * 1000);
    const appointmentAt = new Date(bookedAt.getTime() + (2 + (index % 8)) * 24 * 60 * 60 * 1000);

    return {
      kind: 'doris_after_whatsapp',
      confidence: index % 10 === 0 ? 'review' : 'high',
      nameScore: index % 10 === 0 ? 'unknown' : 'match',
      name: customer.name,
      dorisName: customer.name,
      number: customer.number,
      customer_id: customer.customer_id,
      registration: customer.registration,
      whatsappSentAt: sentAt.toISOString(),
      whatsappSentLocal: formatHelsinki(sentAt),
      customerReplied: Boolean(replyAt),
      replyAt: replyAt ? replyAt.toISOString() : null,
      replyAtLocal: replyAt ? formatHelsinki(replyAt) : '',
      dorisBookingCreatedAt: bookedAt.toISOString(),
      dorisBookingCreatedLocal: formatHelsinki(bookedAt),
      minutesAfterWhatsApp,
      minutesAfterReply: replyAt && bookedAt >= replyAt ? Math.round((bookedAt - replyAt) / 60000) : null,
      appointmentAt: appointmentAt.toISOString(),
      appointmentLocal: formatHelsinki(appointmentAt),
      station: stationName(customer.station_id),
      saleId: 91000 + index,
      source: 2,
      eventType: 2,
      stopReason: customer.stop_reminders ? 'booked' : 'active',
      campaignType: index < 40 ? 'due_soon' : 'passed',
      sendDayHour: dayHourKey(sentAt),
    };
  }).sort((a, b) => new Date(b.dorisBookingCreatedAt) - new Date(a.dorisBookingCreatedAt));
}

function buildSendWindows() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17];

  return days.flatMap((day, dayIndex) => hours.map((hour, hourIndex) => {
    const peakHourLift = hour >= 11 && hour <= 14 ? 24 : 0;
    const sent = 52 + dayIndex * 5 + hourIndex * 3 + peakHourLift;
    const read = Math.round(sent * 0.82);
    const replied = Math.round(sent * (0.24 + ((dayIndex + hourIndex) % 4) * 0.025));
    const totalAttributedBookings = Math.max(3, Math.round(replied * (hour >= 11 && hour <= 14 ? 0.36 : 0.28)));
    const botBooked = Math.round(totalAttributedBookings * 0.35);

    return {
      key: `${day} ${hour}`,
      sent,
      delivered: Math.round(sent * 0.9),
      read,
      replied,
      botBooked,
      bookingsAfterWhatsApp: totalAttributedBookings - botBooked,
      totalAttributedBookings,
      replyRate: percent(replied, sent),
    };
  }));
}

function statusForIndex(index) {
  if (index < 18) return 'booked';
  if (index < 52) return 'replied';
  if (index < 84) return 'read';
  if (index < 118) return 'delivered';
  if (index < 126) return 'sent';
  if (index < 130) return 'failed';
  return 'stopped';
}

function registrationForIndex(index) {
  const letters = ['ABC', 'KJI', 'VVL', 'NMP', 'SEG', 'BOT', 'FIV', 'MMK'];
  return `${letters[index % letters.length]}-${String(120 + index * 7).slice(-3)}`;
}

function stationName(stationId) {
  return STATIONS.find((station) => station.id === stationId)?.name || 'Vaajakoski';
}

function normalizePhone(value) {
  let phone = String(value || '').replace(/[^0-9]/g, '');
  if (phone.startsWith('0')) phone = `358${phone.slice(1)}`;
  return phone;
}

function percent(value, total) {
  return total ? Math.round((Number(value || 0) / Number(total || 0)) * 1000) / 10 : 0;
}

function dateOnly(value) {
  return value.toISOString().slice(0, 10);
}

function formatHelsinki(value) {
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

function dayHourKey(value) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Helsinki',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value));
  const data = {};
  for (const part of parts) data[part.type] = part.value;
  return `${data.weekday} ${data.hour}`;
}
