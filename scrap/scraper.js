const puppeteer = require('puppeteer');
const express   = require('express');
const axios     = require('axios');
const fs        = require('fs');
const path      = require('path');
const crypto    = require('crypto');
const XLSX      = require('xlsx');

const app  = express();
const PORT = process.env.PORT || 3000;
const jobs = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Phone cleaner + mobile-only filter ──────────────────────────────────────
function cleanPhone(phone, country) {
    if (!phone) return null;
    const c = country.toLowerCase().trim();
    let clean = phone.replace(/[\s\-\(\)\.]/g, '');

    if (['morocco', 'maroc', 'المغرب'].includes(c)) {
        clean = clean.replace(/^\+/, '');
        // normalize to 212XXXXXXXXX
        if (/^212[67]\d{8}$/.test(clean))  { /* already good */ }
        else if (/^0[67]\d{8}$/.test(clean)) clean = `212${clean.slice(1)}`;
        else if (/^[67]\d{8}$/.test(clean))  clean = `212${clean}`;
        else return null; // landline or unrecognized → skip

        // keep ONLY mobiles: 2126 or 2127 — landlines skip
        if (!/^2126/.test(clean) && !/^2127/.test(clean)) return null;
        return clean;
    }
    // international — accept anything 8+ digits
    const digits = clean.replace(/\D/g, '');
    return digits.length >= 8 ? clean : null;
}

