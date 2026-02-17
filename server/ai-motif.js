/**
 * 🤖 AI Motif Stilizasyonu — Çizimi PROFESYONELKİLİM MOTİFİNE dönüştürme
 * 
 * YENİ STRATEJİ (v4.5+):
 *  1. gemini-2.5-flash ile çizimi ANALIZ et (ne çizilmiş?)
 *  2. Aynı modelle O ŞEKLİN kilim motifi versiyonunu SVG olarak üret
 *  3. SVG'yi client'a gönder → çizimin üzerine blend
 * 
 * Image generation modelleri (gemini-3-pro-image) 503 verdiğinden
 * metin tabanlı SVG üretim yaklaşımı kullanılıyor.
 */

const API_URL = process.env.AI_API_URL || 'https://antigravity2.mindops.net/v1/chat/completions';
const API_KEY = process.env.AI_API_KEY || 'sk-antigravity-lejyon-2026';
const MOTIF_MODEL = 'gemini-2.5-flash';

const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 60000;

let activeRequests = 0;
const MAX_CONCURRENT = 3;
const pendingQueue = [];

// ─────────────────────────────────────────────────────────────
// 🔍 STEP 1: Çizimin ne olduğunu analiz et
// ─────────────────────────────────────────────────────────────
const ANALYZE_PROMPT = `Look at this freehand drawing from a child or visitor at an interactive carpet weaving exhibition.

Identify what the drawing represents in 1-3 words. Examples: "sun", "flower", "heart", "star", "house", "tree", "cat", "butterfly", "fish", "rainbow".

Also identify the PRIMARY COLOR used (e.g. "yellow", "red", "blue").

Respond in EXACTLY this format, nothing else:
SUBJECT: [1-3 words]
COLOR: [primary color]`;

// ─────────────────────────────────────────────────────────────
// 🧶 STEP 2: O şeklin kilim motifi SVG versiyonunu üret
// ─────────────────────────────────────────────────────────────
function getMotifPrompt(subject, primaryColor) {
    return `Create a 256x256 SVG of a "${subject}" designed as a traditional Anatolian kilim carpet motif.

STYLE REQUIREMENTS:
- Pure GEOMETRIC kilim style — the "${subject}" must be rendered using only triangles, diamonds, rectangles, zigzag lines
- NO curves, NO circles, NO smooth shapes — everything angular and geometric like a real woven pattern
- The motif should be IMMEDIATELY RECOGNIZABLE as "${subject}" even in geometric style
- Use bilateral symmetry (mirror left↔right)
- Fill the entire 256x256 area — no empty space

COLOR PALETTE (use these kilim colors, primary should be ${primaryColor}):
- ${primaryColor === 'yellow' ? '#c8a951' : primaryColor === 'red' ? '#c41e3a' : primaryColor === 'blue' ? '#1a3a6b' : primaryColor === 'green' ? '#2d5a27' : '#c8a951'} (main motif)
- #f5f0e8 (cream background)
- #5c1a0a (dark border accents)
- #c41e3a (red accents)
- #1a3a6b (blue details)
- #c8a951 (gold highlights)
- #2d5a27 (green if needed)

COMPOSITION:
- Center the "${subject}" motif large (80% of the area)
- Add a 10px geometric border with small diamond patterns
- Small corner decorations (elibelinde/hands-on-hips triangles)
- Background: cream #f5f0e8

TECHNICAL:
- Output ONLY raw SVG code. Start with <svg, end with </svg>
- Use <polygon>, <rect>, <path> with L/M/Z commands only (no curves)
- Maximum 60 SVG elements
- viewBox="0 0 256 256"
- No text, no comments

Here are examples of kilim motif patterns:
- Sun: large central diamond surrounded by 8 triangular rays, border of small diamonds
- Flower: central hexagon with 6 diamond petals, zigzag stem
- Heart: two triangles forming an inverted V, filled with smaller diamonds
- Star: overlapping triangles forming 6/8 pointed star
- Cat: geometric triangular face, pointed triangle ears, diamond eyes
- Tree: stacked triangles getting smaller upward (pine tree shape)

Generate the SVG now.`;
}

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
        // STEP 1: Çizimi analiz et
        let subject = 'abstract motif';
        let primaryColor = 'red';

        try {
            const analysis = await callAPI(MOTIF_MODEL, [
                { type: 'text', text: ANALYZE_PROMPT },
                { type: 'image_url', image_url: { url: base64DataUrl } }
            ], 200);

            const subjectMatch = analysis.match(/SUBJECT:\s*(.+)/i);
            const colorMatch = analysis.match(/COLOR:\s*(.+)/i);

            if (subjectMatch) subject = subjectMatch[1].trim().toLowerCase();
            if (colorMatch) primaryColor = colorMatch[1].trim().toLowerCase();

            console.log(`🔍 Çizim analizi: "${subject}" (renk: ${primaryColor})`);
        } catch (err) {
            console.warn(`⚠️ Analiz başarısız, varsayılan kullanılıyor: ${err.message}`);
        }

        // STEP 2: Kilim motifi SVG üret
        const motifSvg = await generateMotifSVG(subject, primaryColor);
        if (motifSvg) {
            console.log(`✅ Kilim motifi SVG hazır: "${subject}" (${motifSvg.length} byte)`);
            const base64Svg = Buffer.from(motifSvg).toString('base64');
            return `data:image/svg+xml;base64,${base64Svg}`;
        }

        // STEP 3: Fallback — basit geometrik motif
        console.log('🔄 SVG gen başarısız, fallback geometrik motif...');
        const fallbackSvg = generateFallbackMotif(subject, primaryColor);
        const base64Fallback = Buffer.from(fallbackSvg).toString('base64');
        return `data:image/svg+xml;base64,${base64Fallback}`;

    } finally {
        activeRequests--;
        if (pendingQueue.length > 0) {
            const next = pendingQueue.shift();
            transformToMotif(next.base64DataUrl).then(next.resolve);
        }
    }
}

