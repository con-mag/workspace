# المركز — نظام العمل والمعرفة

نسخة v17: واجهة المركز + طبقة API Serverless. الواجهة لا تحتوي على GitHub Token.

## البنية

- الواجهة: HTML/CSS/JS مع الحفاظ على الهوية والأيقونات والواجهات الحالية.
- البيانات المنظمة: `data/custom.json`.
- الملفات: `clients/...` داخل مستودع GitHub.
- API: `api/index.js` ويعمل كبوابة آمنة إلى GitHub Contents API.
- المزامنة: Polling كل 15 ثانية + زر تحديث يدوي.

## النشر الموصى به

انشر **جذر المشروع كاملًا على Vercel**. سيعمل الموقع والـAPI معًا، وتبقى `API_BASE` في `js/config.js` مساوية لـ `/api`.

### متغيرات البيئة في Vercel

```text
GITHUB_OWNER=con-mag
GITHUB_REPO=workspace
GITHUB_BRANCH=main
GITHUB_TOKEN=Fine-grained token
ADMIN_PASSWORD=كلمة مرور الإدارة
SESSION_SECRET=سلسلة عشوائية طويلة
ALLOWED_ORIGIN=https://رابط-الموقع
MAX_UPLOAD_BYTES=4194304
```

صلاحية GitHub المطلوبة: **Contents: Read and write** للمستودع المطلوب فقط.

## إذا كانت الواجهة على GitHub Pages

يمكن فصل الـAPI عن الواجهة. عندها غيّر `API_BASE` في `js/config.js` إلى عنوان الـAPI، مثل:

```text
https://your-api-domain.vercel.app/api
```

ولا تضع التوكن أو كلمة المرور أو `SESSION_SECRET` داخل ملفات الواجهة.

## ملاحظات الملفات

- إنشاء/رفع/تعديل/حذف/إعادة تسمية الملفات والمجلدات مدعوم.
- ملفات TXT/MD والنصوص المشابهة قابلة للتحرير من الواجهة.
- PDF والصور والملفات الثنائية تُخدم من خلال API بدل كشف توكن GitHub.
- الحد الافتراضي للرفع 4MB.
