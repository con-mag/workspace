/* المركز — واجهة التخزين الآمن
 * لا توجد أسرار أو GitHub Tokens داخل المتصفح.
 * عند نشر المشروع على Vercel يمكن استخدام /api مباشرة.
 * عند فصل الواجهة عن الـAPI، ضع عنوان API كاملًا بدل /api.
 */
window.APP_CONFIG = Object.freeze({
  API_BASE: "/api",
  POLL_MS: 15000,
  APP_NAME: "المركز"
});
