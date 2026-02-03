#!/usr/bin/env node

// Real background thumbnail generation:
// - Fetch latest headlines from Supabase
// - Check cartoon_cache for missing cartoons
// - Generate via Replicate
// - Download result and upload to Supabase Storage
// - Upsert cartoon_cache with durable public URL
//
// Designed to run in GitHub Actions (or any Node environment) without relying on Vercel serverless timeouts.

const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'cartoons';

function sha1(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function cleanForCartoon(title) {
  return String(title ?? '')
    .replace(/\s*\([^)]*\)\s*/g, ' ') // remove parenthetical
    .replace(/\s*-\s*.*$/, '') // remove " - Source" suffix
    .replace(/["']/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200);
    throw new Error(`HTTP ${res.status} ${url}: ${msg}`);
  }
  return data;
}

async function replicateGenerateImage(prompt, negativePrompt) {
  requireEnv('REPLICATE_API_TOKEN', REPLICATE_API_TOKEN);

  const prediction = await fetchJson('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
      input: {
        prompt,
        negative_prompt: negativePrompt,
        num_inference_steps: 20,
        guidance_scale: 7.5,
        width: 512,
        height: 512,
        seed: Math.floor(Math.random() * 1000000),
      },
    }),
  });

  // Poll up to ~120s
  const getUrl = prediction?.urls?.get;
  if (!getUrl) throw new Error('Replicate prediction missing urls.get');

  for (let i = 0; i < 120; i++) {
    await sleep(1000);
    const status = await fetchJson(getUrl, {
      headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
    });

    if (status.status === 'succeeded') {
      const out = status.output;
      const url = Array.isArray(out) ? out[0] : out;
      if (!url) throw new Error('Replicate succeeded but no output URL');
      return String(url);
    }

    if (status.status === 'failed' || status.status === 'canceled') {
      throw new Error(`Replicate prediction ${status.status}`);
    }
  }

  throw new Error('Replicate prediction timed out');
}

async function downloadBytes(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': '5news-gha/1.0',
      Range: 'bytes=0-',
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to download image: ${res.status} ${txt.slice(0, 120)}`);
  }
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const bytes = await res.arrayBuffer();
  return { bytes, contentType: ct || 'image/png' };
}

async function uploadToSupabaseStorage(supabase, headlineKey, sourceUrl) {
  const { bytes, contentType } = await downloadBytes(sourceUrl);

  const isJpeg = contentType.includes('jpeg') || contentType.includes('jpg');
  const ext = isJpeg ? 'jpg' : 'png';

  const objectPath = `${sha1(headlineKey)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(objectPath, bytes, {
      upsert: true,
      contentType: isJpeg ? 'image/jpeg' : 'image/png',
      cacheControl: '31536000',
    });

  if (upErr) throw new Error(`Supabase upload failed: ${upErr.message}`);

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(objectPath);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) throw new Error('Supabase getPublicUrl returned empty');

  // Quick public verification (avoid "200 json not found")
  const verify = await fetch(publicUrl, { headers: { Range: 'bytes=0-1' } });
  const vct = (verify.headers.get('content-type') || '').toLowerCase();
  if (!verify.ok || vct.includes('application/json')) {
    throw new Error(`Supabase public URL not accessible after upload: ${verify.status} ${vct}`);
  }

  return { publicUrl, objectPath };
}

async function upsertCartoonCache(supabase, headlineKey, cartoonUrl) {
  const { error } = await supabase
    .from('cartoon_cache')
    .upsert(
      {
        headline: headlineKey,
        cartoon_url: cartoonUrl,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'headline', ignoreDuplicates: false }
    );

  if (error) throw new Error(`Upsert cartoon_cache failed: ${error.message}`);
}

async function main() {
  requireEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL);
  requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const limit = Number(process.env.CARTOON_WARM_LIMIT || 60);
  const maxNew = Number(process.env.CARTOON_WARM_MAX_NEW || 12);
  const minDelayMs = Number(process.env.CARTOON_WARM_MIN_DELAY_MS || 16000);

  console.log(`[warm] fetching latest ${limit} headlines...`);
  const { data: headlines, error: hlErr } = await supabase
    .from('headlines')
    .select('id,title,publishedAt')
    .order('publishedAt', { ascending: false })
    .limit(limit);

  if (hlErr) throw new Error(`Fetch headlines failed: ${hlErr.message}`);
  if (!headlines || headlines.length === 0) {
    console.log('[warm] no headlines found');
    return;
  }

  const keys = Array.from(
    new Set(headlines.map(h => cleanForCartoon(h.title)).filter(Boolean))
  );

  console.log(`[warm] unique headline keys: ${keys.length}`);

  // Load existing cache rows for these keys.
  const { data: cached, error: cErr } = await supabase
    .from('cartoon_cache')
    .select('headline')
    .in('headline', keys.slice(0, 200));

  if (cErr) throw new Error(`Fetch cartoon_cache failed: ${cErr.message}`);

  const cachedSet = new Set((cached || []).map(r => r.headline));
  const missing = keys.filter(k => !cachedSet.has(k));

  console.log(`[warm] cached: ${cachedSet.size}, missing: ${missing.length}`);

  const toGen = missing.slice(0, maxNew);
  console.log(`[warm] generating up to ${toGen.length} new cartoons this run`);

  let lastStart = 0;

  for (const key of toGen) {
    const now = Date.now();
    const wait = lastStart ? Math.max(0, minDelayMs - (now - lastStart)) : 0;
    if (wait) {
      console.log(`[warm] waiting ${wait}ms to respect rate limits...`);
      await sleep(wait);
    }
    lastStart = Date.now();

    const prompt = `cartoon illustration, childlike drawing style, simple lines, bright vibrant colors, cute and friendly, showing: ${key}, colorful background, fun and playful, kid-friendly art, simple clean composition, clear visual representation of the story`;
    const negative = 'realistic, photographic, adult, complex, dark, scary, blurry, text, words, letters';

    try {
      console.log(`[warm] generating: ${key}`);
      const replicateUrl = await replicateGenerateImage(prompt, negative);
      console.log(`[warm] replicate url ok`);

      const stored = await uploadToSupabaseStorage(supabase, key, replicateUrl);
      console.log(`[warm] stored ${stored.objectPath}`);

      await upsertCartoonCache(supabase, key, stored.publicUrl);
      console.log(`[warm] cached -> ${stored.publicUrl}`);
    } catch (e) {
      console.error(`[warm] FAILED for "${key}":`, e?.message || e);
    }
  }

  console.log('[warm] done');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
