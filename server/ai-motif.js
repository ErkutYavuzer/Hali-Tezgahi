/**
 * 🤖 AI Motif Dönüşümü v5 — Self-Hosted + API Fallback
 * 
 * Pipeline (2 katmanlı):
 *  1. ÖNCE: Self-hosted LCM model (Kubernetes, CPU) → /generate endpoint
 *  2. FALLBACK: Antigravity Gateway API → gemini-3-pro-image-1x1
 *  3. Üretilen görseli base64 data URL olarak döndür
 * 
 * Self-Hosted: hali-mozaik-image-gen.hali-mozaik.svc.cluster.local
 * Fallback API: antigravity.mindops.net (OpenAI-compatible)
 */

// Self-hosted image generation service (Kubernetes internal)
const SELF_HOSTED_URL = process.env.IMAGE_GEN_URL || 'http://hali-mozaik-image-gen.hali-mozaik.svc.cluster.local/generate';

// Fallback: Antigravity Gateway
const API_URL = process.env.AI_API_URL || 'https://antigravity.mindops.net/v1/chat/completions';
const API_KEY = process.env.AI_API_KEY || 'sk-antigravity-lejyon-2026';
const IMAGE_MODEL = 'gemini-3-pro-image-1x1';

// Rate limiting
let activeRequests = 0;
const MAX_CONCURRENT = 2;
const pendingQueue = [];

// Self-hosted durumu
let selfHostedAvailable = true;
let selfHostedFailCount = 0;
const SELF_HOSTED_MAX_FAILS = 3;

// Dönüşüm prompt'u
const TRANSFORM_PROMPT = `Transform this freehand drawing into a traditional Anatolian Turkish kilim carpet motif.

CRITICAL RULES:
1. KEEP the same subject/shape from the drawing — if it's a house, make a kilim house motif. If it's a cat, make a kilim cat motif. DO NOT change the subject.
2. Convert the lines and shapes into geometric kilim style: use stepped lines, diamonds, triangles, zigzag edges
3. Use traditional Turkish kilim color palette: deep reds, navy blue, gold/saffron, cream, dark brown, forest green
4. Keep the original composition and positioning
5. Add a small decorative kilim border frame
6. Fill background with cream/natural wool color
7. Flat, textile-like coloring — no gradients, no 3D effects, no photorealism
8. The result should look like it was hand-woven on a carpet loom
9. Make the motif warm, symmetric where possible, and authentically Turkish
10. Output a clean, square image`;

// Kilim prompt (self-hosted için)
const KILIM_PROMPT_SHORT = `masterpiece, best quality, professional traditional Anatolian Turkish kilim carpet motif, highly detailed geometric folk art, pixel-perfect stepped lines, diamond shapes, triangle borders, zigzag edges, elibelinde motif, rich crimson red navy blue antique gold saffron cream ivory, flat woven textile, zero gradients, symmetric composition, ornate kilim border frame, museum quality Turkish rug`;

/**
 * Ana motif dönüşüm pipeline'ı
 */
export async function transformToMotif(base64DataUrl) {
    if (activeRequests >= MAX_CONCURRENT) {
        return new Promise((resolve) => {
            pendingQueue.push({ base64DataUrl, resolve });
            console.log(`🤖 AI kuyruğa eklendi. Kuyruk: ${pendingQueue.length}`);
        });
    }

    activeRequests++;
    console.log(`🤖 AI motif pipeline başlıyor... (aktif: ${activeRequests})`);

    try {
        let result = null;

        // 1. Self-hosted dene (hızlı, ücretsiz)
        if (selfHostedAvailable) {
            result = await trySelfHosted(base64DataUrl);
        }

        // 2. Fallback: API gateway
        if (!result && API_KEY) {
            console.log('🔄 Self-hosted başarısız, API fallback deneniyor...');
            result = await tryApiGateway(base64DataUrl);
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
            transformToMotif(next.base64DataUrl).then(next.resolve);
        }
    }
}

/**
 * Self-hosted LCM model ile motif üret
 */
async function trySelfHosted(base64DataUrl) {
    console.log('🏠 Self-hosted image generation deneniyor...');

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 300000); // 5dk timeout

        const response = await fetch(SELF_HOSTED_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: KILIM_PROMPT_SHORT,
                image: base64DataUrl,
                strength: 0.75,
                steps: 4,
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
            console.log(`🏠✅ Self-hosted başarılı! (${data.elapsed_seconds || '?'}s)`);
            return data.image;
        }

        throw new Error(data.error || 'Yanıtta image yok');

    } catch (err) {
        selfHostedFailCount++;
        console.warn(`🏠❌ Self-hosted hata (${selfHostedFailCount}/${SELF_HOSTED_MAX_FAILS}): ${err.message}`);

        if (selfHostedFailCount >= SELF_HOSTED_MAX_FAILS) {
            selfHostedAvailable = false;
            console.warn('🏠⏸️ Self-hosted geçici olarak devre dışı (çok fazla hata)');
            // 5dk sonra tekrar dene
            setTimeout(() => {
                selfHostedAvailable = true;
                selfHostedFailCount = 0;
                console.log('🏠🔄 Self-hosted tekrar aktif edildi');
            }, 300000);
        }

        return null;
    }
}

/**
 * Antigravity Gateway API ile motif üret (fallback)
 */
async function tryApiGateway(base64DataUrl) {
    console.log(`🌐 API Gateway deneniyor (${IMAGE_MODEL})...`);

    try {
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
                        { type: 'text', text: TRANSFORM_PROMPT },
                        { type: 'image_url', image_url: { url: base64DataUrl } }
                    ]
                }],
                max_tokens: 4096
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error('🌐❌ API hatası:', data.error.message || JSON.stringify(data.error));
            return null;
        }

        const content = data.choices?.[0]?.message?.content || '';

        // Markdown formatında image: ![image](data:image/jpeg;base64,...)
        const imgMatch = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
        if (imgMatch) {
            console.log(`🌐✅ API motifi üretildi! (${Math.round(imgMatch[0].length / 1024)}KB)`);
            return imgMatch[0];
        }

        // Raw base64
        if (content.length > 1000 && /^[A-Za-z0-9+/=\s]+$/.test(content.trim())) {
            const clean = content.trim().replace(/\s/g, '');
            console.log(`🌐✅ API motifi üretildi (raw)! (${Math.round(clean.length / 1024)}KB)`);
            return `data:image/jpeg;base64,${clean}`;
        }

        console.warn('🌐⚠️ Yanıtta görsel bulunamadı:', content.substring(0, 200));
        return null;

    } catch (err) {
        console.error('🌐❌ API hatası:', err.message);
        return null;
    }
}

export function getAIStatus() {
    return {
        activeRequests,
        queueLength: pendingQueue.length,
        maxConcurrent: MAX_CONCURRENT,
        selfHosted: {
            available: selfHostedAvailable,
            url: SELF_HOSTED_URL,
            failCount: selfHostedFailCount,
        },
        apiGateway: {
            hasApiKey: !!API_KEY,
            model: IMAGE_MODEL,
            url: API_URL,
        }
    };
}
