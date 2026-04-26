import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

router.get('/:phone', async (req, res) => {
  const { phone } = req.params;
  const normalized = phone.replace(/[^0-9]/g, '').replace(/^0/, '358');
  const sessionId = `tj-${normalized}`;

  const [chatRes, statusRes] = await Promise.all([
    supabase
      .from('chat_history')
      .select('id, session_id, message, timestamp')
      .eq('session_id', sessionId)
      .order('id', { ascending: true }),
    supabase
      .from('tj_message_status')
      .select('wamid, status, delivered_at, read_at')
      .eq('number', normalized),
  ]);

  if (chatRes.error) {
    console.error('[chat]', chatRes.error);
    return res.status(500).json({ error: chatRes.error.message });
  }

  const statusByWamid = {};
  for (const s of (statusRes.data || [])) {
    statusByWamid[s.wamid] = s;
  }

  const messages = (chatRes.data || []).map((row) => {
    const msg = row.message;
    const type = msg?.type || 'system';
    const content = msg?.content || msg?.data?.content || '';
    const kwargs = msg?.additional_kwargs || msg?.data?.additional_kwargs || {};
    const wamid = kwargs.wamid || null;
    const msgStatus = wamid ? statusByWamid[wamid] : null;

    return {
      id: row.id,
      type,
      text: content,
      created_at: row.timestamp,
      template_name: kwargs.template_name || null,
      wamid,
      delivery_status: msgStatus?.status || (type === 'ai' ? 'sent' : null),
      delivered_at: msgStatus?.delivered_at || null,
      read_at: msgStatus?.read_at || null,
    };
  });

  res.json({ session_id: sessionId, messages });
});

export default router;
