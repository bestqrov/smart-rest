# مراجعة التطبيق والإصلاحات: 4 و5 نونبر 2026

**الحالة:** 17 إصلاح فـ14 commit، كاملين فـ`main` ومصيفطين لـGitHub.
**الأساس:** هاد المراجعة كملات على [Sprint 12 Final Launch Audit](sprint12-final-launch-audit-2026-08-04.md) و[Sprint 12 Cloud Production Audit](sprint12-cloud-production-audit-2026-08-04.md). الأرقام P1-x وP2-x كترجع لهاد التقارير.

---

## 1. الخلاصة

| | قبل | دابا |
|---|---|---|
| P1 فالكود | 4 مفتوحين | **0** (P1-6 Backup مأجل بقرار) |
| P2 | 15 | **11 تصلحو**، 4 باقيين |
| مشاكل جداد تلقاو | | **6 تصلحو** |
| TypeScript | نقي | نقي |
| الـproduction (`www.smartrestau.com`) | | خدام، مع جوج مشاكل مفتوحين (شوف القسم 5) |

---

## 2. الأمان ديال الريبو

| المشكل | شنو تدار |
|---|---|
| الرابط ديال `origin` فـ`.git/config` كان فيه **GitHub personal access token** مكتوب بشكل واضح | التوكن تحيد من الرابط، وتفعّل `credential.helper osxkeychain`. الـpush تجرب وخدام. |

**باقي على صاحب المشروع:** يحذف التوكنات القدام من https://github.com/settings/tokens، إلا مازال ما دارهاش.

---

## 3. الإصلاحات فالكود

### الفلوس والطلبات

| Commit | المشكل | الإصلاح |
|---|---|---|
| `c83073f` | **جديد:** الطلب كان يقدر يرجع من COMPLETED لـPENDING ويعاود يولي COMPLETED. فكل مرة كانت العمولة كتنقص، والستوك كينقص، والنقط ديال الولاء كتزاد. والإلغاء ديال طلب COMPLETED ما كانش كيرجع والو (P1-2). | COMPLETED وCANCELLED وليو حالات نهائية فـ`PATCH /api/orders/:id/status` وكيرجعو 422. والحماية كاينة حتى فاللحظة اللي كيتكتب فيها الطلب فالداتابيز. |
| `087a2ca` | الـcron ديال الديون كان كيوقف كامل إلا وقع خطأ فمطعم واحد (P1-3). | كل مطعم ولا عندو `try/catch` بوحدو. |
| `de62e01` | العمولة كانت كتتحسب على طلب بـ0 درهم (P2-2). | `orderTotal <= 0` كيرجع 0. |
| `de62e01` | إغلاق الـshift كان يقدر يتدار جوج مرات إلا تكليكا جوج مرات، و`countedCash` ما كانش كيتراجع (P2-3). | `updateMany` بشرط `status: 'OPEN'` (و409 إلا تسد ديجا)، و`countedCash` خاصو يكون رقم ≥ 0. |
| `4c1bb48` | الـcheckout بالكراسي ما كانش كيلقى الطلبات ديال طاولة مجموعة مع طاولة أخرى، وكيرجع 404 (P2-4). | ولا كيقلب على الطلبات فالطاولة الرئيسية (master) بنفس الطريقة ديال `GET /api/orders/table/:tableId`. |

### الأمان