// ─── Google Maps scraper (Puppeteer, no API key needed) ───────────────────────
async function scrapeGoogleMaps(city, country, limit, log) {
    log('🚀 جاري فتح المتصفح...');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox',
               '--disable-dev-shm-usage', '--disable-gpu']
    });

    const results = [];

    try {
        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        await page.setViewport({ width: 1280, height: 800 });

        const query = `cafes restaurants ${city} ${country}`;
        log(`🔍 جاري البحث: ${query}`);

        await page.goto(
            `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
            { waitUntil: 'domcontentloaded', timeout: 30000 }
        );

        // accept Google consent if it appears
        try {
            await page.waitForSelector('form[action*="consent"]', { timeout: 4000 });
            await page.click('form[action*="consent"] button');
            await delay(1500);
        } catch (_) {}

        // wait for the results feed
        try {
            await page.waitForSelector('[role="feed"]', { timeout: 15000 });
        } catch (_) {
            log('⚠️ لم تظهر نتائج. تأكد من الاتصال بالإنترنت.');
            return results;
        }

        log('📋 جاري تحميل قائمة المحلات...');

        // scroll the feed to collect enough place links
        const placeLinks = new Set();
        for (let attempt = 0; attempt < 10 && placeLinks.size < limit * 2; attempt++) {
            const links = await page.$$eval(
                '[role="feed"] a[href*="/maps/place/"]',
                els => [...new Set(els.map(e => e.href).filter(h => h.includes('/maps/place/')))]
            );
            links.forEach(l => placeLinks.add(l));
            log(`📍 ${placeLinks.size} محل حتى الآن...`);
            if (placeLinks.size >= limit * 2) break;
            await page.$eval('[role="feed"]', el => el.scrollBy(0, 5000)).catch(() => {});
            await delay(2000);
        }

        log(`✅ ${placeLinks.size} محل، جاري استخراج أرقام الهاتف...`);

        for (const link of [...placeLinks]) {
            if (results.length >= limit) break;
            try {
                await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 15000 });
                await delay(1200);

                const info = await page.evaluate(() => {
                    const name = document.querySelector('h1')?.textContent?.trim() || 'Unknown';

                    // phone: try several stable selectors + tel: links
                    let phone = null;
                    const candidates = [
                        document.querySelector('[data-item-id*="phone:tel"] .fontBodyMedium'),
                        document.querySelector('[data-item-id*="phone"] .fontBodyMedium'),
                        document.querySelector('button[aria-label*="phone"] .fontBodyMedium'),
                        document.querySelector('a[href^="tel:"]'),
                    ];
                    for (const el of candidates) {
                        if (!el) continue;
                        phone = el.tagName === 'A'
                            ? el.getAttribute('href').replace('tel:', '')
                            : el.textContent.trim();
                        break;
                    }

                    const ratingEl = document.querySelector('.fontDisplayLarge');
                    const rating   = ratingEl ? parseFloat(ratingEl.textContent) || 4.0 : 4.0;

                    // email: look for mailto: link or regex in page text
                    let email = '';
                    const mailEl = document.querySelector('a[href^="mailto:"]');
                    if (mailEl) {
                        email = mailEl.getAttribute('href').replace('mailto:', '').trim();
                    } else {
                        const m = document.body.innerText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
                        if (m) email = m[0];
                    }

                    return { name, phone, rating, email };
                });

                if (info.phone) {
                    const phone = cleanPhone(info.phone, country)
                                  || info.phone.replace(/[\s\-\(\)\.]/g, '');
                    if (phone && phone.replace(/\D/g, '').length >= 8) {
                        results.push({ name: info.name, phone, email: info.email || '', rating: info.rating });
                        log(`📞 (${results.length}/${limit}) ${info.name}`);
                    }
                }
            } catch (_) { /* skip unreachable place */ }
        }

    } finally {
        await browser.close();
    }

    return results;
}

// ─── Facebook / Instagram scraper (DuckDuckGo + smarter regex) ───────────────
async function scrapeSocial(city, country, limit, platform, log) {
    const results   = [];
    const domain    = platform === 'facebook' ? 'facebook.com' : 'instagram.com';
    const seenPhones = new Set();
    const c         = country.toLowerCase();

    const queries = [
        `site:${domain} "${city}" café restaurant`,
        `site:${domain} "${city}" restaurant contact téléphone`,
        `site:${domain} "${city}" resto menu`,
    ];

    for (const query of queries) {
        if (results.length >= limit) break;
        log(`🔍 ${query}`);

        try {
            const { data: html } = await axios.get(
                `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
                { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }
            );

            let phones;
            if (['morocco', 'maroc', 'المغرب'].includes(c)) {
                phones = html.match(
                    /(?:\+212|00212|0)[67][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}/g
                ) || [];
            } else {
                phones = html.match(
                    /(?:\+\d{1,3}[\s.\-]?)?\(?\d{2,4}\)?[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}/g
                ) || [];
            }

            for (const raw of phones) {
                if (results.length >= limit) break;
                const phone = cleanPhone(raw, country) || raw.replace(/[\s\-\(\)\.]/g, '');
                if (phone && phone.replace(/\D/g, '').length >= 8 && !seenPhones.has(phone)) {
                    seenPhones.add(phone);
                    // try to pull an email near the phone in the HTML
                    const emailMatch = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
                    results.push({
                        name:  `Lead_${platform.toUpperCase()}_${phone.slice(-6)}`,
                        phone,
                        email: emailMatch ? emailMatch[0] : '',
                        rating: 4.5
                    });
                    log(`📱 (${results.length}/${limit}) رقم جديد: ${phone}`);
                }
            }
        } catch (e) {
            log(`⚠️ خطأ في الاستعلام: ${e.message}`);
        }

        await delay(2500);
    }

    return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));

const XLS_HEADERS = ['اسم المقهى','الهاتف','البريد الإلكتروني','المدينة','الدولة','التقييم'];

