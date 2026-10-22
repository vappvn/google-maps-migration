// Offline: the fixtures are real map.vapp.vn answers (scripts/record-fixtures.ts). Each test pins one README claim.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { DROP } from "../scripts/record-fixtures.ts";
import { toGoogleAutocomplete, toGoogleGeocode, toGoogleReverse, vapp } from "../src/index.ts";

const fx = (name: string) => JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), "utf8"));

describe("toGoogleGeocode", () => {
  test("a new-form house address reads like Google's street_address", () => {
    const g = toGoogleGeocode(fx("geocode-new-address"));
    expect(g.status).toBe("OK");
    const r = g.results[0];
    expect(r.formatted_address).toBe("54 Nguyễn Huệ, Phường Sài Gòn, Thành phố Hồ Chí Minh");
    expect(r.types).toEqual(["street_address"]);
    expect(r.geometry.location_type).toBe("RANGE_INTERPOLATED");
    expect(r.geometry.location.lat).toBeCloseTo(10.7734, 3);
    expect(r.place_id).toStartWith("vm_");
  });

  test("an accent-free landmark comes back with its accented name and new commune, no old district", () => {
    const r = toGoogleGeocode(fx("geocode-landmark")).results[0];
    expect(r.formatted_address).toBe("Chợ Bến Thành, Phường Bến Thành, Thành phố Hồ Chí Minh");
    expect(r.formatted_address).not.toContain("Quận");
    expect(r.types).toEqual(["point_of_interest", "establishment"]);
  });

  test("a nonsense query is ZERO_RESULTS by default, and its fuzzy hits come back flagged when asked for", () => {
    expect(toGoogleGeocode(fx("geocode-nonsense"))).toEqual({ status: "ZERO_RESULTS", results: [] });
    const loose = toGoogleGeocode(fx("geocode-nonsense"), { minConfidence: "fuzzy" });
    expect(loose.status).toBe("OK");
    expect(loose.results.every((r) => r.partial_match === true && r.geometry.location_type === "APPROXIMATE")).toBe(true);
  });
});

test("toGoogleReverse: one nearest result", () => {
  const g = toGoogleReverse(fx("reverse"));
  expect(g.results).toHaveLength(1);
  expect(g.results[0].formatted_address).toBe("Chợ Bến Thành");
  expect(toGoogleReverse({ result: null }).status).toBe("ZERO_RESULTS");
});

test("toGoogleAutocomplete: predictions carry a location, so no Place Details call is needed", () => {
  const p = toGoogleAutocomplete(fx("autocomplete")).predictions;
  expect(p.length).toBeGreaterThan(0);
  expect(p[0].structured_formatting.main_text).toContain("Landmark 81");
  expect(p[0].location.lat).toBeCloseTo(10.795, 2);
});

test("verify: an old-form address is `corrected` to its new form", () => {
  const v = fx("verify-old-address");
  expect(v.status).toBe("corrected");
  expect(v.address).toBe("12 Lê Lợi, Phường Sài Gòn, Thành phố Hồ Chí Minh");
});

describe("client", () => {
  test("sends the key as x-api-key and the query url-encoded", async () => {
    let seen: Request | undefined;
    const stub = (async (url: string, init?: RequestInit) => {
      seen = new Request(url, init);
      return new Response(JSON.stringify({ results: [] }));
    }) as typeof fetch;
    await vapp({ key: "vsk_test", base: "http://gw", fetch: stub }).geocode("Chợ Bến Thành", { limit: 1, near: [106.7, 10.77] });
    expect(seen!.headers.get("x-api-key")).toBe("vsk_test");
    const u = new URL(seen!.url);
    expect(u.pathname).toBe("/api/v1/geocode");
    expect(u.searchParams.get("q")).toBe("Chợ Bến Thành");
    expect(u.searchParams.get("near")).toBe("106.7,10.77");
  });

  test("an HTTP error throws with the status (e.g. 429 over the plan's rate)", async () => {
    const stub = (async () => new Response('{"error":"rate limit"}', { status: 429 })) as unknown as typeof fetch;
    expect(vapp({ fetch: stub }).reverse(10.77, 106.7)).rejects.toMatchObject({ status: 429 });
  });
});

test("fixtures hold no contact fields of the places", () => {
  for (const f of readdirSync(new URL("fixtures/", import.meta.url))) {
    const text = readFileSync(new URL(`fixtures/${f}`, import.meta.url), "utf8");
    for (const k of DROP) expect(text).not.toContain(`"${k}"`);
  }
});
