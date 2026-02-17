/**
 * 🤖 AI Motif Dönüşümü — Gemini 3 Pro Image
 * 
 * Kullanıcının serbest çizimini geleneksel Anadolu kilim motifine dönüştürür.
 * OpenAI-compatible multimodal API endpoint kullanır.
 */

const API_URL = process.env.AI_API_URL || 'https://antigravity2.mindops.net/v1/chat/completions';
const API_KEY = process.env.AI_API_KEY || 'sk-antigravity-lejyon-2026';
const MODEL = process.env.AI_MODEL || 'gemini-3-pro-image-1x1';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 12000; // 12 saniye (503 retryDelay ~10-40s)
const REQUEST_TIMEOUT_MS = 120000; // 120 saniye

// AI motif dönüşüm durumu
let activeRequests = 0;
const MAX_CONCURRENT = 2;
const pendingQueue = [];

// 🎨 Dönüşüm prompt'u
const MOTIF_PROMPT = `You are a master traditional Anatolian carpet/kilim motif designer.

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

/**
 * Serbest çizimi AI ile kilim motifine dönüştürür
 * @param {string} base64DataUrl - "data:image/png;base64,..." formatında çizim
 * @returns {Promise<string|null>} AI motif base64 dataUrl veya null (hata durumunda)
 */
export async function transformToMotif(base64DataUrl) {
    // Kuyruk kontrolü — max eşzamanlı istek sınırı
    if (activeRequests >= MAX_CONCURRENT) {
        return new Promise((resolve) => {
            pendingQueue.push({ base64DataUrl, resolve });
            console.log(`🤖 AI kuyruğa eklendi. Kuyruk: ${pendingQueue.length}`);
        });
    }

    activeRequests++;
    console.log(`🤖 AI motif dönüşümü başlıyor... (aktif: ${activeRequests})`);

    try {
        const result = await callGeminiWithRetry(base64DataUrl);
        return result;
    } finally {
        activeRequests--;
        // Kuyruktan sonrakini işle
        if (pendingQueue.length > 0) {
            const next = pendingQueue.shift();
            console.log(`🤖 Kuyruktan sonraki işleniyor. Kalan: ${pendingQueue.length}`);
            transformToMotif(next.base64DataUrl).then(next.resolve);
        }
    }
}

/**
 * Retry logic ile Gemini API çağrısı
 */
async function callGeminiWithRetry(base64DataUrl, attempt = 1) {
    try {
        const result = await callGeminiAPI(base64DataUrl);
        return result;
    } catch (err) {
        if (attempt < MAX_RETRIES && (err.status === 503 || err.status === 429)) {
            const delay = RETRY_DELAY_MS * attempt;
            console.log(`⏳ AI retry ${attempt}/${MAX_RETRIES} — ${delay / 1000}s bekleniyor... (${err.message})`);
            await sleep(delay);
            return callGeminiWithRetry(base64DataUrl, attempt + 1);
        }
        console.error(`❌ AI motif hatası (attempt ${attempt}):`, err.message);
        return null;
    }
}

/**
 * Gemini API çağrısı — Multimodal (text + image)
 */
async function callGeminiAPI(base64DataUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const body = {
            model: MODEL,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: MOTIF_PROMPT },
                        {
                            type: 'image_url',
                            image_url: { url: base64DataUrl }
                        }
                    ]
                }
            ],
            max_tokens: 8192
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            signal: controller.signal
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const err = new Error(errData?.error?.message || `HTTP ${response.status}`);
            err.status = response.status;
            throw err;
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0]?.message?.content) {
            throw new Error('Geçersiz API yanıtı — choices bulunamadı');
        }

        const content = data.choices[0].message.content;

        // Response'dan base64 image çıkar
        // Format: "![image](data:image/jpeg;base64,...)"
        const match = content.match(/data:image\/(jpeg|png);base64,([A-Za-z0-9+/=\n]+)/);
        if (!match) {
            console.warn('⚠️ AI yanıtında resim bulunamadı. İlk 200 karakter:', content.substring(0, 200));
            throw new Error('AI yanıtında base64 image bulunamadı');
        }

        const mimeType = match[1];
        const base64 = match[2].replace(/\n/g, '');
        const dataUrl = `data:image/${mimeType};base64,${base64}`;

        console.log(`✅ AI motif oluşturuldu! (${mimeType}, ${Math.round(base64.length / 1024)} KB base64)`);

        return dataUrl;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * AI durumu
 */
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
