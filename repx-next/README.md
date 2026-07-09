# REPX Image Extractor — Next.js (Frontend only)

Đọc logo/ảnh từ file `.repx` DevExpress **hoàn toàn trên trình duyệt**, không cần NestJS.

## Chạy

```bash
cd repx-next
npm install
npm run dev
```

Mở: http://localhost:3002

## Định dạng hỗ trợ

| Format | Mô tả |
|--------|-------|
| `xml` | REPX XML (`XtraReportsLayoutSerializer`) — DevExpress v17.1+ |
| `codedom` | REPX CodeDOM cũ (`XRTypeInfo` + C#) — vd. v16.1 |
| `zip` | File REPX nén ZIP |

## Cấu trúc

```
repx-next/
├── app/page.tsx              # Trang chính
├── components/RepxExtractor.tsx
└── lib/repx/
    ├── extract-repx.ts       # Entry point
    ├── codedom-parser.ts     # Parse CodeDOM + .NET resources
    ├── binary.ts             # Uint8Array helpers (browser-safe)
    └── types.ts
```

## Dùng lại module ở component khác

```tsx
'use client';
import { extractRepxFromFile } from '@/lib/repx';

const result = await extractRepxFromFile(file);
console.log(result.images);
```

## Lưu ý

- File xử lý local, không upload server
- Phù hợp file REPX vài MB trở xuống
