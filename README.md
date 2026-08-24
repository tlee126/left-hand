# LEFT HAND

LEFT HAND - Onthidithoi là hệ sinh thái hỗ trợ sinh viên UFM học tập và ôn thi.

Dự án hiện đang được phát triển từ prototype frontend thành ứng dụng web hoàn chỉnh.

## Công nghệ

- Next.js
- React
- TypeScript
- Tailwind CSS
- Framer Motion

## Yêu cầu môi trường

- Node.js: v24.15.0
- npm: 11.12.1

## Cài đặt

Cài đặt dependency:

```bash
npm ci
```

Tạo file biến môi trường local:

```bash
cp .env.example .env.local
```

## Chạy development

```bash
npm run dev
```

Mở website tại:

```text
http://localhost:3000
```

## Các lệnh kiểm tra

Kiểm tra TypeScript:

```bash
npm run typecheck
```

Build production:

```bash
npm run build
```

Chạy bản production:

```bash
npm run start
```

## Trạng thái hiện tại

- Giao diện chính đang chạy bằng Next.js.
- Catalog hiện vẫn sử dụng dữ liệu tĩnh trong thư mục `data/`.
- Authentication hiện vẫn là demo.
- Chưa có database production.
- Chưa có payment production.
- Chưa có backend hoàn chỉnh.
- Một số file prototype cũ sẽ được xử lý ở Phase 0 — Task 0.2.

## Quy trình phát triển

Mỗi thay đổi được thực hiện theo các bước:

1. Chọn một task nhỏ.
2. Sửa code trong VS Code.
3. Chạy các lệnh kiểm tra liên quan.
4. Xem lại thay đổi bằng Git.
5. Commit với message rõ ràng.
6. Push lên GitHub.
7. Tiếp tục task kế tiếp từ commit mới nhất.

## Quy tắc bảo mật

Không commit các file hoặc thông tin sau:

- `.env`
- `.env.local`
- API key
- Password
- Access token
- Secret của dịch vụ bên thứ ba

Chỉ commit `.env.example` với tên biến môi trường, không chứa secret thật.