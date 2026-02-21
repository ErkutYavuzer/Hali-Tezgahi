/**
 * 🤖 AI Motif Dönüşümü v6 — Gemini Pro Image + Self-Hosted Fallback
 * 
 * Pipeline (2 katmanlı):
 *  1. BİRİNCİL: Gemini 3 Pro Image (Antigravity Gateway) — profesyonel kalite, 5-10sn
 *  2. FALLBACK: Self-hosted SDXL Turbo (Kubernetes, CPU) — ücretsiz, 60sn
 *  3. Üretilen görseli base64 data URL olarak döndür
 * 
 * API Gateway: antigravity.mindops.net (OpenAI-compatible)
 * Fallback: hali-mozaik-image-gen.hali-mozaik.svc.cluster.local
 */

// Birincil: Antigravity Gateway (Gemini 3 Pro Image)
const API_URL = process.env.AI_API_URL || 'https://antigravity.mindops.net/v1/chat/completions';
const API_KEY = process.env.AI_API_KEY || 'sk-antigravity-lejyon-2026';
const IMAGE_MODEL = 'gemini-3-pro-image-1x1';

// Fallback: Self-hosted SDXL Turbo (Kubernetes internal)
const SELF_HOSTED_URL = process.env.IMAGE_GEN_URL || 'http://hali-mozaik-image-gen.hali-mozaik.svc.cluster.local/generate';

// Rate limiting
let activeRequests = 0;
const MAX_CONCURRENT = 2;
const pendingQueue = [];

// API durumu
let apiAvailable = true;
let apiFailCount = 0;
const API_MAX_FAILS = 3;

// Self-hosted durumu
let selfHostedAvailable = true;
let selfHostedFailCount = 0;
const SELF_HOSTED_MAX_FAILS = 3;

// Gemini dönüşüm prompt'u — profesyonel kalite
const TRANSFORM_PROMPT = `Transform this freehand drawing into a traditional Anatolian Turkish kilim carpet motif.

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

// Self-hosted SDXL prompt
const KILIM_PROMPT_SHORT = `masterpiece, best quality, professional traditional Anatolian Turkish kilim carpet motif, highly detailed geometric folk art, pixel-perfect stepped lines, diamond shapes, triangle borders, zigzag edges, elibelinde motif, rich crimson red navy blue antique gold saffron cream ivory, textured woven wool fabric surface, visible thread weave pattern, symmetric composition, ornate kilim border frame, museum quality Turkish rug`;

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

        // 1. BİRİNCİL: Gemini 3 Pro Image (profesyonel kalite)
        if (apiAvailable && API_KEY) {
            result = await tryApiGateway(base64DataUrl, userName);
        }

        // 2. FALLBACK: Self-hosted SDXL Turbo (ücretsiz)
        if (!result && selfHostedAvailable) {
            console.log('🔄 Gemini başarısız, Self-hosted SDXL fallback deneniyor...');
            result = await trySelfHosted(base64DataUrl);
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
 * Gemini 3 Pro Image ile motif üret (BİRİNCİL)
 */
async function tryApiGateway(base64DataUrl, userName = 'Anonim') {
    console.log(`🌐 Gemini Pro Image deneniyor (${IMAGE_MODEL})...`);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60sn timeout

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
                        { type: 'text', text: TRANSFORM_PROMPT + `\n\n11. Write the artist name "${userName}" in small elegant text at the bottom-left corner of the motif, as if it was woven into the carpet.` },
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

        // Markdown formatında image: ![image](data:image/jpeg;base64,...)
        const imgMatch = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
        if (imgMatch) {
            apiFailCount = 0;
            apiAvailable = true;
            console.log(`🌐✅ Gemini motifi üretildi! (${Math.round(imgMatch[0].length / 1024)}KB)`);
            return imgMatch[0];
        }

        // Raw base64
        if (content.length > 1000 && /^[A-Za-z0-9+/=\s]+$/.test(content.trim())) {
            const clean = content.trim().replace(/\s/g, '');
            apiFailCount = 0;
            apiAvailable = true;
            console.log(`🌐✅ Gemini motifi üretildi (raw)! (${Math.round(clean.length / 1024)}KB)`);
            return `data:image/jpeg;base64,${clean}`;
        }

        throw new Error('Yanıtta görsel bulunamadı');

    } catch (err) {
        apiFailCount++;
        console.warn(`🌐❌ Gemini hata (${apiFailCount}/${API_MAX_FAILS}): ${err.message}`);

        if (apiFailCount >= API_MAX_FAILS) {
            apiAvailable = false;
            console.warn('🌐⏸️ Gemini geçici olarak devre dışı (çok fazla hata)');
            // 5dk sonra tekrar dene
            setTimeout(() => {
                apiAvailable = true;
                apiFailCount = 0;
                console.log('🌐🔄 Gemini tekrar aktif edildi');
            }, 300000);
        }

        return null;
    }
}

/**
 * Self-hosted SDXL Turbo ile motif üret (FALLBACK)
 */
async function trySelfHosted(base64DataUrl) {
    console.log('🏠 Self-hosted SDXL Turbo fallback deneniyor...');

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 300000); // 5dk timeout

        const response = await fetch(SELF_HOSTED_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: KILIM_PROMPT_SHORT,
                image: base64DataUrl,
                strength: 0.55,
                steps: 6,
                guidance_scale: 0.0,
                width: 512,
                height: 512,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.image) {
            selfHostedFailCount = 0;
            selfHostedAvailable = true;
            console.log(`🏠✅ SDXL fallback başarılı! (${data.elapsed_seconds || '?'}s)`);
            return data.image;
        }

        throw new Error(data.error || 'Yanıtta image yok');

    } catch (err) {
        selfHostedFailCount++;
        console.warn(`🏠❌ SDXL hata (${selfHostedFailCount}/${SELF_HOSTED_MAX_FAILS}): ${err.message}`);

        if (selfHostedFailCount >= SELF_HOSTED_MAX_FAILS) {
            selfHostedAvailable = false;
            console.warn('🏠⏸️ SDXL fallback geçici olarak devre dışı');
            setTimeout(() => {
                selfHostedAvailable = true;
                selfHostedFailCount = 0;
                console.log('🏠🔄 SDXL fallback tekrar aktif edildi');
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
            name: 'Gemini 3 Pro Image',
            available: apiAvailable,
            model: IMAGE_MODEL,
            url: API_URL,
            failCount: apiFailCount,
        },
        fallback: {
            name: 'SDXL Turbo (Self-hosted)',
            available: selfHostedAvailable,
            url: SELF_HOSTED_URL,
            failCount: selfHostedFailCount,
        }
    };
}