/**
 * Gemini ile kilim motifi SVG üretimi
 */
async function generateMotifSVG(subject, primaryColor) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const prompt = getMotifPrompt(subject, primaryColor);
            const result = await callAPI(MOTIF_MODEL, [
                { type: 'text', text: prompt }
            ], 16384);

            let svg = result;
            svg = svg.replace(/```(?:xml|svg|html)?\n?/g, '').replace(/```/g, '').trim();

            let svgMatch = svg.match(/<svg[\s\S]*<\/svg>/i);
            if (!svgMatch && svg.includes('<svg')) {
                svg = svg + '</svg>';
                svgMatch = svg.match(/<svg[\s\S]*<\/svg>/i);
            }
            if (!svgMatch) {
                console.warn(`⚠️ SVG motif yanıtında <svg> tag bulunamadı (attempt ${attempt})`);
                if (attempt < MAX_RETRIES) continue;
                return null;
            }

            svg = svgMatch[0];
            // viewBox yoksa ekle
            if (!svg.includes('viewBox')) {
                svg = svg.replace('<svg', '<svg viewBox="0 0 256 256"');
            }
            // width/height yoksa ekle
            if (!svg.includes('width=')) {
                svg = svg.replace('<svg', '<svg width="256" height="256"');
            }

            console.log(`✅ SVG motif oluşturuldu! ("${subject}", ${svg.length} byte)`);
            return svg;
        } catch (err) {
            if ((err.status === 503 || err.status === 429) && attempt < MAX_RETRIES) {
                const delay = 5000 * attempt;
                console.log(`⏳ SVG retry ${attempt}/${MAX_RETRIES} — ${delay / 1000}s... (${err.message})`);
                await sleep(delay);
                continue;
            }
            console.error(`❌ SVG motif gen başarısız: ${err.message}`);
            return null;
        }
    }
    return null;
}

/**
 * Fallback: Basit geometrik motif (AI olmadan)
 */
function generateFallbackMotif(subject, primaryColor) {
    const colors = {
        main: primaryColor === 'yellow' ? '#c8a951' : primaryColor === 'red' ? '#c41e3a' :
            primaryColor === 'blue' ? '#1a3a6b' : primaryColor === 'green' ? '#2d5a27' : '#c41e3a',
        bg: '#f5f0e8',
        accent: '#c41e3a',
        gold: '#c8a951',
        dark: '#5c1a0a',
        blue: '#1a3a6b'
    };

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
    <!-- Cream background -->
    <rect width="256" height="256" fill="${colors.bg}"/>
    <!-- Outer border -->
    <rect x="2" y="2" width="252" height="252" fill="none" stroke="${colors.dark}" stroke-width="8"/>
    <!-- Inner border -->
    <rect x="12" y="12" width="232" height="232" fill="none" stroke="${colors.gold}" stroke-width="3"/>
    <rect x="18" y="18" width="220" height="220" fill="none" stroke="${colors.blue}" stroke-width="1.5"/>
    <!-- Central diamond motif -->
    <polygon points="128,35 220,128 128,221 36,128" fill="${colors.main}" opacity="0.8"/>
    <polygon points="128,55 200,128 128,201 56,128" fill="${colors.bg}"/>
    <polygon points="128,70 185,128 128,186 71,128" fill="${colors.main}" opacity="0.6"/>
    <polygon points="128,90 165,128 128,166 91,128" fill="${colors.accent}"/>
    <polygon points="128,105 150,128 128,151 106,128" fill="${colors.gold}"/>
    <!-- Corner diamonds -->
    <polygon points="25,25 40,15 55,25 40,35" fill="${colors.accent}"/>
    <polygon points="201,25 216,15 231,25 216,35" fill="${colors.accent}"/>
    <polygon points="25,231 40,221 55,231 40,241" fill="${colors.accent}"/>
    <polygon points="201,231 216,221 231,231 216,241" fill="${colors.accent}"/>
    <!-- Edge triangles -->
    <polygon points="128,8 135,16 121,16" fill="${colors.gold}"/>
    <polygon points="128,248 135,240 121,240" fill="${colors.gold}"/>
    <polygon points="8,128 16,121 16,135" fill="${colors.gold}"/>
    <polygon points="248,128 240,121 240,135" fill="${colors.gold}"/>
    <!-- Side diamond accents -->
    <polygon points="80,8 88,16 80,24 72,16" fill="${colors.dark}"/>
    <polygon points="176,8 184,16 176,24 168,16" fill="${colors.dark}"/>
    <polygon points="80,248 88,240 80,232 72,240" fill="${colors.dark}"/>
    <polygon points="176,248 184,240 176,232 168,240" fill="${colors.dark}"/>
</svg>`;
}

async function callAPI(model, content, maxTokens = 8192) {
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
                max_tokens: maxTokens
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
