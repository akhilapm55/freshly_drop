/**
 * Delivery configuration — single source of truth for the shop location and the
 * distance-based pricing slabs. Edit values here; no pricing logic is hardcoded
 * elsewhere.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DeliverySlab {
  /** Upper bound of this slab, in km (inclusive). */
  maxKm: number;
  /** Delivery charge for distances within this slab, in ₹. */
  charge: number;
}

/**
 * Fixed shop location. To set precisely: open Google Maps, right-click the exact
 * spot, and copy the "lat, lng".
 */
export const STORE_LOCATION: LatLng & { label: string } = {
  lat: 12.322076248391523,
  lng: 75.08804090874067,
  label: 'freshly drop',
};

/**
 * Distance pricing slabs, ascending by maxKm. A distance falls into the first
 * slab whose maxKm it does not exceed. Beyond the last slab → delivery unavailable.
 *
 * NOTE: distances are measured along ROADS (see src/lib/delivery.ts), not
 * straight-line, so a customer 2 km away on the map typically measures ~2.5-3 km
 * here. These bounds are widened accordingly — pick them by road distance, not
 * by how far the pin looks on a map.
 */
export const DELIVERY_SLABS: DeliverySlab[] = [
  { maxKm: 3, charge: 20 },
  { maxKm: 5, charge: 30 },
  { maxKm: 7, charge: 40 },
  { maxKm: 10, charge: 50 },
];


/** Maximum serviceable distance — derived from the last slab. */
export const MAX_DELIVERY_KM =
  DELIVERY_SLABS[DELIVERY_SLABS.length - 1].maxKm;
/** Restrict address autocomplete/geocoding to this country (ISO code). */
export const DELIVERY_COUNTRY = 'in';

/**
 * Delivery promise shown on an order. Keep this to something you can actually
 * meet — it is displayed to the customer as the ETA and stored on the order.
 */
export const DELIVERY_ETA_TEXT = 'Same day, within 3 hours';
