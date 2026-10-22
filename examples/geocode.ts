// bun examples/geocode.ts "<địa chỉ>"  — geocode one address and print it in Google's Geocoding shape.
// Set VAPP_MAPS_KEY to send your key (https://map.vapp.vn/dev); without it the call is served keyless.
import { toGoogleGeocode, vapp } from "../src/index.ts";

const q = process.argv.slice(2).join(" ") || "54 Nguyễn Huệ, phường Sài Gòn, TP.HCM";
const v = vapp({ key: process.env.VAPP_MAPS_KEY });
console.log(JSON.stringify(toGoogleGeocode(await v.geocode(q, { limit: 3 })), null, 2));
