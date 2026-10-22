// A small map.vapp.vn client: plain fetch, no dependencies (Bun, Node 18+, Deno, browsers).
// Each method returns the gateway's JSON as is; google-compat.ts turns it into Google's shape.

export interface VappOptions {
  /** Your key from https://map.vapp.vn/dev, sent as the `x-api-key` header. */
  key?: string;
  base?: string;
  fetch?: typeof fetch;
}

export interface VappHit {
  name: string;
  lat: number;
  lng: number;
  kind: string;
  place_id?: string;
  confidence?: "exact" | "street" | "district" | "approximate" | "fuzzy";
  precision?: "interpolated" | "street";
  address?: string;
  district?: string; // the NEW phường/xã after 01/07/2025 (the field keeps its old name)
  province?: string;
  score?: number;
}
export interface Parsed { house: string | null; street: string | null; ward: string | null; district: string | null; province: string | null }
export interface GeocodeResponse { q?: string; engine?: string; parsed?: Parsed; results: VappHit[] }
export interface ReverseResponse { result: (VappHit & { dist_m: number }) | null }
export interface AutocompleteResponse { q: string; results: VappHit[] }
export interface VerifyResponse {
  q: string;
  status: "verified" | "corrected" | "ambiguous" | "unsupported" | "invalid";
  reasons: string[];
  address: string | null;
  province: string | null;
  commune: string | null;
  match: VappHit | null;
  alternatives: VappHit[];
}
export interface ConvertResponse { input: string; status: string; address?: string; province_new?: string; note: string }

export class VappError extends Error {
  constructor(readonly status: number, readonly body: string) {
    super(`map.vapp.vn HTTP ${status}: ${body.slice(0, 200)}`);
  }
}

export function vapp(opts: VappOptions = {}) {
  const base = opts.base ?? "https://map.vapp.vn";
  const f = opts.fetch ?? fetch;
  async function get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
    const res = await f(`${base}${path}?${qs}`, { headers: opts.key ? { "x-api-key": opts.key } : {} });
    const text = await res.text();
    if (!res.ok) throw new VappError(res.status, text);
    return JSON.parse(text) as T;
  }
  return {
    /** Address or place → coordinates (Google: Geocoding API `address=`). */
    geocode: (q: string, o: { limit?: number; near?: [number, number] } = {}) =>
      get<GeocodeResponse>("/api/v1/geocode", { q, limit: o.limit, near: o.near?.join(",") }),
    /** Coordinates → nearest place (Google: Geocoding API `latlng=`). */
    reverse: (lat: number, lng: number) => get<ReverseResponse>("/api/v1/reverse", { lat, lng }),
    /** Suggestions while typing; each one already has lat/lng (Google: Places Autocomplete + Place Details). */
    autocomplete: (q: string, o: { limit?: number } = {}) =>
      get<AutocompleteResponse>("/api/v1/autocomplete", { q, limit: o.limit }),
    /** Is this delivery address usable? verified | corrected | ambiguous | unsupported | invalid. No Google equivalent. */
    verify: (q: string) => get<VerifyResponse>("/api/v1/verify", { q }),
    /** Old (pre-01/07/2025) address → new address. Free, no key needed. */
    convert: (q: string) => get<ConvertResponse>("/api/v1/address/convert", { q }),
  };
}
export type Vapp = ReturnType<typeof vapp>;
