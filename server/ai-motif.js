/**
 * 🤖 AI Motif Stilizasyonu — Çizimi KORUYARAK güzelleştirme
 * 
 * TEMEL FELSEFe: Kullanıcının çizimini YERİNE KOYMAK DEĞİL,
 * üzerine kilim estetiği KATMAK. Orijinal şekil ve anlam KORUNMALI.
 * 
 * Strateji:
 *  1. gemini-3-pro-image → orijinali güzelleştir (en iyi)
 *  2. gpt-image-1 → orijinali güzelleştir (ikinci)
 *  3. gemini-2.5-flash → SVG border/frame overlay (fallback)
 * 
 * Client-side'da orijinal çizim HER ZAMAN %70+ korunur,
 * AI sonucu sadece enhancement layer olarak uygulanır.
 */

const API_URL = process.env.AI_API_URL || 'https://antigravity2.mindops.net/v1/chat/completions';
const API_KEY = process.env.AI_API_KEY || 'sk-antigravity-lejyon-2026';
const PRIMARY_MODEL = 'gemini-3-pro-image';
const SECONDARY_MODEL = 'gpt-image-1';
const FALLBACK_MODEL = 'gemini-2.5-flash';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 12000;
const REQUEST_TIMEOUT_MS = 180000;

let activeRequests = 0;
const MAX_CONCURRENT = 2;
const pendingQueue = [];

// 🎨 IMAGE ENHANCEMENT prompt — "REPLACE DEĞİL, ENHANCE"
const IMAGE_PROMPT = `You are enhancing a freehand drawing for a digital carpet weaving installation.

LOOK at the attached drawing carefully. Your job is to ENHANCE it, NOT replace it.

ABSOLUTE RULES — VIOLATION = FAILURE:
1. The OUTPUT must look 80%+ IDENTICAL to the INPUT drawing
2. SAME shapes, SAME colors, SAME composition, SAME meaning
3. DO NOT add new major shapes or figures that weren't in the original
4. DO NOT change what the drawing represents

ALLOWED enhancements (subtle only):
- Smooth out jagged brush strokes slightly
- Enrich colors: make reds deeper, blues richer, but keep the SAME hue
- Add a tiny decorative border frame (2-3px) around the edges in kilim style
- Add very subtle woven texture overlay (like fine fabric grain)
- Slightly sharpen edges for clarity

FORBIDDEN:
- Creating a new image from scratch
- Adding geometric kilim motifs that weren't drawn
- Replacing the drawing with traditional patterns
- Changing the subject matter or composition
- Making it look like a DIFFERENT drawing

Think of yourself as a skilled craftsperson who takes the visitor's exact drawing 
and carefully weaves it into fabric — the image stays the same, 
only the MEDIUM changes (from digital to woven).

Background should remain transparent where the original had transparency.
Output SQUARE format.
Generate ONLY the image.`;

// 🎨 SVG BORDER-ONLY fallback — sadece çerçeve ve dekoratif kenar üretir
const SVG_BORDER_PROMPT = `Look at this freehand drawing. Create a 256x256 SVG that serves as a DECORATIVE BORDER FRAME for this drawing.

CRITICAL: You are NOT recreating the drawing. You are creating ONLY a border/frame to go AROUND it.

The SVG should contain:
1. A decorative kilim-style border frame (geometric patterns along the 4 edges)
2. Corner decorations (small traditional motifs at 4 corners)
3. The CENTER must be EMPTY/TRANSPARENT — the original drawing will be placed there
4. Use colors that complement the drawing: earthy reds, blues, golds, creams

Use basic SVG shapes. Maximum 30 elements.
Colors: #c41e3a (red), #1a3a6b (blue), #c8a951 (gold), #f5f0e8 (cream), #2d5a27 (green).

The border should be about 8-12px thick on each side.

Output ONLY raw SVG code. Start with <svg, end with </svg>. No markdown, no explanation.`;

/**
 * Çizimi AI ile ENHANCE eder (replace değil!)
 */
