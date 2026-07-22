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
  lat: 12.321829928791814,
  lng: 75.08549817459456,
  label: 'Parakku',
};

/**
 * Distance pricing slabs, ascending by maxKm. A distance falls into the first
 * slab whose maxKm it does not exceed. Beyond the last slab → delivery unavailable.
 */
export const DELIVERY_SLABS: DeliverySlab[] = [
  { maxKm: 2, charge: 20 },
  { maxKm: 4, charge: 30 },
  { maxKm: 6, charge: 40 },
  { maxKm: 8, charge: 50 },
  { maxKm: 10, charge: 70 },
];

/** Maximum serviceable distance — derived from the last slab. */
export const MAX_DELIVERY_KM = DELIVERY_SLABS[DELIVERY_SLABS.length - 1].maxKm;

/** Restrict address autocomplete/geocoding to this country (ISO code). */
export const DELIVERY_COUNTRY = 'in';