| Commit | المشكل | الإصلاح |
|---|---|---|
| `d8c0a10` | الدخول بالـPIN كان محمي غير بالحد العام: 60 فالدقيقة، يعني ~86,000 محاولة فالنهار (P1-5). | `pinLimiter`: 10 محاولات **غالطين** فكل 15 دقيقة لكل IP، على `/api/pos/shift` و`/api/waiters/qr-login`. المحاولات الصحيحة ما كتحسبش. |
| `1b04d58` | 22 فايل ديال superadmin كل واحد عندو نسخة ديالو من الحماية، والنسخ ما متشابهينش. شي نسخ ما كتشيكيش الإيميل، وشي نسخ كتخلي الطلب يدوز إلا كان `SUPERADMIN_SECRET` ما معرّفش (P1-4، P2-10). | `src/middleware/superAdminAuth.ts` ← `isSuperAdminRequest()`: كتسد الباب إلا الكود السري ما معرّفش، كتقارن بـ`timingSafeEqual`، وكتطلب الإيميل وكتقارنو مع `SUPERADMIN_EMAIL`. والـ22 فايل كاملين كيستعملوها. |
| `de62e01` | صفحة "نسيت كلمة السر" كانت كتبين واش الإيميل عندو حساب (P2-9). | ديما كترجع `{ ok: true }`. |
| `de62e01` | `DELETE /api/customers/optout` كان خدام بلا تسجيل دخول، وكيثيق فـ`cafeId` اللي جاي من الطلب (P2-7). | ولا محمي بـ`authorizeAdmin`، و`cafeId` كيتاخد من الـJWT. |
| `4c1bb48` | `authorizeAdmin` ما كانش كيشيكي `req.query.cafeId` (P2-5). | زدت الشيك. |
| `d441330` | 84 بلاصة فـ30 فايل كانو كيرجعو `err.message` للكليان فالأخطاء 500، وبزاف منهم ما كيسجلوش الخطأ (P2-8). | `sendServerError()` فـ`errorHandler.ts`: كتسجل الخطأ، كتصيفط الإنذار، وكتخبي الرسالة فالـproduction. |
| `42f3f19` | 6 routers كانو كيتحققو من التوكن بيدهم (P2-6). | `verifyAdminToken()` فـ`authorizeAdmin.ts`، والـ6 كاملين كيستعملوها. |

### الواجهة والتشغيل

| Commit | المشكل | الإصلاح |
|---|---|---|
| `9a04c0d` | **جديد:** صفحة الحجوزات كانت كتطيح وكتبان خاوية حيت كاينة حجوزات بالحالة CHECKED_IN، والصفحة ما كتعرفش CHECKED_IN ولا NO_SHOW. | زدت الحالتين للـtype، و`STATUS_META`، والترجمات بـ4 ديال اللغات، والألوان ديال التقويم. |
| `0056c51` | **جديد:** الحد العام ديال `/api` كان 60 فالدقيقة لكل IP. الخدامة والزبناء اللي على الـWiFi ديال المطعم كيبانو بنفس الـIP، وصفحة أدمين وحدة كتصيفط ~10 طلبات، وعلى هادشي كانو كيتبلوكاو (429). | الحد ولا 300 فالدقيقة. الدخول والـPIN والـopt-in عندهم حدود خاصة بيهم. |
| `4c1bb48` | الموافقة على Payroll ما كانتش كتحدّث الـtab ديال Reports (P2-12). | كتعيط لـ`fetchReport()` حتى هي. |
| `4c1bb48` | المتغيرات ديال الخلاص والتكاملات ما عندهم حتى تنبيه إلا كانو خاويين (P2-15)، و`FRONTEND_URL` ما كيتشيكاش واش https (Cloud P2-4). | تنبيه فالـlogs ملي كيتشعل السيرفر فالـproduction. |
| `e05d038` | **جديد:** فالـproduction، `/_next/image?url=/assets/logo.png` كيرجع 500، يعني اللوغو ما كيبانش فكاع الصفحات ديال الأدمين. | `next({ hostname: '127.0.0.1', port })` فـ`src/server.ts`. ⚠️ **مازال ما تأكدش فالـproduction**، شوف القسم 5. |

---

## 4. كيفاش تجرب كلشي

- **TypeScript:** `npx tsc --noEmit` نقي من بعد كل commit.
- **API:** كل إصلاح تجرب بـ`curl` على السيرفر المحلي (`npm run dev`) بالحساب ديال الديمو `plage@demo.com` / `demo1234`.
- **الـcron ديال الديون:** تجرب بداتابيز مزورة، حيت الداتابيز حقيقية ومشتركة، والـcron يقدر يوقف مطاعم بالصح.
- **superadmin:** تجرب بـ`SUPERADMIN_SECRET` و`SUPERADMIN_EMAIL` ديال التجربة، باش ما نقراوش الأسرار الحقيقيين.
- **المتصفح:** Playwright `1.61.0` (هي اللي متوافقة مع `chromium-1228` اللي كاين فالكاش)، تخدم من دوسي مؤقت برا الريبو. دوز على 38 صفحة (27 أدمين + العامة + QR + الخدامة) فالمحلي وفالـproduction.

