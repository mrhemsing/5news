import OpenAI from 'openai';

// IMPORTANT: do not instantiate OpenAI at module load.
// Vercel/Next can evaluate route modules during build, and missing env vars would fail the build.
export function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }
  return new OpenAI({ apiKey });
}
