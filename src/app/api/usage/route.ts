import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Calculate hours since start of day (UTC)
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const hoursSinceStart =
      (now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60);

    // Google News RSS is unlimited, so we'll show a different metric
    const totalDailyLimit = 'Unlimited';
    const estimatedCallsUsed = Math.floor(hoursSinceStart * 0.5); // Conservative estimate
    const remainingCalls = 'Unlimited';
    const percentageUsed = 0; // Always 0% since unlimited

    return NextResponse.json({
      totalDailyLimit,
      estimatedCallsUsed,
      remainingCalls,
      percentageUsed,
      cacheStrategy: {
        duration: '6 hours',
        method: 'Google News RSS',
        benefits: 'Unlimited requests, high-quality sources, less duplicates'
      }
    });
  } catch (error) {
    console.error('Error calculating usage:', error);
    return NextResponse.json(
      { error: 'Failed to calculate usage' },
      { status: 500 }
    );
  }
}
