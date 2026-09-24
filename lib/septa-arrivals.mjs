const FEED_URL = 'https://www3.septa.org/gtfsrt/septa-pa-us/Trip/rtTripUpdates.pb';
const STOP = Object.freeze({ route: '21', stopId: '21360', stopName: 'Walnut St & 34th St', direction: 'Westbound' });
const decoder = new TextDecoder();
const CACHE_MS = 15_000;
let cachedResult = null;
let cachedAt = 0;
let pendingRequest = null;

function readVarint(bytes, cursor) {
  let value = 0n;
  let shift = 0n;
  for (let count = 0; count < 10; count++) {
    if (cursor.position >= bytes.length) throw new Error('Invalid SEPTA feed');
    const byte = bytes[cursor.position++];
    value |= BigInt(byte & 0x7f) << shift;
    if (!(byte & 0x80)) return value;
    shift += 7n;
  }
  throw new Error('Invalid SEPTA feed');
}

function eachField(bytes, visit) {
  const cursor = { position: 0 };
  while (cursor.position < bytes.length) {
    const tag = Number(readVarint(bytes, cursor));
    const field = tag >> 3;
    const wire = tag & 7;
    if (!field) throw new Error('Invalid SEPTA feed');
    let value;
    if (wire === 0) value = readVarint(bytes, cursor);
    else if (wire === 2) {
      const length = Number(readVarint(bytes, cursor));
      const end = cursor.position + length;
      if (end > bytes.length) throw new Error('Invalid SEPTA feed');
      value = bytes.subarray(cursor.position, end);
      cursor.position = end;
    } else if (wire === 1 || wire === 5) {
      const width = wire === 1 ? 8 : 4;
      if (cursor.position + width > bytes.length) throw new Error('Invalid SEPTA feed');
      cursor.position += width;
      continue;
    } else throw new Error('Invalid SEPTA feed');
    visit(field, value);
  }
}

function stopPrediction(bytes) {
  let stopId = null;
  let arrival = null;
  let departure = null;
  eachField(bytes, (field, value) => {
    if (field === 4) stopId = decoder.decode(value);
    if (field === 2 || field === 3) {
      let time = null;
      eachField(value, (eventField, eventValue) => {
        if (eventField === 2) time = Number(eventValue);
      });
      if (field === 2) arrival = time;
      else departure = time;
    }
  });
  return stopId === STOP.stopId ? arrival ?? departure : null;
}

function tripPredictions(bytes) {
  let route = null;
  const times = [];
  eachField(bytes, (field, value) => {
    if (field === 1) eachField(value, (tripField, tripValue) => {
      if (tripField === 5) route = decoder.decode(tripValue);
    });
    if (field === 2) {
      const time = stopPrediction(value);
      if (time !== null) times.push(time);
    }
  });
  return route === STOP.route ? times : [];
}

function parseFeed(bytes) {
  let feedTimestamp = null;
  const predictions = [];
  eachField(bytes, (field, value) => {
    if (field === 1) eachField(value, (headerField, headerValue) => {
      if (headerField === 3) feedTimestamp = Number(headerValue);
    });
    if (field === 2) eachField(value, (entityField, entityValue) => {
      if (entityField === 3) predictions.push(...tripPredictions(entityValue));
    });
  });
  return { feedTimestamp, predictions };
}

async function loadArrival() {
  const response = await fetch(FEED_URL, { signal: AbortSignal.timeout(12_000), cache: 'no-store' });
  if (!response.ok) throw new Error(`SEPTA returned ${response.status}`);
  const { feedTimestamp, predictions } = parseFeed(new Uint8Array(await response.arrayBuffer()));
  const now = Date.now();
  if (!feedTimestamp || Math.abs(now - feedTimestamp * 1000) > 180_000) {
    return { ...STOP, status: 'stale', arrivalAt: null, feedUpdatedAt: feedTimestamp ? new Date(feedTimestamp * 1000).toISOString() : null };
  }
  const upcoming = [...new Set(predictions)]
    .filter(time => Number.isFinite(time) && time * 1000 >= now - 30_000 && time * 1000 <= now + 7_200_000)
    .sort((a, b) => a - b)
    .slice(0, 3)
    .map(time => new Date(time * 1000).toISOString());
  return {
    ...STOP,
    status: upcoming.length ? 'live' : 'no-arrival',
    arrivalAt: upcoming[0] ?? null,
    nextArrivals: upcoming,
    feedUpdatedAt: new Date(feedTimestamp * 1000).toISOString(),
    source: 'SEPTA GTFS Realtime Trip Updates'
  };
}

export async function getArrival() {
  if (cachedResult && Date.now() - cachedAt < CACHE_MS) return cachedResult;
  if (!pendingRequest) {
    pendingRequest = loadArrival().then(result => {
      cachedResult = result;
      cachedAt = Date.now();
      return result;
    }).finally(() => { pendingRequest = null; });
  }
  return pendingRequest;
}
