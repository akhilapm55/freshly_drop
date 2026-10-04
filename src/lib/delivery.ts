/**
 * Delivery distance & charge utilities (reusable, framework-agnostic).
 *
 *   calculateDelivery(dest)            → { distanceKm, charge, available, method }
 *   getDeliveryChargeForDistance(km)   → ₹ charge or null (unavailable)
 *   haversineDistanceKm(a, b)          → straight-line km
 *
 * Driving distance is preferred (Google); if Google is unavailable it falls back
 * to straight-line distance. Pricing slabs and the store location come from
 * src/config/delivery.ts — nothing here is hardcoded.
 */
import {
  STORE_LOCATION,
  DELIVERY_SLABS,
  MAX_DELIVERY_KM,
  type LatLng,
  type DeliverySlab,
} from '../config/delivery';
import { isGoogleMapsEnabled, getDrivingDistanceKm } from './googleMaps';

export type DistanceMethod = 'driving' | 'straight-line';

export interface DeliveryResult {
  /** Distance from the store, in km (rounded to 1 decimal). */
  distanceKm: number;
  /** Delivery charge in ₹, or null when outside the serviceable range. */
  charge: number | null;
  /** Whether delivery is available to this location. */
  available: boolean;
  /** How the distance was measured. */
  method: DistanceMethod;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (straight-line) distance between two coordinates, in km. */
export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Map a distance to a delivery charge using the slabs. Returns null when the
 * distance is beyond the last slab (delivery unavailable).
 */
export function getDeliveryChargeForDistance(
  distanceKm: number,
  slabs: DeliverySlab[] = DELIVERY_SLABS
): number | null {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;
  for (const slab of slabs) {
    if (distanceKm <= slab.maxKm) return slab.charge;
  }
  return null;
}

/** True when the destination is within the serviceable delivery radius. */
export function isWithinDeliveryRadius(distanceKm: number, maxKm = MAX_DELIVERY_KM): boolean {
  return Number.isFinite(distanceKm) && distanceKm <= maxKm;
}

/**
 * Free road (driving) distance via the public OSRM routing service — no API key.
 * Returns km along actual roads. Throws if no route is found.
 */
export async function getRoadDistanceKm(origin: LatLng, dest: LatLng): Promise<number> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false&alternatives=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Routing service unavailable.');
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('No road route found.');
  return data.routes[0].distance / 1000; // metres → km
}

export interface CalculateDeliveryOptions {
  store?: LatLng;
  slabs?: DeliverySlab[];
}

/**
 * Calculate distance + charge for a destination. Tries driving distance first
 * (Google), then falls back to straight-line. Never throws for "out of range" —
 * it returns available:false so the UI can show a friendly message.
 */
export async function calculateDelivery(
  dest: LatLng,
  options: CalculateDeliveryOptions = {}
): Promise<DeliveryResult> {
  const store = options.store ?? STORE_LOCATION;

  if (
    !dest ||
    !Number.isFinite(dest.lat) ||
    !Number.isFinite(dest.lng)
  ) {
    throw new Error('A valid delivery location is required.');
  }

  let distanceKm: number | undefined;
  let method: DistanceMethod = 'straight-line';

  // 1. Google driving distance (only if a Maps key is configured)
  // if (isGoogleMapsEnabled) {
  //   try {
  //     distanceKm = await getDrivingDistanceKm(store, dest);
  //     method = 'driving';
  //   } catch {
  //     /* fall through */
  //   }
  // }
  if (isGoogleMapsEnabled) {
    try {
      distanceKm = await getDrivingDistanceKm(store, dest);
      method = 'driving';

      console.log('GOOGLE DRIVING DISTANCE:', distanceKm);
    } catch (error) {
      console.log('GOOGLE MAPS FAILED:', error);
    }
  }
  // 2. Free road distance via OSRM (no key needed)
  if (distanceKm === undefined) {
    try {
      distanceKm = await getRoadDistanceKm(store, dest);
      method = 'driving';
    } catch {
      /* fall through */
    }
  }

  // 3. Last resort: straight-line estimate
  if (distanceKm === undefined) {
    distanceKm = haversineDistanceKm(store, dest);
    method = 'straight-line';
  }

  const rounded = Math.round(distanceKm * 10) / 10;
  const charge = getDeliveryChargeForDistance(rounded, options.slabs);

  return {
    distanceKm: rounded,
    charge,
    available: charge !== null,
    method,
  };
}
