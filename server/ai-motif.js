/**
 * 🤖 AI Motif Dönüşümü — Dual Model Fallback
 * 
 * Strateji:
 *  1. gemini-3-pro-image → native image gen (en iyi sonuç)
 *  2. gemini-2.5-flash → SVG motif kodu → base64 PNG'ye çevir (fallback)
 * 
 * OpenAI-compatible multimodal API endpoint kullanır.
 */

const API_URL = process.env.AI_API_URL || 'https://antigravity2.mindops.net/v1/chat/completions';
const API_KEY = process.env.AI_API_KEY || 'sk-antigravity-lejyon-2026';
const PRIMARY_MODEL = 'gemini-3-pro-image';
const FALLBACK_MODEL = 'gemini-2.5-flash';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 15000;
const REQUEST_TIMEOUT_MS = 180000;

// AI motif dönüşüm durumu
let activeRequests = 0;
const MAX_CONCURRENT = 2;
const pendingQueue = [];

// 🎨 Image gen prompt'u (gemini-3-pro-image)
const IMAGE_PROMPT = `You are a master traditional Anatolian carpet/kilim motif designer.

I will give you a freehand drawing made by a visitor. Transform it into a beautiful traditional Anatolian kilim motif.

Rules:
1. PRESERVE the general SHAPE and COLOR PALETTE of the original drawing
2. Add geometric symmetry (center symmetry, 4-fold or 8-fold)
3. Straighten edges, sharpen lines into clean geometric shapes
4. Use traditional kilim motif language: ram's horn (koçboynuzu), hands-on-hips (elibelinde), stars, eye motifs, tree of life
5. Keep the background TRANSPARENT or very light cream (#f5f0e8)
6. Output must be SQUARE format
7. Use vibrant, carpet-appropriate tones of the original colors
8. Make it look like a hand-woven carpet detail, with visible thread texture

Generate ONLY the image, no text.`;

// 🎨 SVG fallback prompt'u (gemini-2.5-flash) — kısa SVG için optimize edildi
const SVG_PROMPT = `Generate a simple 256x256 SVG of a traditional Anatolian kilim motif.

IMPORTANT: Keep it SIMPLE - use basic shapes only (rect, polygon, circle, line). Maximum 30 elements.

Colors: #c41e3a (red), #1a3a6b (blue), #c8a951 (gold), #f5f0e8 (cream bg), #2d5a27 (green).

Include: central diamond, corner triangles, geometric border pattern.

Output ONLY raw SVG code. Start with <svg, end with </svg>. No markdown, no text.`;

/**
 * Serbest çizimi AI ile kilim motifine dönüştürür
 */
export async function transformToMotif(base64DataUrl) {
    if (activeRequests >= MAX_CONCURRENT) {
        return new Promise((resolve) => {
            pendingQueue.push({ base64DataUrl, resolve });
            console.log(`🤖 AI kuyruğa eklendi. Kuyruk: ${pendingQueue.length}`);
        });
    }

    activeRequests++;
    console.log(`🤖 AI motif dönüşümü başlıyor... (aktif: ${activeRequests})`);

    try {
        // Strateji 1: gemini-3-pro-image ile native image gen
        const imageResult = await tryImageGeneration(base64DataUrl);
        if (imageResult) return imageResult;

        // Strateji 2: gemini-2.5-flash ile SVG fallback
        console.log('🔄 Fallback: SVG motif oluşturma...');
        const svgResult = await trySVGGeneration();
        if (svgResult) return svgResult;

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
 * Strateji 1: Native image generation (gemini-3-pro-image)
 */
async function tryImageGeneration(base64DataUrl) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await callAPI(PRIMARY_MODEL, [
                { type: 'text', text: IMAGE_PROMPT },
                { type: 'image_url', image_url: { url: base64DataUrl } }
            ]);

            // Response'dan base64 image çıkar
            const match = result.match(/data:image\/(jpeg|png);base64,([A-Za-z0-9+/=\n]+)/);
            if (match) {
                const mimeType = match[1];
                const base64 = match[2].replace(/\n/g, '');
                console.log(`✅ Image gen başarılı! (${mimeType}, ${Math.round(base64.length / 1024)} KB)`);
                return `data:image/${mimeType};base64,${base64}`;
            }
            console.warn('⚠️ Image gen yanıtında resim yok');
            return null;
        } catch (err) {
            if ((err.status === 503 || err.status === 429) && attempt < MAX_RETRIES) {
                const delay = RETRY_DELAY_MS * attempt;
                console.log(`⏳ Image gen retry ${attempt}/${MAX_RETRIES} — ${delay / 1000}s... (${err.message})`);
                await sleep(delay);
                continue;
            }
            console.log(`⚠️ Image gen başarısız: ${err.message}`);
            return null; // Fallback'e geç
        }
    }
    return null;
}

/**
 * Strateji 2: SVG tabanlı motif (gemini-2.5-flash) → base64 PNG
 */
async function trySVGGeneration() {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await callAPI(FALLBACK_MODEL, [
                { type: 'text', text: SVG_PROMPT }
            ]);

            // SVG kodu çıkar
            let svg = result;
            console.log(`🔍 SVG yanıtı (ilk 300): ${svg.substring(0, 300)}`);
            // Markdown fence varsa temizle
            svg = svg.replace(/```(?:xml|svg|html)?\n?/g, '').replace(/```/g, '').trim();

            // SVG tag kontrolü
            let svgMatch = svg.match(/<svg[\s\S]*<\/svg>/i);
            // Eğer </svg> yoksa ama <svg var ise, kapatma tag'ı ekle
            if (!svgMatch && svg.includes('<svg')) {
                console.log('⚠️ SVG kapanış tagı eksik, ekleniyor...');
                svg = svg + '</svg>';
                svgMatch = svg.match(/<svg[\s\S]*<\/svg>/i);
            }
            if (!svgMatch) {
                console.warn('⚠️ SVG yanıtında <svg> tag bulunamadı. Tam yanıt uzunluğu:', svg.length);
                if (attempt < MAX_RETRIES) continue;
                return null;
            }

            svg = svgMatch[0];
            console.log(`✅ SVG motif oluşturuldu! (${svg.length} byte)`);

            // SVG → base64 data URL
            const base64Svg = Buffer.from(svg).toString('base64');
            return `data:image/svg+xml;base64,${base64Svg}`;
        } catch (err) {
            if ((err.status === 503 || err.status === 429) && attempt < MAX_RETRIES) {
                const delay = 5000 * attempt;
                console.log(`⏳ SVG retry ${attempt}/${MAX_RETRIES} — ${delay / 1000}s... (${err.message})`);
                await sleep(delay);
                continue;
            }
            console.error(`❌ SVG gen başarısız: ${err.message}`);
            return null;
        }
    }
    return null;
}

/**
 * Generic API çağrısı
 */
async function callAPI(model, content) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content }],
                max_tokens: 16384
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            const err = new Error(errText.substring(0, 200) || `HTTP ${response.status}`);
            err.status = response.status;
            throw err;
        }

        const data = await response.json();
        if (!data.choices?.[0]?.message?.content) {
            throw new Error('Geçersiz API yanıtı');
        }
        return data.choices[0].message.content;
    } finally {
        clearTimeout(timeout);
    }
}

export function getAIStatus() {
    return {
        activeRequests,
        queueLength: pendingQueue.length,
        maxConcurrent: MAX_CONCURRENT
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
