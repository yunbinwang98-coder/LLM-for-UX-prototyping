const moods = Object.freeze({
  calm: 'calm and spacious', energized: 'bright and energized', tired: 'soft and unhurried',
  hopeful: 'warm and hopeful', restless: 'curious and gently shifting', focused: 'clear and steady',
  inbetween: 'balanced and easygoing'
});
const textures = Object.freeze({ soft: 'soft and rounded', rhythmic: 'gently rhythmic', airy: 'airy with open space', warm: 'warm and mellow', bright: 'bright and light' });

export async function POST(request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ error: 'AI sound generation is not configured. Add ELEVENLABS_API_KEY to the server environment.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Send valid JSON.' }, { status: 400 }); }
  let tally = body?.tally;
  if (!tally && Array.isArray(body?.choices) && body.choices.length <= 256) {
    tally = { moods: {}, textures: {} };
    for (const choice of body.choices) {
      if (!choice || !Object.hasOwn(moods, choice.mood) || (choice.sound != null && !Object.hasOwn(textures, choice.sound))) {
        return Response.json({ error: 'Choose valid moods and sound textures.' }, { status: 400 });
      }
      tally.moods[choice.mood] = (tally.moods[choice.mood] || 0) + 1;
      if (choice.sound) tally.textures[choice.sound] = (tally.textures[choice.sound] || 0) + 1;
    }
  }
  const validCounts = (counts, allowed) => counts && typeof counts === 'object' && !Array.isArray(counts) && Object.entries(counts).every(([key, value]) => Object.hasOwn(allowed, key) && Number.isSafeInteger(value) && value > 0 && value <= 1_000_000);
  if (!validCounts(tally?.moods, moods) || !validCounts(tally?.textures, textures)) {
    return Response.json({ error: 'Send valid rider mood and texture counts.' }, { status: 400 });
  }
  const total = Object.values(tally.moods).reduce((sum, value) => sum + value, 0);
  const textureTotal = Object.values(tally.textures).reduce((sum, value) => sum + value, 0);
  if (!total || textureTotal > total) return Response.json({ error: 'At least one rider mood is required.' }, { status: 400 });
  const mood = Object.keys(tally.moods).sort((a, b) => tally.moods[b] - tally.moods[a])[0];
  const describe = (counts, labels, count) => Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([key, value]) => `${labels[key]} (${Math.round(value / count * 100)}% of selections)`).join('; ');
  const prompt = `Compose an original instrumental music passage for a shared public bus stop listening experience. Reflect the blend of all ${total} riders' moods, giving more musical weight to the most common choices while including contrasting moods subtly: ${describe(tally.moods, moods, total)}. Sound textures: ${textureTotal ? describe(tally.textures, textures, textureTotal) : 'gentle and spacious'}. Make it a cohesive, gently evolving musical arrangement with a clear but understated pulse, restrained dynamics, and a natural ending. Keep it suitable for a public place and background listening. No vocals, lyrics, speech, artist imitation, recognizable melodies, abrupt sounds, or dramatic build.`;
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
