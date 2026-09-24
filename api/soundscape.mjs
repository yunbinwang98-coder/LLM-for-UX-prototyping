const moods = Object.freeze({
  calm: 'calm and spacious', energized: 'bright and energized', tired: 'soft and unhurried',
  hopeful: 'warm and hopeful', restless: 'curious and gently shifting', focused: 'clear and steady',
  inbetween: 'balanced and easygoing'
});
const textures = Object.freeze({ soft: 'soft and rounded', rhythmic: 'gently rhythmic', airy: 'airy with open space', warm: 'warm and mellow', bright: 'bright and light' });

function summarize(choices) {
  const moodCounts = new Map();
  const textureCounts = new Map();
  for (const choice of choices) {
    moodCounts.set(choice.mood, (moodCounts.get(choice.mood) || 0) + 1);
    if (choice.sound) textureCounts.set(choice.sound, (textureCounts.get(choice.sound) || 0) + 1);
  }
  const leader = counts => [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { mood: leader(moodCounts), texture: leader(textureCounts) };
}

export async function POST(request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ error: 'AI sound generation is not configured. Add ELEVENLABS_API_KEY to the server environment.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Send valid JSON.' }, { status: 400 }); }
  const choices = body?.choices;
  if (!Array.isArray(choices) || choices.length < 1 || choices.length > 3 || choices.some(choice => !choice || !Object.hasOwn(moods, choice.mood) || (choice.sound != null && !Object.hasOwn(textures, choice.sound)))) {
    return Response.json({ error: 'Choose up to three valid rider mood and texture contributions.' }, { status: 400 });
  }

  const { mood, texture } = summarize(choices);
  const prompt = `Compose an original instrumental music passage for a shared public bus stop listening experience. Overall feeling: ${moods[mood]}. Sound texture: ${texture ? textures[texture] : 'gentle and spacious'}. Make it a cohesive, gently evolving musical arrangement with a clear but understated pulse, restrained dynamics, and a natural ending. Keep it suitable for a public place and background listening. No vocals, lyrics, speech, artist imitation, recognizable melodies, abrupt sounds, or dramatic build.`;
  try {
    const upstream = await fetch('https://api.elevenlabs.io/v1/music', {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ prompt, music_length_ms: 30_000, force_instrumental: true, model_id: 'music_v2_5' }),
      signal: AbortSignal.timeout(90_000)
    });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 500);
      console.error('ElevenLabs sound generation failed:', upstream.status, detail);
      return Response.json({ error: 'The soundscape service could not generate audio right now.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    return new Response(await upstream.arrayBuffer(), { headers: { 'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Soundscape-Mood': mood } });
  } catch (error) {
    console.error('ElevenLabs sound generation request failed:', error);
    return Response.json({ error: 'The soundscape service could not be reached.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
