import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import axios from 'axios';

const router = Router();

const STATIONS = [
  { station_id: 58, station_name: 'Vaajakoski' },
  { station_id: 59, station_name: 'Jämsä' },
  { station_id: 60, station_name: 'Laukaa' },
  { station_id: 61, station_name: 'Muurame' },
];

async function ensureStationPauseRows() {
  const { error } = await supabase
    .from('tj_station_pause')
    .upsert(
      STATIONS.map((station) => ({
        ...station,
        paused: false,
        pause_outbound: true,
        pause_reminders: true,
      })),
      { onConflict: 'station_id', ignoreDuplicates: true }
    );

  if (error) throw error;
}

router.post('/trigger', async (req, res) => {
  const { max_leads_to_send, lead_type } = req.body;

  const webhookUrl = process.env.N8N_FEEDER_WEBHOOK;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'N8N_FEEDER_WEBHOOK not configured' });
  }

  const count = Number(max_leads_to_send) || 50;
  if (count < 1 || count > 500) {
    return res.status(400).json({ error: 'max_leads_to_send must be 1-500' });
  }

  const validTypes = ['both', 'passed', 'due_soon'];
  const type = validTypes.includes(lead_type) ? lead_type : 'both';

  try {
    axios.post(webhookUrl, { max_leads_to_send: count, lead_type: type }, { timeout: 300_000 })
      .catch(err => console.error('[feeder-bg]', err.message));

    res.json({ ok: true, triggered: count, lead_type: type, triggered_at: new Date().toISOString() });
  } catch (err) {
    console.error('[feeder]', err.message);
    res.status(502).json({ error: 'Failed to trigger feeder', detail: err.message });
  }
});

router.get('/progress', async (req, res) => {
  const { since } = req.query;
  if (!since) {
    return res.status(400).json({ error: 'since query param required (ISO timestamp)' });
  }

  const { count, error } = await supabase
    .from('tj_outbound_sessions')
    .select('*', { count: 'exact', head: true })
    .gt('last_outbound_at', since);

  if (error) {
    console.error('[feeder-progress]', error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ new_sessions: count || 0, since });
});

router.get('/status', async (_req, res) => {
  const { data, error } = await supabase
    .from('tj_outbound_sessions')
    .select('last_outbound_at')
    .order('last_outbound_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[feeder-status]', error);
    return res.status(500).json({ error: error.message });
  }

  const { count } = await supabase
    .from('tj_outbound_sessions')
    .select('*', { count: 'exact', head: true });

  res.json({
    total_contacted: count || 0,
    last_sent_at: data?.last_outbound_at || null,
  });
});

router.get('/auto-send', async (_req, res) => {
  const { data, error } = await supabase
    .from('tj_config')
    .select('auto_send_due_soon, auto_send_passed, updated_at')
    .eq('id', 'main')
    .maybeSingle();

  if (error) {
    console.error('[auto-send]', error);
    return res.status(500).json({ error: error.message });
  }

  res.json({
    auto_send_due_soon: data?.auto_send_due_soon ?? false,
    auto_send_passed: data?.auto_send_passed ?? false,
    updated_at: data?.updated_at ?? null,
  });
});

router.put('/auto-send', async (req, res) => {
  const { type, enabled } = req.body;

  if (!['due_soon', 'passed'].includes(type)) {
    return res.status(400).json({ error: 'type must be "due_soon" or "passed"' });
  }
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }

  const column = type === 'due_soon' ? 'auto_send_due_soon' : 'auto_send_passed';
  const { error } = await supabase
    .from('tj_config')
    .update({ [column]: enabled, updated_at: new Date().toISOString() })
    .eq('id', 'main');

  if (error) {
    console.error('[auto-send]', error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true, [column]: enabled });
});

router.get('/station-pause', async (_req, res) => {
  try {
    await ensureStationPauseRows();

    const { data, error } = await supabase
      .from('tj_station_pause')
      .select('station_id, station_name, paused, pause_outbound, pause_reminders, reason, updated_at')
      .order('station_id', { ascending: true });

    if (error) throw error;

    res.json({ stations: data || [] });
  } catch (err) {
    console.error('[station-pause]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/station-pause/:stationId', async (req, res) => {
  const stationId = Number(req.params.stationId);
  const { paused, reason } = req.body;

  if (!STATIONS.some((station) => station.station_id === stationId)) {
    return res.status(400).json({ error: 'unknown station id' });
  }
  if (typeof paused !== 'boolean') {
    return res.status(400).json({ error: 'paused must be a boolean' });
  }

  const station = STATIONS.find((item) => item.station_id === stationId);
  const payload = {
    station_id: stationId,
    station_name: station.station_name,
    paused,
    pause_outbound: true,
    pause_reminders: true,
    reason: paused ? (reason || 'Paused from dashboard') : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('tj_station_pause')
    .upsert(payload, { onConflict: 'station_id' })
    .select('station_id, station_name, paused, pause_outbound, pause_reminders, reason, updated_at')
    .single();

  if (error) {
    console.error('[station-pause]', error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true, station: data });
});

export default router;
