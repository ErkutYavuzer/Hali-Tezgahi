/**
 * 🤖 AI Motif Dönüşümü v8 — 2 Katmanlı Pipeline (API Only)
 * 
 * Pipeline:
 *  1. BİRİNCİL: Antigravity Gateway (Gemini 3 Pro Image) — premium kalite
 *  2. FALLBACK: Google API Direct (Gemini 2.0 Flash Image) — ucuz, hızlı
 * 
 * Antigravity: antigravity.mindops.net (OpenAI-compatible)
 * Google API: generativelanguage.googleapis.com (native Gemini)
 */

// Birincil: Google API Direct (Gemini — daha güvenilir)
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
const GOOGLE_MODEL = 'gemini-2.0-flash-exp-image-generation';
const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent`;

// Fallback: Antigravity Gateway (Gemini 3 Pro Image)
const API_URL = process.env.AI_API_URL || 'https://antigravity.mindops.net/v1/chat/completions';
const API_KEY = process.env.AI_API_KEY || '';
const IMAGE_MODEL = 'gemini-3-pro-image-1x1';

// Rate limiting
let activeRequests = 0;
const MAX_CONCURRENT = 2;
const pendingQueue = [];

// API durumu
let apiAvailable = true;
let apiFailCount = 0;
const API_MAX_FAILS = 3;

// Google API durumu
let googleApiAvailable = true;
let googleApiFailCount = 0;
const GOOGLE_API_MAX_FAILS = 3;

// Gemini dönüşüm prompt'u (admin'den değiştirilebilir)
let currentPrompt = `Transform this freehand drawing into a traditional Anatolian Turkish kilim carpet motif.