**ما تجربش فالسيرفر (ولكن الكود كيستعمل طرق مجربين):**
- الكليك جوج مرات ديال إغلاق الـshift
- الـcheckout ديال طاولة مجموعة
- التبديل العادي ديال الحالة ديال طلب مفتوح

---

## 5. ⚠️ مازال مفتوح فالـproduction (5 نونبر 2026)

| المشكل | الحالة دابا | شنو خاص |
|---|---|---|
| `https://smartrestau.com` (بلا `www`) | **503** "no available server" | فـCoolify ← Domains: زيد `smartrestau.com` حدا `www.smartrestau.com`، وRedeploy. |
| `https://smartrestau.digima.cloud` | **503** | نفس الشي، ولا حيدو إلا ما بقاش مستعمل. |
| اللوغو المصغر (`/_next/image`) | **500** | تأكد بلي commit `e05d038` تدار ليه deploy. إلا مازال كيطيح، قلب فالـlogs ديال Coolify على `upstream image response failed for /assets/logo.png`، والسطر اللي موراه كيقول السبب بالضبط. |
| `FRONTEND_URL` و`NEXT_PUBLIC_SOCKET_URL` | | خاصهم يكونو `https://www.smartrestau.com`. `NEXT_PUBLIC_SOCKET_URL` كيتحط فالكود وقت الـbuild، يعني خاص Redeploy. |

**ملاحظة:** فخانة Domains ديال Coolify كتب السمية بلا `https://`، حيت الخانة كتزيدها بوحدها.

---

## 6. باقي (ما تصلحش، بقرار)

| | علاش تأجل |
|---|---|
| **P1-6: Backup ديال MongoDB Atlas** | **تأجل بقرار ديال صاحب المشروع:** دابا كاينين غير حسابات تجريبية. **خاصو يتشيكا قبل أول مطعم حقيقي.** الـbackup اللي فالـdashboard ديال التطبيق ما كيدير والو. |
| P2-1: حذف مطعم كامل بلا transaction | MongoDB عندو حدود فالوقت والحجم ديال الـtransactions، والتجربة كتطلب نمسحو مطعم حقيقي. نرجعو ليه مع الـbackup. |
| P1-7: `prisma db push` فكل deploy بلا dry-run | خاصو قرار ديال البنية. |
| P1-8: سيرفر واحد، والـrate limiter والـEventBus فالذاكرة | ماشي مشكل دابا. نرجعو ليه ملي يكبر المشروع. |
| P2-11 / P2-13 / P2-14 | P2-11: الـPIN ديال الديمو، خدام كيف خاص. P2-13: ما كاينش test suite. P2-14: حماية `main` فـGitHub، خاص يديرها صاحب المشروع ← Settings ← Branches. |
| التصميم ديال الكارطات فصفحة الحجوزات | كيبانو رماديين وصعاب يتقراو، بقايا من الـdark theme. ماشي مستعجل. |
| `scrap/` | فيه ملفات ديال leads (`.csv` و`.xlsx`) داخلين فـgit. الـcsv فيه غير العناوين ديال الأعمدة دابا، ولكن الأحسن يتزاد `scrap/` لـ`.gitignore`. |

---

## 7. لائحة الـcommits

```
e05d038 fix(images): pass hostname/port to next() so /_next/image can fetch local files
0056c51 fix(rate-limit): raise general /api limit from 60 to 300 req/min per IP
9a04c0d fix(reservations): admin page crashed on CHECKED_IN / NO_SHOW reservations
42f3f19 refactor(auth): route six restaurant routers' token check through one helper
d441330 fix(security): stop 500 responses leaking raw error messages in production
4c1bb48 fix: close four more Sprint 12 audit P2s
de62e01 fix: close four small Sprint 12 audit P2s
1b04d58 fix(security): one shared SuperAdmin header check across all SA routers
d8c0a10 fix(security): rate-limit failed staff PIN logins
087a2ca fix(billing-cron): isolate per-cafe failures in daily debt detection
c83073f fix(orders): make COMPLETED/CANCELLED terminal in PATCH /api/orders/:id/status
```