export async function transformToMotif(base64DataUrl) {
    if (activeRequests >= MAX_CONCURRENT) {
        return new Promise((resolve) => {
            pendingQueue.push({ base64DataUrl, resolve });
            console.log(`🤖 AI kuyruğa eklendi. Kuyruk: ${pendingQueue.length}`);
        });
    }

    activeRequests++;
    console.log(`🤖 AI enhancement başlıyor... (aktif: ${activeRequests})`);

    try {
        // Strateji 1: gemini-3-pro-image ile enhance
        const imageResult = await tryImageGeneration(base64DataUrl, PRIMARY_MODEL);
        if (imageResult) return imageResult;

        // Strateji 2: gpt-image-1 ile enhance
        console.log('🔄 Fallback 1: gpt-image-1 deneniyor...');
        const openaiResult = await tryImageGeneration(base64DataUrl, SECONDARY_MODEL);
        if (openaiResult) return openaiResult;

        // Strateji 3: SVG border frame (çizimin etrafına kilim çerçevesi)
        console.log('🔄 Fallback 2: SVG border frame oluşturma...');
        const svgResult = await trySVGBorderGeneration(base64DataUrl);
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
 * Image enhancement (orijinali koruyarak güzelleştirme)
 */
async function tryImageGeneration(base64DataUrl, model) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await callAPI(model, [
                { type: 'text', text: IMAGE_PROMPT },
                { type: 'image_url', image_url: { url: base64DataUrl } }
            ]);

            const match = result.match(/data:image\/(jpeg|png);base64,([A-Za-z0-9+/=\n]+)/);
            if (match) {
                const mimeType = match[1];
                const base64 = match[2].replace(/\n/g, '');
                console.log(`✅ ${model} enhancement başarılı! (${mimeType}, ${Math.round(base64.length / 1024)} KB)`);
                return `data:image/${mimeType};base64,${base64}`;
            }
            console.warn(`⚠️ ${model} yanıtında resim yok`);
            return null;
        } catch (err) {
            if ((err.status === 503 || err.status === 429) && attempt < MAX_RETRIES) {
                const delay = RETRY_DELAY_MS * attempt;
                console.log(`⏳ ${model} retry ${attempt}/${MAX_RETRIES} — ${delay / 1000}s... (${err.message})`);
                await sleep(delay);
                continue;
            }
            console.log(`⚠️ ${model} başarısız: ${err.message}`);
            return null;
        }
    }
    return null;
}

/**
 * SVG BORDER frame — çizimin etrafına dekoratif kilim çerçevesi
 */
async function trySVGBorderGeneration(base64DataUrl) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await callAPI(FALLBACK_MODEL, [
                { type: 'text', text: SVG_BORDER_PROMPT },
                { type: 'image_url', image_url: { url: base64DataUrl } }
            ]);

            let svg = result;
            console.log(`🔍 SVG border yanıtı (ilk 300): ${svg.substring(0, 300)}`);
            svg = svg.replace(/```(?:xml|svg|html)?\n?/g, '').replace(/```/g, '').trim();

            let svgMatch = svg.match(/<svg[\s\S]*<\/svg>/i);
            if (!svgMatch && svg.includes('<svg')) {
                svg = svg + '</svg>';
                svgMatch = svg.match(/<svg[\s\S]*<\/svg>/i);
            }
            if (!svgMatch) {
                console.warn('⚠️ SVG border yanıtında <svg> tag bulunamadı.');
                if (attempt < MAX_RETRIES) continue;
                return null;
            }

            svg = svgMatch[0];
            console.log(`✅ SVG border oluşturuldu! (${svg.length} byte)`);

            const base64Svg = Buffer.from(svg).toString('base64');
            return `data:image/svg+xml;base64,${base64Svg}`;
        } catch (err) {
            if ((err.status === 503 || err.status === 429) && attempt < MAX_RETRIES) {
                const delay = 5000 * attempt;
                console.log(`⏳ SVG retry ${attempt}/${MAX_RETRIES} — ${delay / 1000}s... (${err.message})`);
                await sleep(delay);
                continue;
            }
            console.error(`❌ SVG border gen başarısız: ${err.message}`);
            return null;
        }
    }
    return null;
}

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
