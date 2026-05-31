import './env.js';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn('[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// PostgREST hard-caps each request at 1000 rows, so a single .select() silently
// truncates large tables (we have >1200 sessions). This pages through every row.
// `buildQuery` must return a FRESH query each call and include a stable .order().
export async function fetchAll(buildQuery, pageSize = 1000) {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data || [];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