CRITICAL RULES:
1. KEEP the same subject/shape from the drawing — if it's a house, make a kilim house motif. If it's a cat, make a kilim cat motif. DO NOT change the subject.
2. Convert the lines and shapes into geometric kilim style: use stepped lines, diamonds, triangles, zigzag edges
3. Use traditional Turkish kilim color palette: deep reds, navy blue, gold/saffron, cream, dark brown, forest green
4. Keep the original composition and positioning
5. Add a small decorative kilim border frame
6. Fill background with cream/natural wool color
7. Flat, textile-like coloring — no gradients, no 3D effects, no photorealism
8. The result should look like it was hand-woven on a carpet loom with visible thread texture and slight raised embossed relief
9. Make the motif warm, symmetric where possible, and authentically Turkish
10. Output a clean, square image`;

export function getTransformPrompt() { return currentPrompt; }
export function setTransformPrompt(prompt) { currentPrompt = prompt; }

/**
 * Ana motif dönüşüm pipeline'ı
 */
export async function transformToMotif(base64DataUrl, userName = 'Anonim') {
    if (activeRequests >= MAX_CONCURRENT) {
        return new Promise((resolve) => {
            pendingQueue.push({ base64DataUrl, userName, resolve });
            console.log(`🤖 AI kuyruğa eklendi. Kuyruk: ${pendingQueue.length}`);
        });
    }

    activeRequests++;
    console.log(`🤖 AI motif pipeline başlıyor... (aktif: ${activeRequests}, sahibi: ${userName})`);

    try {
        let result = null;

        // 1. BİRİNCİL: Google API Direct (Gemini 2.0 Flash Image)
        if (googleApiAvailable && GOOGLE_API_KEY) {
            result = await tryGoogleApi(base64DataUrl, userName);
        }

        // 2. FALLBACK: Antigravity Gateway (Gemini 3 Pro Image)
        if (!result && apiAvailable && API_KEY) {
            console.log('🔄 Google API başarısız, Antigravity fallback deneniyor...');
            result = await tryApiGateway(base64DataUrl, userName);
        }

        if (result) {
            console.log(`✅ AI kilim motifi başarılı!`);
        } else {
            console.warn('⚠️ Tüm kaynaklar başarısız — motif üretilemedi');
        }
        return result;
    } catch (err) {
        console.error(`❌ AI motif pipeline hatası: ${err.message}`);
        return null;
    } finally {
        activeRequests--;
        if (pendingQueue.length > 0) {
            const next = pendingQueue.shift();
            transformToMotif(next.base64DataUrl, next.userName).then(next.resolve);
        }
    }
}

/**
 * Antigravity Gateway ile motif üret (BİRİNCİL)
 */
async function tryApiGateway(base64DataUrl, userName = 'Anonim') {
    console.log(`🌐 Antigravity Gateway deneniyor (${IMAGE_MODEL})...`);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: IMAGE_MODEL,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: currentPrompt + `\n\n11. Write the artist name "${userName}" in small elegant text at the bottom-left corner of the motif, as if it was woven into the carpet.` },
                        { type: 'image_url', image_url: { url: base64DataUrl } }
                    ]
                }],
                max_tokens: 4096
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || JSON.stringify(data.error));
        }

        const content = data.choices?.[0]?.message?.content || '';

        // Markdown formatında image
        const imgMatch = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
        if (imgMatch) {
            apiFailCount = 0;
            apiAvailable = true;
            console.log(`🌐✅ Antigravity motifi üretildi! (${Math.round(imgMatch[0].length / 1024)}KB)`);
            return imgMatch[0];
        }

        // Raw base64
        if (content.length > 1000 && /^[A-Za-z0-9+/=\s]+$/.test(content.trim())) {
            const clean = content.trim().replace(/\s/g, '');
            apiFailCount = 0;
            apiAvailable = true;
            console.log(`🌐✅ Antigravity motifi üretildi (raw)! (${Math.round(clean.length / 1024)}KB)`);
            return `data:image/jpeg;base64,${clean}`;
        }

        throw new Error('Yanıtta görsel bulunamadı');

    } catch (err) {
        apiFailCount++;
        console.warn(`🌐❌ Antigravity hata (${apiFailCount}/${API_MAX_FAILS}): ${err.message}`);

        if (apiFailCount >= API_MAX_FAILS) {
            apiAvailable = false;
            console.warn('🌐⏸️ Antigravity geçici olarak devre dışı');
            setTimeout(() => {
                apiAvailable = true;
                apiFailCount = 0;
                console.log('🌐🔄 Antigravity tekrar aktif edildi');
            }, 300000);
        }

        return null;
    }
}

/**
 * Google API Direct ile motif üret (FALLBACK)
 */
async function tryGoogleApi(base64DataUrl, userName = 'Anonim') {
    console.log(`🔵 Google API deneniyor (${GOOGLE_MODEL})...`);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        // base64DataUrl'den raw base64'ü çıkar
        const base64Match = base64DataUrl.match(/base64,(.+)/);
        const rawBase64 = base64Match ? base64Match[1] : base64DataUrl;

        const response = await fetch(`${GOOGLE_API_URL}?key=${GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: currentPrompt + `\n\n11. Write the artist name "${userName}" in small elegant text at the bottom-left corner of the motif, as if it was woven into the carpet.` },
                        { inlineData: { mimeType: 'image/png', data: rawBase64 } }
                    ]
                }],
                generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || JSON.stringify(data.error));
        }

        const parts = data.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
            if (part.inlineData) {
                const mime = part.inlineData.mimeType || 'image/png';
                const b64 = part.inlineData.data;
                googleApiFailCount = 0;
                googleApiAvailable = true;
                console.log(`🔵✅ Google API motifi üretildi! (${Math.round(b64.length / 1024)}KB)`);
                return `data:${mime};base64,${b64}`;
            }
        }

        throw new Error('Yanıtta görsel bulunamadı');

    } catch (err) {
        googleApiFailCount++;
        console.warn(`🔵❌ Google API hata (${googleApiFailCount}/${GOOGLE_API_MAX_FAILS}): ${err.message}`);

        if (googleApiFailCount >= GOOGLE_API_MAX_FAILS) {
            googleApiAvailable = false;
            console.warn('🔵⏸️ Google API geçici olarak devre dışı');
            setTimeout(() => {
                googleApiAvailable = true;
                googleApiFailCount = 0;
                console.log('🔵🔄 Google API tekrar aktif edildi');
            }, 300000);
        }

        return null;
    }
}

export function getAIStatus() {
    return {
        activeRequests,
        queueLength: pendingQueue.length,
        maxConcurrent: MAX_CONCURRENT,
        primary: {
            name: 'Google API Direct (Gemini 2.0 Flash Image)',
            available: googleApiAvailable,
            model: GOOGLE_MODEL,
            failCount: googleApiFailCount,
        },
        fallback: {
            name: 'Antigravity Gateway (Gemini 3 Pro Image)',
            available: apiAvailable,
            model: IMAGE_MODEL,
            failCount: apiFailCount,
        }
    };
}
