import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Upload generated cartoons into Supabase Storage so thumbnails don't disappear
// when Replicate delivery URLs expire.
//
// Requires (Vercel env vars):
// - NEXT_PUBLIC_SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY   (server-only)
// - SUPABASE_STORAGE_BUCKET     (optional, default: cartoons)

function sha1(s: string) {
  return crypto.createHash('sha1').update(s).digest('hex');
}

export type StoreCartoonResult =
  | { ok: true; publicUrl: string; path: string }
  | { ok: false; reason: string };

export async function storeCartoonInSupabaseStorage(opts: {
  headlineKey: string; // cleaned headline (cache key)
  sourceUrl: string; // Replicate delivery URL
}): Promise<StoreCartoonResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'cartoons';

  if (!supabaseUrl || !serviceKey) {
    return { ok: false, reason: 'Supabase Storage not configured (missing SUPABASE_SERVICE_ROLE_KEY)' };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Download image bytes (with a hard timeout)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(opts.sourceUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': '5news-bot/1.0' },
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return { ok: false, reason: `Failed to fetch source image: ${res.status} ${txt.slice(0, 120)}` };
  }

  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const isPng = ct.includes('png');
  const isJpeg = ct.includes('jpeg') || ct.includes('jpg');
  const ext = isJpeg ? 'jpg' : 'png';

  const bytes = await res.arrayBuffer();
  const hash = sha1(opts.headlineKey);
  const objectPath = `${hash}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(objectPath, bytes, {
      upsert: true,
      contentType: isJpeg ? 'image/jpeg' : (isPng ? 'image/png' : (ct || 'image/png')),
      cacheControl: '31536000',
    });

  if (upErr) {
    return { ok: false, reason: `Supabase upload failed: ${upErr.message}` };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  const publicUrl = data.publicUrl;

  if (!publicUrl) {
    return { ok: false, reason: 'Could not compute public URL after upload' };
  }

  return { ok: true, publicUrl, path: objectPath };
}
