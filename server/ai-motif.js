/**
 * 🤖 AI Motif Dönüşümü v3 — Antigravity Gateway + Gemini Image Generation
 * 
 * Pipeline:
 *  1. Kullanıcının çizimini analiz et (gemini-3-flash — ne çizilmiş?)
 *  2. Analiz sonucuna göre kilim motifi üret (gemini-3-pro-image-1x1)
 *  3. Üretilen görseli base64 data URL olarak döndür
 * 
 * Gateway: antigravity2.mindops.net (OpenAI-compatible)
 * Image Model: gemini-3-pro-image-1x1
 */

const API_URL = process.env.AI_API_URL || 'https://antigravity2.mindops.net/v1/chat/completions';
const API_KEY = process.env.AI_API_KEY || 'sk-antigravity-lejyon-2026';

// Analiz modeli (hızlı, ucuz — çizimi tanımla)
const ANALYSIS_MODEL = 'gemini-3-flash';
// Image generation modeli
const IMAGE_MODEL = 'gemini-3-pro-image-1x1';

// Rate limiting
let activeRequests = 0;
const MAX_CONCURRENT = 2;
const pendingQueue = [];

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
        // ADIM 1: Çizimi analiz et — ne çizilmiş, ana renk ne?
        const analysis = await analyzeDrawing(base64DataUrl);
        console.log(`🔍 Analiz: ${analysis}`);

        // ADIM 2: Kilim motifi üret
        const motifDataUrl = await generateKilimMotif(analysis);

        if (motifDataUrl) {
            console.log(`✅ AI kilim motifi başarılı!`);
        }
        return motifDataUrl;
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
 * ADIM 1: Çizimi analiz et — ne çizilmiş, ana renk ne?
 */
async function analyzeDrawing(base64DataUrl) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: ANALYSIS_MODEL,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `Bu çizime bak ve şu bilgileri ver:
1. Ne çizilmiş? (tek kelime: kedi, çiçek, yıldız, kalp, kuş, vb.)
2. Ana renk ne? (kırmızı, mavi, yeşil, vb.)

SADECE şu formatta yanıt ver, başka hiçbir şey yazma:
KONU: [ne çizilmiş]
RENK: [ana renk]`
                        },
                        {
                            type: 'image_url',
                            image_url: { url: base64DataUrl }
                        }
                    ]
                }],
                max_tokens: 50,
                temperature: 0.1
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error('❌ Analiz hatası:', data.error.message || JSON.stringify(data.error));
            return 'KONU: desen\nRENK: kırmızı';
        }

        const content = data.choices?.[0]?.message?.content || 'KONU: desen\nRENK: kırmızı';
        return content.trim();
    } catch (err) {
        console.error('❌ Analiz API hatası:', err.message);
        return 'KONU: desen\nRENK: kırmızı';
    }
}

/**
 * ADIM 2: Analiz sonucuna göre kilim motifi üret
 */
async function generateKilimMotif(analysis) {
    // Analizi parse et
    let subject = 'geometric pattern';
    let color = 'red';

    const subjectMatch = analysis.match(/KONU:\s*(.+)/i);
    const colorMatch = analysis.match(/RENK:\s*(.+)/i);

    if (subjectMatch) subject = subjectMatch[1].trim();
    if (colorMatch) color = colorMatch[1].trim();

    console.log(`🎨 Motif üretiliyor: konu="${subject}", renk="${color}"`);

    const prompt = `Create a traditional Anatolian Turkish kilim carpet motif of a "${subject}".

STYLE RULES:
- Pure geometric kilim style with diamonds, triangles, zigzag patterns
- Main color: ${color} tones mixed with traditional kilim colors (deep red, navy blue, gold, cream, dark brown)
- White/cream background
- The "${subject}" should be clearly recognizable but rendered in geometric kilim style
- Add a decorative kilim border frame with repeating geometric patterns
- Flat textile-like coloring, NO gradients, NO photorealistic effects
- Should look like a real hand-woven carpet section
- Clean, symmetrical, warm handcrafted feel
- Square format, centered composition`;

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
                    content: prompt
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

        // Veya doğrudan base64 olabilir
        if (content.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(content.trim())) {
            console.log(`✅ Kilim motifi üretildi (raw base64)! (${Math.round(content.length / 1024)}KB)`);
            return `data:image/jpeg;base64,${content.trim()}`;
        }

        console.warn('⚠️ Yanıtta görsel bulunamadı. Content:', content.substring(0, 200));
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
        analysisModel: ANALYSIS_MODEL,
        imageModel: IMAGE_MODEL
    };
}
