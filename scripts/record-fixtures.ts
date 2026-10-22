// Records the gateway answers the tests read (test/fixtures/*.json), so `bun test` runs offline.
// Usage: bun scripts/record-fixtures.ts [base]   — 6 keyless GETs to map.vapp.vn (read-only).
// Contact fields of the places (phone, social, website, email) are dropped: the adapter never reads them.
import { vapp } from "../src/vapp.ts";

export const CASES = {
  "geocode-new-address": (v: ReturnType<typeof vapp>) => v.geocode("54 Nguyễn Huệ, phường Sài Gòn, TP.HCM", { limit: 1 }),
  "geocode-landmark": (v: ReturnType<typeof vapp>) => v.geocode("cho ben thanh", { limit: 3 }),
  "geocode-nonsense": (v: ReturnType<typeof vapp>) => v.geocode("zzqxv không có", { limit: 2 }),
  "reverse": (v: ReturnType<typeof vapp>) => v.reverse(10.7725, 106.698),
  "autocomplete": (v: ReturnType<typeof vapp>) => v.autocomplete("landmark 81", { limit: 2 }),
  "verify-old-address": (v: ReturnType<typeof vapp>) => v.verify("12 Lê Lợi, phường Bến Nghé, quận 1, TP.HCM"),
} as const;

export const DROP = new Set(["phone", "social", "website", "email"]);

if (import.meta.main) {
  const v = vapp({ base: process.argv[2] });
  const dir = new URL("../test/fixtures/", import.meta.url);
  for (const [name, call] of Object.entries(CASES)) {
    const strip = (k: string, val: unknown) => (DROP.has(k) ? undefined : val);
    await Bun.write(new URL(`${name}.json`, dir), JSON.stringify(await call(v), strip, 1) + "\n");
    console.log("wrote", name);
  }
}
