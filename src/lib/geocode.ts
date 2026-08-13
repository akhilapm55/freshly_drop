/**
 * Turn an address into latitude/longitude.
 * Uses Google's Geocoder when a Maps key is configured, otherwise the free
 * OpenStreetMap Nominatim service.
 *
 * Two entry points:
 *   geocodeAddress(text)        — free-text, single shot (used by saved addresses)
 *   geocodeStructured(parts)    — house/street/town/landmark, with precision checks
 *
 * Why geocodeStructured exists: Indian house-level addresses frequently fail to
 * resolve, and a geocoder that cannot place them silently returns the CENTRE OF
 * THE TOWN instead of an error. That looks like a successful lookup but produces
 * a delivery distance that is wrong by kilometres. So we inspect how precise the
 * match was and, when it is only town-level, retry using the landmark — landmarks
 * are usually well-known points of interest with accurate coordinates.
 */
import { isGoogleMapsEnabled, loadGoogleMaps } from './googleMaps';
import { DELIVERY_COUNTRY, STORE_LOCATION, type LatLng } from '../config/delivery';
import { haversineDistanceKm } from './delivery';

/** How exactly the coordinates could be pinned down. */
export type GeocodePrecision = 'exact' | 'approximate';

/** Which part of the address actually produced the coordinates. */
export type GeocodeMatchedOn = 'address' | 'landmark' | 'town';

export interface AddressParts {
  /** Flat / house / building name or number. */
  house?: string;
  /** Street, road or area. */
  street?: string;
  /** Town or city. */
  town?: string;
  /** Optional nearby landmark. */
  landmark?: string;
}

export interface StructuredGeocodeResult extends LatLng {
  precision: GeocodePrecision;
  matchedOn: GeocodeMatchedOn;
  /** Human-readable address as understood by the geocoder. */
  formatted: string;
}

interface Candidate extends LatLng {
  precision: GeocodePrecision;
  formatted: string;
}

/** Google location_types that mean "we only know the general area". */
const VAGUE_GOOGLE_TYPES = new Set(['APPROXIMATE', 'GEOMETRIC_CENTER']);

/** Nominatim address types that mean "this is a whole settlement, not a place". */
const VAGUE_OSM_TYPES = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'suburb',
  'state',
  'county',
  'district',
  'postcode',
  'administrative',
]);

/** Join the parts a customer typed into one readable address line. */
export function formatAddressParts(parts: AddressParts): string {
  return [parts.house, parts.street, parts.town]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Of several geocoder candidates, take the one nearest the store. Place names
 * repeat all over India, so "MG Road" can match a dozen towns — the nearest hit
 * is almost always the intended one for a shop with a ~12 km delivery radius.
 */
function pickNearest(candidates: Candidate[]): Candidate | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) =>
    haversineDistanceKm(STORE_LOCATION, c) < haversineDistanceKm(STORE_LOCATION, best) ? c : best
  );
}

async function geocodeViaGoogle(query: string): Promise<Candidate[]> {
  await loadGoogleMaps();
  const google = (window as any).google;
  const geocoder = new google.maps.Geocoder();
  let results: any[] = [];
  try {
    const res = await geocoder.geocode({
      address: query,
      componentRestrictions: { country: DELIVERY_COUNTRY },
    });
    results = res?.results ?? [];
  } catch {
    return []; // ZERO_RESULTS and friends reject — treat as "no candidates"
  }
  return results.map((r) => {
    const loc = r.geometry.location;
    // partial_match means Google had to guess at part of the string.
    const vague = VAGUE_GOOGLE_TYPES.has(r.geometry.location_type) || r.partial_match === true;
    return {
      lat: loc.lat(),
      lng: loc.lng(),
      precision: (vague ? 'approximate' : 'exact') as GeocodePrecision,
      formatted: r.formatted_address || query,
    };
  });
}

async function geocodeViaNominatim(query: string): Promise<Candidate[]> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1` +
    `&countrycodes=${DELIVERY_COUNTRY}&q=${encodeURIComponent(query)}`;
  let data: any;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map((d: any) => ({
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    precision: (VAGUE_OSM_TYPES.has(d.addresstype) ? 'approximate' : 'exact') as GeocodePrecision,
    formatted: d.display_name || query,
  }));
}

async function geocodeQuery(query: string): Promise<Candidate | null> {
  const text = query.trim();
  if (!text) return null;
  const candidates = isGoogleMapsEnabled
    ? await geocodeViaGoogle(text)
    : await geocodeViaNominatim(text);
  return pickNearest(candidates);
}

/**
 * Locate a structured address, preferring the most precise interpretation.
 *
 * Order of attempts:
 *   1. house + street + town  — the actual doorstep, if the geocoder knows it
 *   2. landmark + town        — used when (1) is missing or only town-accurate
 *   3. town alone             — last resort; reported as approximate
 *
 * Throws only when nothing at all could be located.
 */
export async function geocodeStructured(parts: AddressParts): Promise<StructuredGeocodeResult> {
  const house = (parts.house || '').trim();
  const street = (parts.street || '').trim();
  const town = (parts.town || '').trim();
  const landmark = (parts.landmark || '').trim();

  if (!town && !street && !house && !landmark) {
    throw new Error('Please enter your address.');
  }

  const fullQuery = [house, street, town].filter(Boolean).join(', ');
  const landmarkQuery = [landmark, town].filter(Boolean).join(', ');

  // Best approximate result seen so far, used only if nothing exact turns up.
  let fallback: StructuredGeocodeResult | null = null;

  const remember = (c: Candidate | null, matchedOn: GeocodeMatchedOn) => {
    if (!c) return null;
    const result: StructuredGeocodeResult = { ...c, matchedOn };
    if (c.precision === 'exact') return result;
    if (!fallback) fallback = result;
    return null;
  };

  // 1. The address as typed.
  if (fullQuery) {
    const exact = remember(await geocodeQuery(fullQuery), 'address');
    if (exact) return exact;
  }

  // 2. The landmark — often the only precisely-mapped thing in the address.
  if (landmarkQuery && landmark) {
    const exact = remember(await geocodeQuery(landmarkQuery), 'landmark');
    if (exact) return exact;
  }

  // 3. Town centre, so the customer at least gets a rough charge to sanity-check.
  if (town) {
    const exact = remember(await geocodeQuery(town), 'town');
    if (exact) return exact;
  }

  if (fallback) return fallback;
  throw new Error('Could not find that address. Add a nearby landmark or the PIN code.');
}

/** Free-text geocode (single best hit nearest the store). */
export async function geocodeAddress(query: string): Promise<LatLng> {
  const text = query.trim();
  if (!text) throw new Error('Please enter an address or landmark.');
  const best = await geocodeQuery(text);
  if (!best) {
    throw new Error('Could not find that address. Add area / town / PIN code.');
  }
  return { lat: best.lat, lng: best.lng };
}
