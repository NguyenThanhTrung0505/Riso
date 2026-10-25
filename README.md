# A Little Corner of Happiness

Một website tĩnh, mobile-first và không cần backend. Tính năng chính chạy trực tiếp trên GitHub Pages; dữ liệu tùy chọn được lưu trong `localStorage` của thiết bị hiện tại.

## Chạy website

- Mở `index.html` trực tiếp trong trình duyệt, hoặc mở thư mục bằng VS Code và chạy bằng Live Server.
- Font Google được tải qua CDN; khi ngoại tuyến, website dùng font dự phòng hệ thống.
- Không cần cài Node.js, build hay API key.

## Cá nhân hóa

Mở `js/data.js` để sửa:

- `recipient`, `sender`, `openingMessage` và các câu chào.
- `notes` để thêm/sửa các lời nhắn (đã có hơn 30 lời nhắn mẫu).
- `memories` để sửa tiêu đề, ngày, caption và emoji minh họa.
- `gifts` để thay nội dung hộp quà.
- `tracks` để thêm danh sách nhạc.

Ô kỷ niệm hiện là minh họa, không phải ảnh cá nhân. Để dùng ảnh của mình, đặt tệp trong `assets/images/`, rồi thêm thuộc tính `image` với đường dẫn tương đối vào mục tương ứng trong `memories`, ví dụ `image: "assets/images/khoanh-khac.jpg"`. Ảnh bị thiếu sẽ tự quay về emoji minh họa. Chỉ thêm ảnh mà người liên quan đồng ý chia sẻ.

Để thêm nhạc, đặt tệp được phép sử dụng trong `assets/audio/`, rồi thêm một mục như:

```js
tracks: [
  { title: "Tên bài hát", artist: "Nghệ sĩ", src: "assets/audio/bai-hat.mp3" }
]
```

Đường dẫn tài nguyên nội bộ luôn tương đối để hoạt động dưới đường dẫn repository trên GitHub Pages. Nếu chưa có file nhạc, trình phát hiển thị hướng dẫn thay vì giả vờ phát.

## Dữ liệu trên thiết bị

Điều ước, lời nhắn yêu thích, tùy chọn và tiến trình khu vườn được lưu ở `localStorage` trên trình duyệt hiện tại. Chúng không được gửi lên máy chủ và không tự đồng bộ giữa thiết bị. Xóa dữ liệu trình duyệt sẽ xóa các mục đã lưu.

## Triển khai trên GitHub Pages

1. Tạo repository GitHub và đẩy các tệp của dự án lên nhánh `main`.
2. Mở **Settings → Pages**.
3. Trong phần nguồn triển khai, chọn **Deploy from a branch**.
4. Chọn nhánh `main` và thư mục `/ (root)`, sau đó lưu.
5. Chờ GitHub Pages hoàn tất triển khai rồi mở URL được hiển thị trong phần Pages.

Website không có route cần cấu hình rewrite và không sử dụng backend. Hãy kiểm tra các đường dẫn nội bộ sau khi thay đổi cấu trúc thư mục.
