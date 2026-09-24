import { getArrival } from '../lib/septa-arrivals.mjs';

export async function GET() {
  try {
    const arrival = await getArrival();
    return Response.json(arrival, {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=15' }
    });
  } catch (error) {
    console.error('SEPTA arrival request failed:', error);
    return Response.json(
      { status: 'unavailable', error: 'Live SEPTA arrivals are temporarily unavailable.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
