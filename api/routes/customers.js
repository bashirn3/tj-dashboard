import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

router.get('/', async (req, res) => {
  const { search, status, station, campaign } = req.query;

  let query = supabase
    .from('tj_outbound_sessions')
    .select('*')
    .or('stop_reason.neq.business_customer,stop_reason.is.null')
    .order('last_outbound_at', { ascending: false });

  if (station) {
    query = query.eq('station_id', Number(station));
  }

  if (campaign === 'passed' || campaign === 'due_soon') {
    query = query.eq('campaign_type', campaign);
  }

  if (status === 'replied') {
    query = query.not('last_inbound_at', 'is', null);
  } else if (status === 'booked') {
    query = query.eq('stop_reminders', true).eq('stop_reason', 'booked');
  } else if (status === 'stopped') {
    query = query.eq('stop_reminders', true).neq('stop_reason', 'booked');
  }

  const [sessionsResult, statusesResult] = await Promise.all([
    query,
    supabase.from('tj_message_status').select('number, status'),
  ]);

  if (sessionsResult.error) {
    console.error('[customers]', sessionsResult.error);
    return res.status(500).json({ error: sessionsResult.error.message });
  }

  const statusByNumber = {};
  for (const m of statusesResult.data || []) {
    statusByNumber[m.number] = m.status;
  }

  let customers = sessionsResult.data.map((row) => formatCustomer(row, statusByNumber));

  if (status && ['sent', 'read', 'delivered', 'failed'].includes(status)) {
    customers = customers.filter((c) => c.status === status);
  }

  if (search) {
    const q = search.toLowerCase();
    customers = customers.filter(
      (c) =>
        c.number.includes(q) ||
        c.name.toLowerCase().includes(q) ||
        String(c.customer_id).includes(q)
    );
  }

  res.json({ customers, count: customers.length });
});

router.get('/:phone', async (req, res) => {
  const { phone } = req.params;

  const [sessionResult, statusResult] = await Promise.all([
    supabase.from('tj_outbound_sessions').select('*').eq('number', phone).maybeSingle(),
    supabase.from('tj_message_status').select('number, status').eq('number', phone).maybeSingle(),
  ]);

  if (sessionResult.error) {
    console.error('[customer]', sessionResult.error);
    return res.status(500).json({ error: sessionResult.error.message });
  }
  if (!sessionResult.data) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const statusByNumber = {};
  if (statusResult.data) {
    statusByNumber[statusResult.data.number] = statusResult.data.status;
  }

  res.json(formatCustomer(sessionResult.data, statusByNumber));
});

router.post('/:phone/stop', async (req, res) => {
  const { phone } = req.params;

  const { error } = await supabase
    .from('tj_outbound_sessions')
    .update({ stop_reminders: true, stop_reason: 'dashboard' })
    .eq('number', phone);

  if (error) {
    console.error('[stop]', error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true });
});

function formatCustomer(row, statusByNumber = {}) {
  let rawData = row.raw_data;
  if (typeof rawData === 'string') {
    try { rawData = JSON.parse(rawData); } catch { rawData = {}; }
  }
  const raw = rawData?.tj_outbound || rawData || {};

  let name = '';
  if (raw.customer_name) name = raw.customer_name;
  else if (row.customer_id) name = `Customer #${row.customer_id}`;

  const deliveryStatus = statusByNumber[row.number] || 'sent';

  let status = 'sent';
  if (row.stop_reminders && row.stop_reason === 'booked') status = 'booked';
  else if (row.stop_reminders) status = 'stopped';
  else if (row.last_inbound_at) status = 'replied';
  else if (deliveryStatus === 'read') status = 'read';
  else if (deliveryStatus === 'delivered') status = 'delivered';
  else if (deliveryStatus === 'failed') status = 'failed';

  return {
    number: row.number,
    customer_id: row.customer_id,
    name,
    station_id: row.station_id,
    status,
    first_message: row.first_message,
    campaign_type: row.campaign_type || raw.campaign_type,
    template_name: raw.template_name,
    reminder_stage: row.reminder_stage,
    last_outbound_at: row.last_outbound_at,
    last_inbound_at: row.last_inbound_at,
    next_reminder_at: row.next_reminder_at,
    stop_reminders: row.stop_reminders,
  };
}

export default router;