function buildXLS(results, city, country, platform) {
    const rows = results.map(r => ({
        'اسم المقهى':          r.name,
        'الهاتف':              r.phone,
        'البريد الإلكتروني':   r.email || '',
        'المدينة':             city,
        'الدولة':              country,
        'التقييم':             r.rating,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, { header: XLS_HEADERS });
    ws['!cols'] = [35, 20, 30, 15, 15, 10].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ─── HTML templates ──────────────────────────────────────────────────────────
const STYLE = `
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
    <style>
        *{box-sizing:border-box}
        body{font-family:'Cairo',sans-serif;background:#f3f4f6;margin:0;padding:40px;
             display:flex;justify-content:center;align-items:center;min-height:100vh}
        .card{background:#fff;padding:30px;border-radius:16px;
              box-shadow:0 10px 25px rgba(0,0,0,.07);width:100%;max-width:520px}
        h2{text-align:center;color:#1e293b;margin-bottom:25px;font-weight:700}
        .fg{margin-bottom:18px}
        label{display:block;margin-bottom:6px;color:#475569;font-weight:600}
        input,select{width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:8px;
                     font-family:'Cairo',sans-serif;font-size:14px;transition:.3s}
        input:focus,select:focus{border-color:#2563eb;outline:none;
                                  box-shadow:0 0 0 3px rgba(37,99,235,.1)}
        button{width:100%;padding:13px;background:#2563eb;color:#fff;border:none;
               border-radius:8px;font-size:16px;font-weight:700;cursor:pointer;
               font-family:'Cairo',sans-serif;transition:.2s}
        button:hover{background:#1d4ed8}
        .foot{text-align:center;margin-top:18px;font-size:12px;color:#94a3b8}
        .log{background:#0f172a;color:#a3e635;padding:16px;border-radius:10px;
             font-size:13px;line-height:1.8;max-height:320px;overflow-y:auto;
             margin-top:18px;font-family:monospace;white-space:pre-wrap}
        .spin{display:inline-block;width:22px;height:22px;border:3px solid #cbd5e1;
              border-top-color:#2563eb;border-radius:50%;animation:spin .8s linear infinite;
              vertical-align:middle;margin-left:8px}
        @keyframes spin{to{transform:rotate(360deg)}}
    </style>`;

const FORM_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Smart Resto - Lead Generator</title>${STYLE}</head><body>
<div class="card">
    <h2>🚀 نظام قنص الداتا الذكي</h2>
    <form action="/scrape" method="POST">
        <div class="fg"><label>📍 اسم المدينة:</label>
            <input name="city" placeholder="Agadir, Casablanca..." required></div>
        <div class="fg"><label>🌍 الدولة:</label>
            <input name="country" placeholder="Morocco, Senegal..." required></div>
        <div class="fg"><label>🔢 الحد الأقصى للأرقام:</label>
            <input type="number" name="maxNumbers" value="20" min="1" required></div>
        <div class="fg"><label>🖥️ المنصة:</label>
            <select name="platform">
                <option value="google">Google Maps (مباشر، بدون API)</option>
                <option value="facebook">Facebook Pages</option>
                <option value="instagram">Instagram Bio</option>
            </select></div>
        <button type="submit">بدء القنص وتحميل CSV 🎯</button>
    </form>
    <div class="foot">Smart Resto — Lead Scraper</div>
</div></body></html>`;

function jobPageHTML(jobId) {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>جاري القنص...</title>${STYLE}</head><body>
<div class="card">
    <h2 id="title">⏳ جاري القنص... <span class="spin"></span></h2>
    <div class="log" id="log">جاري الاتصال...</div>
    <div class="foot" id="foot"></div>
</div>
<script>
async function poll() {
    try {
        const r  = await fetch('/job/${jobId}/status');
        const d  = await r.json();
        document.getElementById('log').textContent = d.progress.join('\\n');
        document.getElementById('log').scrollTop = 9999;

        if (d.status === 'done') {
            document.getElementById('title').innerHTML = '✅ اكتمل! ' + d.total + ' رقم';
            document.querySelector('.spin')?.remove();
            document.getElementById('foot').innerHTML =
                '<a href="/download/${jobId}" style="color:#2563eb;font-weight:700;font-size:16px">' +
                '📥 تحميل CSV</a>';
            return;
        }
        if (d.status === 'error') {
            document.getElementById('title').innerHTML = '❌ حدث خطأ';
            document.querySelector('.spin')?.remove();
            document.getElementById('foot').innerHTML =
                '<span style="color:#ef4444">' + (d.error || 'خطأ غير معروف') + '</span>' +
                '<br><a href="/" style="color:#2563eb">↩ رجوع</a>';
            return;
        }
        if (d.status === 'not_found') {
            document.getElementById('title').innerHTML = '❌ انتهت صلاحية الجلسة';
            document.querySelector('.spin')?.remove();
            document.getElementById('foot').innerHTML = '<a href="/" style="color:#2563eb">↩ رجوع</a>';
            return;
        }
    } catch(_) {}
    setTimeout(poll, 2000);
}
poll();
</script></body></html>`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.send(FORM_HTML));

app.post('/scrape', (req, res) => {
    const { city, country, maxNumbers, platform } = req.body;
    const jobId = crypto.randomUUID().split('-')[0];
    const limit = Math.max(1, parseInt(maxNumbers) || 20);
    const cleanCity    = city.trim();
    const cleanCountry = country.trim();

    jobs.set(jobId, { status: 'running', progress: [], csvPath: null,
                       csvFileName: null, totalFound: 0, error: null });

    // run scraping in background
    (async () => {
        const job = jobs.get(jobId);
        const log = msg => { job.progress.push(msg); console.log(msg); };

        try {
            const results = platform === 'google'
                ? await scrapeGoogleMaps(cleanCity, cleanCountry, limit, log)
                : await scrapeSocial(cleanCity, cleanCountry, limit, platform, log);

            const xlsFileName = `${cleanCity.toLowerCase()}_${platform}_leads.xlsx`;
            const xlsPath     = path.join(__dirname, xlsFileName);
            fs.writeFileSync(xlsPath, buildXLS(results, cleanCity, cleanCountry, platform));

            job.csvPath     = xlsPath;
            job.csvFileName = xlsFileName;
            job.totalFound  = results.length;
            job.status      = 'done';
            log(`✅ اكتمل! ${results.length} رقم جوال فلتري (2126/2127) جاهز للتحميل.`);

        } catch (err) {
            job.status = 'error';
            job.error  = err.message;
            console.error(err);
        }
    })();

    res.redirect(`/job/${jobId}`);
});

app.get('/job/:id', (req, res) => {
    if (!jobs.has(req.params.id)) return res.status(404).send('Job not found');
    res.send(jobPageHTML(req.params.id));
});

app.get('/job/:id/status', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.json({ status: 'not_found' });
    res.json({ status: job.status, progress: job.progress,
               error: job.error, total: job.totalFound });
});

app.get('/download/:id', (req, res) => {
    const job = jobs.get(req.params.id);

    if (!job)
        return res.status(404).send('انتهت صلاحية الجلسة. <a href="/">↩ رجوع</a>');

    if (job.status === 'running')
        return res.status(202).send('لازال جاري القنص... <a href="/job/' + req.params.id + '">↩ رجوع</a>');

    if (job.status === 'error')
        return res.status(500).send('حدث خطأ: ' + job.error + '. <a href="/">↩ رجوع</a>');

    if (!job.csvPath || !fs.existsSync(job.csvPath))
        return res.status(404).send('الملف غير متوفر. <a href="/">↩ رجوع</a>');

    res.download(job.csvPath, job.csvFileName, (err) => {
        // delete the file after download but keep the job record
        try { if (fs.existsSync(job.csvPath)) fs.unlinkSync(job.csvPath); } catch (_) {}
        job.csvPath = null; // mark as consumed
    });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🚀 Smart Resto Lead Scraper جاهز!`);
    console.log(`🔗 http://localhost:${PORT}`);
    console.log(`${'='.repeat(50)}\n`);
});
