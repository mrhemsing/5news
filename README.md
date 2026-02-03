# 5News - Kid-Friendly News App

A Next.js application that makes current news kid-friendly with AI-generated explanations and cartoons.

## Features

- **Kid-friendly news headlines** filtered for appropriate content
- **AI-generated explanations** that make complex topics simple
- **Cartoon illustrations** for each headline
- **Text-to-speech** for audio narration
- **Responsive design** for mobile and desktop

## Tech Stack

- **Next.js 14** - React framework
- **Tailwind CSS** - Styling and colors
- **Google News RSS** - News headlines
- **ElevenLabs** - Text-to-speech
- **Replicate** - AI cartoon generation
- **Supabase** - Database and caching
- **Vercel** - Deployment

## Environment Variables

Required environment variables:

- No API key required - Uses Google News RSS feeds
- `ELEVENLABS_API_KEY` - ElevenLabs API key
- `REPLICATE_API_TOKEN` - Replicate API token
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key

## Development

```bash
npm install
npm run dev
```

## Deployment

The app is automatically deployed to Vercel when changes are pushed to the main branch.

**Last updated: 2025-01-07 - Fixed build issues and deployment**

## Troubleshooting

If Vercel isn't deploying automatically:

1. Check Vercel project settings
2. Verify GitHub integration
3. Manually trigger deployment from Vercel dashboard


   


