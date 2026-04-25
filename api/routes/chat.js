import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

router.get('/:phone', async (req, res) => {
  const { phone } = req.params;

  const sessionId = `tj-${phone.replace(/^0/, '358')}`;

  const { data, error } = await supabase
    .from('chat_history')
    .select('id, session_id, message, timestamp')
    .eq('session_id', sessionId)
    .order('id', { ascending: true });

  if (error) {
    console.error('[chat]', error);
    return res.status(500).json({ error: error.message });
  }

  const messages = (data || []).map((row) => {
    const msg = row.message;
    const type = msg?.type || 'system';
    const content = msg?.data?.content || '';
    const kwargs = msg?.data?.additional_kwargs || {};

    return {
      id: row.id,
      type,
      text: content,
      created_at: row.timestamp,
      template_name: kwargs.template_name || null,
      wamid: kwargs.wamid || null,
    };
  });

  res.json({ session_id: sessionId, messages });
});

export default router;
