import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Simple estimation based on date
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const hoursSinceStart =
      (now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60);

    // Estimate API calls used today (rough calculation)
    // This is a simple estimation - in a real app you'd track actual API calls
    const estimatedCallsUsed = Math.floor(hoursSinceStart * 4); // Assume ~4 calls per hour average
    const remainingCalls = Math.max(0, 100 - estimatedCallsUsed);

    return NextResponse.json({
      totalDailyLimit: 100,
      estimatedCallsUsed,
      remainingCalls,
      percentageUsed: Math.round((estimatedCallsUsed / 100) * 100),
      cacheStrategy: {
        duration: '6 hours',
        description:
          'News articles are cached for 6 hours to minimize API calls'
      }
    });
  } catch (error) {
    console.error('Error getting usage info:', error);
    return NextResponse.json(
      { error: 'Failed to get usage info' },
      { status: 500 }
    );
  }
}
