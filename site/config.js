/* Bản này dùng khi chạy thử trên máy. Khi build trên GitHub, file được ghi lại từ biến APPS_SCRIPT_URL và GOOGLE_CLIENT_ID. */
window.THIEP = Object.assign({}, window.THIEP, {
  apiUrl: "",          // URL Web App của Apps Script, dạng https://script.google.com/macros/s/.../exec
  googleClientId: "",  // OAuth Client ID cho trang admin
  demo: false          // true = dùng dữ liệu mẫu assets/demo.json, không gọi máy chủ
});
