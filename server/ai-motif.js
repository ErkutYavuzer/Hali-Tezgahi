/**
 * 🤖 AI Motif Dönüşümü v4 — Orijinal Çizimi Koruyarak Kilim Motifine Dönüştürme
 * 
 * Pipeline (TEK ADIM):
 *  1. Orijinal çizimi + dönüşüm prompt'unu gemini-3-pro-image'a gönder
 *  2. AI orijinal şekli koruyarak kilim motifi versiyonunu üretir
 *  3. Üretilen görseli base64 data URL olarak döndür
 * 
 * Gateway: antigravity.mindops.net (OpenAI-compatible)
 * Model: gemini-2.5-flash (img2img destekli)
 */

const API_URL = process.env.AI_API_URL || 'https://antigravity.mindops.net/v1/chat/completions';
const API_KEY = process.env.AI_API_KEY || 'sk-antigravity-lejyon-2026';
const IMAGE_MODEL = 'gemini-3-pro-image-1x1';

// Rate limiting
let activeRequests = 0;
const MAX_CONCURRENT = 2;
const pendingQueue = [];

// Dönüşüm prompt'u — orijinal çizimi koruyarak kilim motifine çevirir
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

/**
 * Ana motif dönüşüm pipeline'ı
 * @param {string} base64DataUrl - Çizimin data URL'i (data:image/png;base64,...)
 * @returns {string|null} - Dönüştürülmüş görselin data URL'i
 */
export async function transformToMotif(base64DataUrl) {
    if (!API_KEY) {
        console.warn('⚠️ AI_API_KEY ayarlanmamış! AI motif devre dışı.');
        return null;
    }

    if (activeRequests >= MAX_CONCURRENT) {
        return new Promise((resolve) => {
            pendingQueue.push({ base64DataUrl, resolve });
            console.log(`🤖 AI kuyruğa eklendi. Kuyruk: ${pendingQueue.length}`);
        });
    }

    activeRequests++;
    console.log(`🤖 AI motif pipeline başlıyor... (aktif: ${activeRequests})`);

    try {
        const result = await generateMotifFromDrawing(base64DataUrl);
        if (result) {
            console.log(`✅ AI kilim motifi başarılı!`);
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
 * Orijinal çizimi doğrudan image modeline gönderip kilim motifine dönüştür (img2img)
 */
async function generateMotifFromDrawing(base64DataUrl) {
    console.log(`🖼️ Orijinal çizim gönderiliyor → kilim motifine dönüştürülecek...`);

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
                        {
                            type: 'text',
                            text: TRANSFORM_PROMPT
                        },
                        {
                            type: 'image_url',
                            image_url: { url: base64DataUrl }
                        }
                    ]
                }],
                max_tokens: 4096
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error('❌ Image gen hatası:', data.error.message || JSON.stringify(data.error));
            return null;
        }

        const content = data.choices?.[0]?.message?.content || '';

        // Response'dan base64 image'ı çıkar
        // Gateway markdown formatında dönebilir: ![image](data:image/jpeg;base64,...)
        const imgMatch = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
        if (imgMatch) {
            console.log(`✅ Kilim motifi üretildi! (${Math.round(imgMatch[0].length / 1024)}KB)`);
            return imgMatch[0];
        }

        // Doğrudan base64 olabilir
        if (content.length > 1000 && /^[A-Za-z0-9+/=\s]+$/.test(content.trim())) {
            const clean = content.trim().replace(/\s/g, '');
            console.log(`✅ Kilim motifi üretildi (raw base64)! (${Math.round(clean.length / 1024)}KB)`);
            return `data:image/jpeg;base64,${clean}`;
        }

        console.warn('⚠️ Yanıtta görsel bulunamadı. Content:', content.substring(0, 300));
        return null;

    } catch (err) {
        console.error('❌ Image gen API hatası:', err.message);
        return null;
    }
}

export function getAIStatus() {
    return {
        activeRequests,
        queueLength: pendingQueue.length,
        maxConcurrent: MAX_CONCURRENT,
        hasApiKey: !!API_KEY,
        imageModel: IMAGE_MODEL
    };
}
