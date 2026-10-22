// map.vapp.vn responses in the shape of Google's Geocoding and Places Autocomplete JSON, so code that reads
// `results[0].geometry.location` keeps working while you move off Google. Only the fields Google code usually
// reads are filled; there is no `address_components`. Read the README's "Khác biệt" section before you rely on it.
import type { AutocompleteResponse, GeocodeResponse, ReverseResponse, VappHit } from "./vapp.ts";

export type Confidence = NonNullable<VappHit["confidence"]>;
/** Strongest first. The gateway sets one per result (crates/vapp-maps assign_confidence). */
export const CONFIDENCE_ORDER: Confidence[] = ["exact", "street", "district", "approximate", "fuzzy"];

export interface GoogleGeocodeResult {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number }; location_type: "RANGE_INTERPOLATED" | "GEOMETRIC_CENTER" | "APPROXIMATE" };
  place_id: string;
  types: string[];
  partial_match?: true;
}
export interface GoogleGeocodeResponse { status: "OK" | "ZERO_RESULTS"; results: GoogleGeocodeResult[] }

const ROAD_KINDS = new Set(["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "road", "street",
  "service", "unclassified", "living_street", "pedestrian"]);
const ADMIN_KINDS = new Set(["state", "province", "region", "district", "city", "town", "suburb", "village", "hamlet",
  "ward", "commune", "municipality"]);

function types(h: VappHit, house: string | null): string[] {
  if (ROAD_KINDS.has(h.kind)) return house && h.precision === "interpolated" ? ["street_address"] : ["route"];
  if (ADMIN_KINDS.has(h.kind)) return ["political"];
  return ["point_of_interest", "establishment"];
}

/**
 * "54 Nguyễn Huệ, Phường Sài Gòn, Thành phố Hồ Chí Minh": house (when interpolated on this street), name, commune, province.
 * The hit's `address` field is left out: it can hold a pre-2025 district ("Quận 1") next to the new commune.
 */
export function formatAddress(h: VappHit, house: string | null = null): string {
  const first = house && h.precision === "interpolated" ? `${house} ${h.name}` : h.name;
  const parts = [first, h.district, h.province].filter((p): p is string => !!p);
  return parts.filter((p, i) => !parts.slice(0, i).some((q) => q.includes(p))).join(", ");
}

function locationType(h: VappHit): GoogleGeocodeResult["geometry"]["location_type"] {
  if (h.precision === "interpolated") return "RANGE_INTERPOLATED";
  return h.confidence === "approximate" || h.confidence === "fuzzy" ? "APPROXIMATE" : "GEOMETRIC_CENTER";
}

function toResult(h: VappHit, house: string | null): GoogleGeocodeResult {
  const r: GoogleGeocodeResult = {
    formatted_address: formatAddress(h, house),
    geometry: { location: { lat: h.lat, lng: h.lng }, location_type: locationType(h) },
    place_id: h.place_id ?? "",
    types: types(h, house),
  };
  if (h.confidence === "approximate" || h.confidence === "fuzzy") r.partial_match = true;
  return r;
}

export interface CompatOptions {
  /**
   * Drop results weaker than this. The search is fuzzy, so a nonsense query still finds a similar-sounding place;
   * Google would answer ZERO_RESULTS. Default "district" (on 12 real Vietnamese queries none was below it).
   */
  minConfidence?: Confidence;
}

/** /api/v1/geocode → Google Geocoding `geocode/json?address=…`. */
export function toGoogleGeocode(res: GeocodeResponse, o: CompatOptions = {}): GoogleGeocodeResponse {
  const floor = CONFIDENCE_ORDER.indexOf(o.minConfidence ?? "district");
  const kept = res.results.filter((h) => CONFIDENCE_ORDER.indexOf(h.confidence ?? "fuzzy") <= floor);
  const results = kept.map((h) => toResult(h, res.parsed?.house ?? null));
  return { status: results.length ? "OK" : "ZERO_RESULTS", results };
}

/** /api/v1/reverse → Google Geocoding `geocode/json?latlng=…` (one result: the nearest place). */
export function toGoogleReverse(res: ReverseResponse): GoogleGeocodeResponse {
  if (!res.result) return { status: "ZERO_RESULTS", results: [] };
  return { status: "OK", results: [toResult({ ...res.result, confidence: "exact" }, null)] };
}

export interface GooglePrediction {
  description: string;
  place_id: string;
  structured_formatting: { main_text: string; secondary_text: string };
  /** Not in Google's response: the suggestion's point, so you can skip the Place Details call. */
  location: { lat: number; lng: number };
}
/** /api/v1/autocomplete → Places Autocomplete `predictions`. */
export function toGoogleAutocomplete(res: AutocompleteResponse): { status: "OK" | "ZERO_RESULTS"; predictions: GooglePrediction[] } {
  const predictions = res.results.map((h) => {
    const secondary = [h.district, h.province].filter((p): p is string => !!p && p !== h.name).join(", ");
    return {
      description: secondary ? `${h.name}, ${secondary}` : h.name,
      place_id: h.place_id ?? "",
      structured_formatting: { main_text: h.name, secondary_text: secondary },
      location: { lat: h.lat, lng: h.lng },
    };
  });
  return { status: predictions.length ? "OK" : "ZERO_RESULTS", predictions };
}
