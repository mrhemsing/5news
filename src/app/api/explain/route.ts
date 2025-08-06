import { NextResponse } from 'next/server';
import openai from '@/lib/openai';

export async function POST(request: Request) {
  try {
    const { title, content } = await request.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const prompt = `Explain this news story to me like I'm 5 years old. Keep it simple, friendly, and easy to understand.

Title: ${title}
Content: ${content}

Please provide a simple explanation that a 5-year-old would understand:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that explains complex news stories in simple terms that a 5-year-old child would understand. Use simple language, avoid jargon, and make it engaging and friendly.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    const explanation =
      completion.choices[0]?.message?.content ||
      'Unable to generate explanation';

    return NextResponse.json({ explanation });
  } catch (error) {
    console.error('Error generating explanation:', error);
    return NextResponse.json(
      { error: 'Failed to generate explanation' },
      { status: 500 }
    );
  }
}
