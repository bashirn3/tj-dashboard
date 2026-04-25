import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import axios from 'axios';

const router = Router();

const YCLOUD_API_KEY = 'cceca7f729213f2d7dc84082acb63a21';
const YCLOUD_BASE = 'https://api.ycloud.com/v2';
const BATCH_SIZE = 20;

router.post('/poll', async (_req, res) => {
  const { data: pending, error } = await supabase
    .from('tj_message_status')
    .select('id, wamid, number, status')
    .neq('status', 'read')
    .order('sent_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[poll]', error);
    return res.status(500).json({ error: error.message });
  }

  if (!pending || pending.length === 0) {
    return res.json({ updated: 0, total_pending: 0 });
  }

  let updated = 0;

  const results = await Promise.allSettled(
    pending.map(async (msg) => {
      try {
        const { data } = await axios.get(`${YCLOUD_BASE}/whatsapp/messages/${msg.wamid}`, {
          headers: { 'X-API-Key': YCLOUD_API_KEY },
          timeout: 10_000,
        });

        const newStatus = data.status || msg.status;
        if (newStatus === msg.status) return null;

        const updates = { status: newStatus, updated_at: new Date().toISOString() };
        if (newStatus === 'delivered' && !msg.delivered_at) updates.delivered_at = new Date().toISOString();
        if (newStatus === 'read') {
          if (!msg.delivered_at) updates.delivered_at = new Date().toISOString();
          updates.read_at = new Date().toISOString();
        }

        const { error: uErr } = await supabase
          .from('tj_message_status')
          .update(updates)
          .eq('id', msg.id);

        if (uErr) {
          console.error(`[poll] update ${msg.wamid}:`, uErr.message);
          return null;
        }

        updated++;
        return { wamid: msg.wamid, from: msg.status, to: newStatus };
      } catch (err) {
        return null;
      }
    })
  );

  res.json({ updated, total_pending: pending.length });
});

router.get('/statuses', async (req, res) => {
  const { number } = req.query;

  let query = supabase
    .from('tj_message_status')
    .select('wamid, number, stage, status, sent_at, delivered_at, read_at');

  if (number) {
    query = query.eq('number', number);
  }

  const { data, error } = await query.order('sent_at', { ascending: true });

  if (error) {
    console.error('[statuses]', error);
    return res.status(500).json({ error: error.message });
  }

  res.json(data || []);
});

export default router;
