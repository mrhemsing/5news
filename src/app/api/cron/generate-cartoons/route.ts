import { NextResponse } from 'next/server';
import {
  getLatestHeadlines,
  generateCartoons
} from '@/scripts/generate-cartoons';

export async function GET(request: Request) {
  try {
    console.log('Cron job triggered: Generating cartoons...');

    // Get latest headlines
    const headlines = await getLatestHeadlines();
    console.log(`Found ${headlines.length} headlines to process`);

    if (headlines.length === 0) {
      console.log('No headlines found, exiting');
      return NextResponse.json({
        success: true,
        message: 'No headlines found'
      });
    }

    // Generate cartoons for headlines
    const result = await generateCartoons(headlines);

    if (result.success) {
      console.log('Background cartoon generation completed successfully');
      console.log(`Processed ${result.results.length} headlines`);

      const stats = {
        success: result.results.filter(r => r.status === 'success').length,
        cached: result.results.filter(r => r.status === 'cached').length,
        failed: result.results.filter(r => r.status === 'failed').length
      };

      console.log('Stats:', stats);

      return NextResponse.json({
        success: true,
        message: 'Cartoons generated successfully',
        stats
      });
    } else {
      console.error('Background cartoon generation failed:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { success: false, error: 'Cron job failed' },
      { status: 500 }
    );
  }
}
