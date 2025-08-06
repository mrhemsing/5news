# 5News - News Explained Simply

A Next.js application that displays top news headlines and explains them in simple terms using OpenAI's GPT model.

## Features

- 📰 Fetches top 10 news headlines from NewsAPI.org
- 🤖 Uses OpenAI GPT to explain complex news stories in simple terms
- 🎨 Modern, responsive UI with dark mode support
- ⚡ Fast loading with Next.js App Router
- 🔄 Real-time explanations with loading states

## Prerequisites

Before running this application, you'll need to obtain API keys for:

1. **NewsAPI.org** - For fetching news headlines
2. **OpenAI** - For generating simple explanations

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# News API Key (Get from https://newsapi.org/)
NEWS_API_KEY=your_news_api_key_here

# OpenAI API Key (Get from https://platform.openai.com/)
OPENAI_API_KEY=your_openai_api_key_here

# Supabase Configuration (Optional - for future database features)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Get API Keys

#### NewsAPI.org

1. Visit [https://newsapi.org/](https://newsapi.org/)
2. Sign up for a free account
3. Get your API key from the dashboard
4. Add it to your `.env.local` file

#### OpenAI

1. Visit [https://platform.openai.com/](https://platform.openai.com/)
2. Create an account and add billing information
3. Generate an API key
4. Add it to your `.env.local` file

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## How It Works

1. **News Fetching**: The app fetches the top 10 US headlines from NewsAPI.org
2. **Display**: News articles are displayed in a clean, card-based layout
3. **Explanation**: Click "Explain Like I'm 5" to get a simple explanation using OpenAI
4. **Caching**: Explanations are cached in the component state to avoid repeated API calls

## API Endpoints

- `GET /api/news` - Fetches top headlines from NewsAPI.org
- `POST /api/explain` - Generates simple explanations using OpenAI

## Technologies Used

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **NewsAPI.org** - News data
- **OpenAI GPT** - AI explanations
- **Supabase** - Database (configured for future use)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── news/route.ts      # News API endpoint
│   │   └── explain/route.ts   # OpenAI explanation endpoint
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Main page component
├── components/
│   └── NewsCard.tsx           # News article card component
├── lib/
│   ├── supabase.ts            # Supabase client
│   └── openai.ts              # OpenAI client
└── types/
    └── news.ts                # TypeScript types
```

## Customization

### Changing News Source

To change the news source or country, modify the API call in `src/app/api/news/route.ts`:

```typescript
// Change country from 'us' to 'gb', 'ca', etc.
const response = await fetch(
  `https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}&pageSize=10`
);
```

### Modifying Explanations

To change the explanation style, modify the prompt in `src/app/api/explain/route.ts`:

```typescript
const prompt = `Explain this news story to me like I'm 5 years old...`;
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

The app can be deployed to any platform that supports Next.js:

- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this project for your own purposes.

## Support

If you encounter any issues:

1. Check that all API keys are correctly set in `.env.local`
2. Ensure you have billing set up for OpenAI
3. Verify your NewsAPI.org account is active
4. Check the browser console for any error messages
