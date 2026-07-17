# NQ PL RP - Police MDT System

نظام لوحة تحكم الشرطة (Mobile Data Terminal) للعبة Roblox

## 🚀 المميزات

- ✅ تسجيل دخول عبر Roblox OAuth
- ✅ التحقق من الرتبة والتيم تلقائياً
- ✅ شات فوري مع عزل حسب السيرفر (JobId)
- ✅ 3 ترددات راديو (Patrol, SWAT, Air Support)
- ✅ نظام بلاغات 911 نشط
- ✅ أوامر سريعة تكتيكية
- ✅ نطق صوتي مع مؤثرات لاسلكي
- ✅ تصميم عسكري Dark Mode

## 📋 المتطلبات

1. **حساب Firebase**
   - أنشئ مشروع جديد في [Firebase Console](https://console.firebase.google.com)
   - فعّل Realtime Database
   - انسخ إعدادات المشروع

2. **Roblox Open Cloud**
   - أنشئ تطبيق في [Roblox Creator Dashboard](https://create.roblox.com)
   - احصل على Client ID و Client Secret
   - أضف Redirect URI

3. **Roblox Group**
   - أنشئ جروب للشرطة
   - حدد الرتب المسموح لها (مثل 250-255)

4. **حساب Render**
   - سجل في [Render](https://render.com)
   - اربط بمستودع GitHub

## 🔧 التثبيت

### 1. إعداد Firebase

```bash
# تثبيت Firebase CLI
npm install -g firebase-tools

# تسجيل الدخول
firebase login

# تهيئة المشروع
firebase init
