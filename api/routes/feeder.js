import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import axios from 'axios';

const router = Router();

router.post('/trigger', async (req, res) => {
  const { max_leads_to_send } = req.body;

  const webhookUrl = process.env.N8N_FEEDER_WEBHOOK;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'N8N_FEEDER_WEBHOOK not configured' });
  }

  const count = Number(max_leads_to_send) || 50;
  if (count < 1 || count > 500) {
    return res.status(400).json({ error: 'max_leads_to_send must be 1-500' });
  }

  try {
    const { data } = await axios.post(webhookUrl, { max_leads_to_send: count }, { timeout: 30_000 });
    res.json({ ok: true, triggered: count, response: data });
  } catch (err) {
    console.error('[feeder]', err.message);
    res.status(502).json({ error: 'Failed to trigger feeder', detail: err.message });
  }
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

export default router;
