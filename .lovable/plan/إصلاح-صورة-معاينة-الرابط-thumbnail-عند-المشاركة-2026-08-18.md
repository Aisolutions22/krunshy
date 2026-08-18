# إصلاح صورة معاينة الرابط (thumbnail) عند المشاركة

## السبب الجذري (متحقق منه)
وسم `og:image` في الموقع المنشور يشير إلى `https://krunshy.lovable.app/og-image.jpg` — وهذا الدومين القديم يرد بـ **404**. الصورة نفسها موجودة وسليمة (1200×630) وتعمل على الدومين الحالي `https://crunchy-food.lovable.app/og-image.jpg` (200 OK).

نفس المشكلة تطال `og:url` و`canonical` وروابط الخريطة (sitemap) و JSON-LD، وكلها ما زالت على الدومين القديم في:
`src/routes/index.tsx`، `src/routes/__root.tsx`، `src/routes/category.$categoryId.tsx`، `src/routes/sitemap[.]xml.ts`.

## الخطة
1. استبدال كل `https://krunshy.lovable.app` بـ `https://crunchy-food.lovable.app` في الملفات الأربعة أعلاه (og:image، twitter:image، og:url، canonical، JSON-LD، sitemap).
2. تدعيم وسوم المعاينة في الصفحة الرئيسية: `twitter:card = summary_large_image`، و`og:image:width = 1200`، `og:image:height = 630`، و`og:image:alt`.
3. إضافة نفس صورة المعاينة لصفحة التصنيف حتى تظهر صورة عند مشاركة روابط الأقسام.
4. التحقق بعد النشر بجلب HTML من الدومين الحالي والتأكد أن `og:image` يرد 200.

## ملاحظة مهمة
واتساب وفيسبوك يخزّنان معاينة الرابط مؤقتًا. بعد النشر قد تظل المعاينة القديمة تظهر لبعض الوقت؛ يمكن تحديثها فورًا عبر أداة Facebook Sharing Debugger، أو بمشاركة الرابط مع باراميتر بسيط مثل `?v=2` للاختبار.
