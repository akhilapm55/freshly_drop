/**
 * Geocode free-text (address + landmark) into latitude/longitude.
 * Uses Google's Geocoder when a Maps key is configured, otherwise the free
 * OpenStreetMap Nominatim service.
 */
import { isGoogleMapsEnabled, loadGoogleMaps } from './googleMaps';
import { DELIVERY_COUNTRY, type LatLng } from '../config/delivery';

export async function geocodeAddress(query: string): Promise<LatLng> {
  const text = query.trim();
  if (!text) throw new Error('Please enter an address or landmark.');

  if (isGoogleMapsEnabled) {
    await loadGoogleMaps();
    const google = (window as any).google;
    const geocoder = new google.maps.Geocoder();
    const { results } = await geocoder.geocode({
      address: text,
      componentRestrictions: { country: DELIVERY_COUNTRY },
    });
    if (!results || results.length === 0) {
      throw new Error('Could not find that address. Add area / town / PIN code.');
    }
    const loc = results[0].geometry.location;
    return { lat: loc.lat(), lng: loc.lng() };
  }

  // Free fallback: OpenStreetMap Nominatim
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1` +
    `&countrycodes=${DELIVERY_COUNTRY}&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Address lookup failed. Please try again.');
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Could not find that address. Add area / town / PIN code or a nearby landmark.');
  }
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}
