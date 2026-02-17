/**
 * 🤖 AI Motif Dönüşümü v2 — Gemini Native Image Generation
 * 
 * Pipeline:
 *  1. Kullanıcının çizimini Gemini'ye gönder (img2img)
 *  2. "Bu çizimi Anadolu kilim motifine dönüştür" prompt'u ile
 *  3. Gemini orijinal şekli koruyarak kilim tarzında yeni görsel üretir
 *  4. Üretilen görseli base64 data URL olarak döndür
 * 
 * Model: gemini-2.5-flash (image generation destekli)
 * SDK: @google/genai
 */

import { GoogleGenAI } from '@google/genai';

// API yapılandırma
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const IMAGE_MODEL = 'gemini-2.5-flash-image'; // Nano Banana — image generation destekli

// Rate limiting
let activeRequests = 0;
const MAX_CONCURRENT = 2;
const pendingQueue = [];

// Kilim dönüşüm prompt'u — orijinal şekli koruyarak kilim motifine çevirir
const KILIM_TRANSFORM_PROMPT = `You are a master Turkish kilim carpet designer. Transform this freehand drawing into a traditional Anatolian kilim carpet motif.

CRITICAL RULES:
1. PRESERVE the original drawing's shape and composition — do NOT create a completely different design
2. Convert the drawing into geometric kilim style: use diamonds, triangles, zigzag patterns
3. Make the main subject clearly recognizable as what was drawn
4. Apply traditional Turkish kilim color palette: deep reds (#8B0000, #C41E3A), navy blue (#1A1A70), gold (#C8A951), cream (#F5F0E8), dark brown (#3D2B1F), forest green (#006400)
5. Add a decorative kilim border frame around the design with repeating geometric patterns
6. The entire image should look like it was woven on a real carpet loom
7. Fill the background with cream/natural wool color
8. Use flat, textile-like coloring — no gradients, no photorealistic effects
9. Output should be 512x512 pixels
10. Make it warm, handcrafted, and authentically Turkish

The result should look like a real hand-woven Anatolian kilim section with the drawn subject as the central motif.`;

/**
 * Ana motif dönüşüm pipeline'ı
 * @param {string} base64DataUrl - Çizimin data URL'i (data:image/png;base64,...)
 * @returns {string|null} - Dönüştürülmüş görselin data URL'i
 */
export async function transformToMotif(base64DataUrl) {
    if (!GEMINI_API_KEY) {
        console.warn('⚠️ GEMINI_API_KEY ayarlanmamış! AI motif devre dışı.');
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
        const result = await generateKilimMotif(base64DataUrl);
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
 * Gemini native image generation ile kilim motifine dönüştürme
 */
async function generateKilimMotif(base64DataUrl) {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // data:image/png;base64, prefix'ini çıkar
    let base64Data = base64DataUrl;
    let mimeType = 'image/png';

    const dataUrlMatch = base64DataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
        mimeType = dataUrlMatch[1];
        base64Data = dataUrlMatch[2];
    }

    console.log(`🖼️ Çizim boyutu: ${Math.round(base64Data.length / 1024)}KB, format: ${mimeType}`);

    try {
        const response = await ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: KILIM_TRANSFORM_PROMPT },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Data,
                            }
                        }
                    ]
                }
            ],
            config: {
                responseModalities: ['IMAGE', 'TEXT'],
            }
        });

        // Response'dan image part'ını bul
        if (!response.candidates?.[0]?.content?.parts) {
            console.warn('⚠️ Gemini yanıtında part yok');
            return null;
        }

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const imgBase64 = part.inlineData.data;
                const imgMime = part.inlineData.mimeType || 'image/png';
                console.log(`✅ AI kilim motifi üretildi! (${Math.round(imgBase64.length / 1024)}KB)`);
                return `data:${imgMime};base64,${imgBase64}`;
            }
            if (part.text) {
                console.log(`📝 Gemini metin yanıtı: ${part.text.substring(0, 100)}`);
            }
        }

        console.warn('⚠️ Gemini yanıtında görsel yok — sadece metin döndü');
        return null;

    } catch (err) {
        if (err.status === 429) {
            console.warn('⏳ Rate limit — 5s bekliyor...');
            await sleep(5000);
            return generateKilimMotif(base64DataUrl); // Retry
        }
        if (err.message?.includes('SAFETY')) {
            console.warn('⚠️ Safety filter tetiklendi — fallback yok');
            return null;
        }
        throw err;
    }
}

export function getAIStatus() {
    return {
        activeRequests,
        queueLength: pendingQueue.length,
        maxConcurrent: MAX_CONCURRENT,
        hasApiKey: !!GEMINI_API_KEY,
        model: IMAGE_MODEL
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
