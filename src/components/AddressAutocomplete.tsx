/**
 * Address picker that returns the selected place's coordinates.
 *
 * - With a Google Maps key  → Google Places Autocomplete.
 * - Without one             → free OpenStreetMap (Photon) autocomplete.
 *
 * Either way, onSelect fires with { address, lat, lng } so the parent can
 * compute the delivery distance/charge.
 */
import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { isGoogleMapsEnabled, loadGoogleMaps } from '../lib/googleMaps';
import { STORE_LOCATION, DELIVERY_COUNTRY } from '../config/delivery';

export interface SelectedPlace {
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSelect: (place: SelectedPlace) => void;
  placeholder?: string;
  id?: string;
}

interface Suggestion {
  label: string;
  lat: number;
  lng: number;
}

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, id }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loadError, setLoadError] = useState('');

  // ---- Google Places mode ----
  useEffect(() => {
    if (!isGoogleMapsEnabled || !inputRef.current) return;
    let autocomplete: any;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        const google = (window as any).google;
        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ['geometry', 'formatted_address', 'name'],
          componentRestrictions: { country: DELIVERY_COUNTRY },
        });
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place.geometry?.location) {
            setLoadError('Please pick an address from the suggestions.');
            return;
          }
          const address = place.formatted_address || place.name || '';
          onChange(address);
          onSelect({
            address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        });
      })
      .catch(() => setLoadError('Address search unavailable — type your address and we will estimate.'));

    return () => {
      cancelled = true;
      if (autocomplete && (window as any).google) {
        (window as any).google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Free OpenStreetMap (Photon) fallback mode ----
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleType(text: string) {
    onChange(text);
    if (isGoogleMapsEnabled) return; // Google handles its own suggestions

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => runPhotonSearch(text.trim()), 350);
  }

  async function runPhotonSearch(query: string) {
    setSearching(true);
    try {
      const url =
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}` +
        `&limit=5&lang=en&lat=${STORE_LOCATION.lat}&lon=${STORE_LOCATION.lng}`;
      const res = await fetch(url);
      const data = await res.json();
      const items: Suggestion[] = (data.features || []).map((f: any) => ({
        label: formatPhotonLabel(f.properties),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));
      setSuggestions(items);
      setOpen(items.length > 0);
    } catch {
      setSuggestions([]);
      setOpen(false);
    } finally {
      setSearching(false);
    }
  }

  function pickSuggestion(s: Suggestion) {
    onChange(s.label);
    onSelect({ address: s.label, lat: s.lat, lng: s.lng });
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleType(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder || 'Search your delivery address…'}
          className="w-full text-xs font-medium bg-gray-50 border border-gray-200 focus:border-[#1B7A36] focus:ring-1 focus:ring-[#1B7A36] rounded-xl pl-9 pr-8 py-2.5 outline-hidden"
          id={id}
          autoComplete="off"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
        )}
      </div>

      {/* Free-mode suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => pickSuggestion(s)}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-[#1B7A36]/5 flex items-start gap-2"
              >
                <MapPin className="w-3 h-3 text-[#1B7A36] mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {loadError && <p className="text-[10px] text-amber-600 font-medium mt-1">{loadError}</p>}
    </div>
  );
}

function formatPhotonLabel(p: any): string {
  const line1 = [p.name, p.housenumber, p.street].filter(Boolean).join(' ');
  const parts = [line1, p.district, p.city, p.state, p.postcode].filter(Boolean);
  // De-duplicate consecutive repeats (Photon sometimes repeats name as city)
  return parts.filter((part, idx) => part !== parts[idx - 1]).join(', ');
}
