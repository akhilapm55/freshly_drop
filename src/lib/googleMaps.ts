/**
 * Google Maps loader + driving-distance helper.
 *
 * Active only when VITE_GOOGLE_MAPS_API_KEY is set (Google Maps Platform needs
 * billing enabled — the free $200/month credit covers small-app usage). When the
 * key is absent, isGoogleMapsEnabled is false and callers fall back to free
 * OpenStreetMap geocoding + straight-line distance.
 */
import type { LatLng } from '../config/delivery';

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export const isGoogleMapsEnabled = Boolean(KEY);

let loadPromise: Promise<void> | null = null;

/** Load the Google Maps JS SDK (with the Places library) exactly once. */
export function loadGoogleMaps(): Promise<void> {
  if (!KEY) return Promise.reject(new Error('Google Maps is not configured.'));
  if ((window as any).google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const callbackName = '__freshlyDropMapsReady';
    (window as any)[callbackName] = () => resolve();
    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Failed to load Google Maps. Check the API key.'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

/** Driving distance (km) between two points via the Distance Matrix service. */
export async function getDrivingDistanceKm(origin: LatLng, dest: LatLng): Promise<number> {
  await loadGoogleMaps();
  const google = (window as any).google;
  const service = new google.maps.DistanceMatrixService();
  const res = await service.getDistanceMatrix({
    origins: [new google.maps.LatLng(origin.lat, origin.lng)],
    destinations: [new google.maps.LatLng(dest.lat, dest.lng)],
    travelMode: google.maps.TravelMode.DRIVING,
    unitSystem: google.maps.UnitSystem.METRIC,
  });
  const element = res?.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    throw new Error('No driving route found to that location.');
  }
  return element.distance.value / 1000; // metres → km
}
