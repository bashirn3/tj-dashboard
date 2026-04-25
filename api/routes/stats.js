import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

router.get('/', async (_req, res) => {
  const [sessionsRes, statusesRes] = await Promise.all([
    supabase.from('tj_outbound_sessions').select('last_outbound_at, last_inbound_at, stop_reminders'),
    supabase.from('tj_message_status').select('status, sent_at'),
  ]);

  if (sessionsRes.error) {
    console.error('[stats]', sessionsRes.error);
    return res.status(500).json({ error: sessionsRes.error.message });
  }

  const sessions = sessionsRes.data || [];
  const statuses = statusesRes.data || [];

  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  let totalSent = 0;
  let totalReplied = 0;
  let weekSent = 0;
  let weekReplied = 0;
  let stopped = 0;

  for (const s of sessions) {
    totalSent++;
    if (s.last_inbound_at) totalReplied++;
    if (s.stop_reminders) stopped++;

    const sentAt = new Date(s.last_outbound_at);
    if (sentAt >= weekAgo) {
      weekSent++;
      if (s.last_inbound_at) weekReplied++;
    }
  }

  let delivered = 0;
  let read = 0;
  for (const m of statuses) {
    if (m.status === 'delivered' || m.status === 'read') delivered++;
    if (m.status === 'read') read++;
  }

  res.json({
    total: {
      sent: totalSent,
      delivered,
      read,
      replied: totalReplied,
      replyRate: totalSent ? Math.round((totalReplied / totalSent) * 100) : 0,
      stopped,
    },
    week: {
      sent: weekSent,
      replied: weekReplied,
      replyRate: weekSent ? Math.round((weekReplied / weekSent) * 100) : 0,
    },
  });
});

export default router;
