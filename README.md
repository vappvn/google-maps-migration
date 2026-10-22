# Chuyển từ Google Maps API sang map.vapp.vn — mã mẫu

Mã mẫu của ERPFit cho lập trình viên đang gọi Google Geocoding API hoặc Places Autocomplete và muốn chuyển sang
[map.vapp.vn](https://map.vapp.vn) mà không phải sửa chỗ đọc kết quả. Thư viện nhỏ, không phụ thuộc gói nào: chạy
trên Bun, Node 18+, Deno và trình duyệt (chỉ dùng `fetch`).

- `src/vapp.ts`: gọi API map.vapp.vn (geocode, reverse, autocomplete, verify, convert).
- `src/google-compat.ts`: đổi kết quả sang đúng dạng JSON của Google (`results[0].geometry.location`,
  `formatted_address`, `place_id`, `types`, `status`), để mã cũ đọc tiếp được.
- `test/`: chạy không cần mạng, trên câu trả lời thật của map.vapp.vn đã ghi lại.

## Trước và sau

Trước (Google Geocoding API):

```ts
const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${GOOGLE_KEY}`;
const g = await (await fetch(url)).json();
if (g.status === "OK") save(g.results[0].geometry.location); // { lat, lng }
```

Sau (map.vapp.vn, phần đọc kết quả giữ nguyên):

```ts
import { toGoogleGeocode, vapp } from "./src/index.ts";

const v = vapp({ key: process.env.VAPP_MAPS_KEY });
const g = toGoogleGeocode(await v.geocode(q));
if (g.status === "OK") save(g.results[0].geometry.location); // { lat, lng }
```

Chạy thử (không cần khóa):

```sh
bun examples/geocode.ts "54 Nguyễn Huệ, phường Sài Gòn, TP.HCM"
bun test
```

## Bảng đối chiếu

| Google | map.vapp.vn | Hàm trong mẫu |
|---|---|---|
| Geocoding API `geocode/json?address=` | `GET /api/v1/geocode?q=` | `v.geocode()` → `toGoogleGeocode()` |
| Geocoding API `geocode/json?latlng=` | `GET /api/v1/reverse?lat=&lng=` | `v.reverse()` → `toGoogleReverse()` |
| Places Autocomplete + Place Details | `GET /api/v1/autocomplete?q=` | `v.autocomplete()` → `toGoogleAutocomplete()` |
| (không có) | `GET /api/v1/verify?q=` | `v.verify()`: địa chỉ giao hàng dùng được không |
| (không có) | `GET /api/v1/address/convert?q=` | `v.convert()`: địa chỉ cũ → địa chỉ mới, miễn phí |

Mỗi gợi ý của autocomplete đã có tọa độ (`location`), nên không cần gọi thêm Place Details.

## Khác biệt cần biết

Đo trên map.vapp.vn ngày 22/10/2026 (`scripts/growth/g11-confidence-probe.ts` trong kho của ERPFit).

1. **Tìm gần đúng.** Tìm kiếm chấp nhận gõ không dấu và gõ sai nhẹ, nên một chuỗi vô nghĩa vẫn có thể ra một địa điểm
   tên gần giống, trong khi Google trả `ZERO_RESULTS`. `toGoogleGeocode` bỏ các kết quả yếu hơn `minConfidence`
   (mặc định `"district"`: 12 câu hỏi thật đều đạt mức này) và khi đó trả `ZERO_RESULTS`. Muốn giữ cả kết quả yếu:
   `toGoogleGeocode(res, { minConfidence: "fuzzy" })`; chúng có `partial_match: true`.
2. **`confidence` không phải bằng chứng.** "qwerty 99999 xyz" vẫn ra "XYZ Café" với `confidence: "exact"`, và
   "Vincom Bà Triệu, Hà Nội" ra một địa điểm ở Hải Phòng. Nếu bạn biết tỉnh, so với `results[0]` trước khi lưu. Với
   địa chỉ khách nhập lúc đặt hàng, dùng `v.verify()`: `status` là `verified`, `corrected` (kèm địa chỉ mới),
   `ambiguous` (hỏi lại khách), `unsupported` hoặc `invalid`.
3. **Số nhà nằm trên tim đường.** Tọa độ số nhà được nội suy trên tim đường (`location_type: "RANGE_INTERPOLATED"`),
   không phải nóc nhà như `ROOFTOP` của Google, nên có thể lệch tới khoảng 150 m so với ghim của Google.
4. **Không có `address_components`.** Muốn từng phần (số nhà, đường, phường, tỉnh), đọc `parsed` của
   `/api/v1/geocode` hoặc `/api/v1/verify`.
5. **Địa chỉ theo đơn vị hành chính mới.** `formatted_address` ghi phường, xã mới và tỉnh, thành phố mới (từ
   01/07/2025), không ghi quận, huyện. Địa chỉ cũ vẫn geocode được; `v.convert()` đổi địa chỉ cũ sang địa chỉ mới.
6. **Thứ tự tọa độ.** Mẫu này nhận `lat, lng` như Google. Các API chỉ đường, ma trận và isochrone của map.vapp.vn
   nhận `lng,lat`: xem [hướng dẫn chuyển từ Google Maps](https://map.vapp.vn/huong-dan/thay-google-maps-api).

## Khóa API và giá

Gói Developer miễn phí: 20.000 yêu cầu mỗi tháng, tối đa 1.000 mỗi ngày, 60 mỗi phút, bắt buộc ghi nguồn map.vapp.vn.
Lấy khóa ở [map.vapp.vn/dev](https://map.vapp.vn/dev?from=dia-chi-giao-hang) rồi đặt vào `VAPP_MAPS_KEY`; khóa được
gửi trong header `x-api-key`. Các gói trả phí: [map.vapp.vn/bang-gia](https://map.vapp.vn/bang-gia). Đổi địa chỉ cũ
sang địa chỉ mới (`convert`) không cần khóa.

## Giấy phép

Mã: MIT (xem `LICENSE`). Dữ liệu bản đồ có phần từ © OpenStreetMap contributors (ODbL): ghi nguồn khi hiển thị.

Nội dung có hỗ trợ AI, biên tập bởi ERPFit.
