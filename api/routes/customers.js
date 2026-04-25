import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

router.get('/', async (req, res) => {
  const { search, status, station } = req.query;

  let query = supabase
    .from('tj_outbound_sessions')
    .select('*')
    .order('last_outbound_at', { ascending: false });

  if (station) {
    query = query.eq('station_id', Number(station));
  }

  if (status === 'replied') {
    query = query.not('last_inbound_at', 'is', null);
  } else if (status === 'sent') {
    query = query.is('last_inbound_at', null);
  } else if (status === 'stopped') {
    query = query.eq('stop_reminders', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[customers]', error);
    return res.status(500).json({ error: error.message });
  }

  let customers = data.map(formatCustomer);

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

  const { data, error } = await supabase
    .from('tj_outbound_sessions')
    .select('*')
    .eq('number', phone)
    .maybeSingle();

  if (error) {
    console.error('[customer]', error);
    return res.status(500).json({ error: error.message });
  }
  if (!data) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  res.json(formatCustomer(data));
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

function formatCustomer(row) {
  const raw = row.raw_data?.tj_outbound || row.raw_data || {};

  let name = '';
  if (raw.customer_name) name = raw.customer_name;
  else if (row.customer_id) name = `Customer #${row.customer_id}`;

  let status = 'sent';
  if (row.stop_reminders) status = 'stopped';
  else if (row.last_inbound_at) status = 'replied';

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
