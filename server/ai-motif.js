/**
 * 🤖 AI Motif Stilizasyonu — Çizimi PROFESYONEL KİLİM MOTİFİNE dönüştürme
 * 
 * Pipeline:
 *  1. gemini-3-flash ile çizimi ANALIZ et (ne çizilmiş?)
 *  2. Aynı modelle O ŞEKLİN kilim motifi versiyonunu SVG olarak üret
 *  3. SVG'yi client'a gönder → çizimin üzerine blend
 */

const API_URL = process.env.AI_API_URL || 'https://antigravity2.mindops.net/v1/chat/completions';
const API_KEY = process.env.AI_API_KEY || 'sk-antigravity-lejyon-2026';
const MOTIF_MODEL = 'gemini-3-flash';

const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 90000; // 90s — SVG üretimi zaman alabilir

let activeRequests = 0;
const MAX_CONCURRENT = 3;
const pendingQueue = [];

// ─────────────────────────────────────────────────────────────
// 🔍 STEP 1: Çizimin ne olduğunu analiz et
// ─────────────────────────────────────────────────────────────
const ANALYZE_PROMPT = `Look at this freehand drawing. What is it? Reply EXACTLY in this format:
SUBJECT: [1-3 words, e.g. sun, flower, heart, star, house, tree, cat, butterfly]
COLOR: [primary color, e.g. yellow, red, blue, green, orange, purple]`;

// ─────────────────────────────────────────────────────────────
// 🧶 STEP 2: Kilim motifi SVG üretimi — KISA ve NET prompt
// ─────────────────────────────────────────────────────────────
function getMotifPrompt(subject, primaryColor) {
    // Subject-specific SVG şablonları
    const subjectGuides = {
        'sun': 'Central octagon or large diamond. 8 triangular rays pointing outward (N,NE,E,SE,S,SW,W,NW). Rays alternate gold and red.',
        'flower': 'Central small diamond. 6 diamond-shaped petals around it. Small triangular leaves below. Symmetric.',
        'heart': 'Two large triangles meeting at top forming V-shape, pointed bottom. Fill with smaller nested diamonds.',
        'star': '6-pointed or 8-pointed star made of overlapping triangles. Central diamond.',
        'house': 'Large triangle roof on top. Rectangle body below. Small diamond window. Triangular door.',
        'tree': 'Stack of 3-4 triangles getting smaller toward top (pine tree). Small rectangle trunk.',
        'cat': 'Triangular face pointing down. Two pointed triangle ears on top. Diamond eyes. Small triangle nose.',
        'butterfly': 'Two large triangles on each side (wings) with small diamonds inside. Thin rectangle body in center.',
        'fish': 'Large diamond body. Triangle tail on right. Small diamond eye on left side.',
        'rainbow': 'Concentric arcs made of zigzag lines in different colors. Semi-circle composition.',
        'moon': 'Large crescent shape made of two overlapping diamonds. Stars (small diamonds) around it.',
        'bird': 'Triangle body. Two triangle wings spread out. Small triangle beak. Diamond eye.',
    };

    const guide = subjectGuides[subject] || `Represent "${subject}" using only geometric shapes — diamonds, triangles, rectangles. Make it immediately recognizable.`;

    const colorMap = {
        'yellow': '#c8a951', 'red': '#c41e3a', 'blue': '#1a3a6b',
        'green': '#2d5a27', 'orange': '#e8a23e', 'purple': '#7b2d4f',
        'pink': '#c41e3a', 'brown': '#3d2b1f', 'black': '#1a1a2e',
        'white': '#f5f0e8'
    };
    const mainColor = colorMap[primaryColor] || '#c8a951';

    return `Create a 256x256 SVG kilim carpet motif of a "${subject}".

DESIGN: ${guide}

RULES:
- ONLY use <polygon>, <rect>, <circle> — NO curves, NO <path> with C/Q commands
- Bilateral symmetry (mirror left↔right)
- Fill the entire 256x256 area
- The "${subject}" must be CLEARLY RECOGNIZABLE
- Maximum 40 SVG elements
- viewBox="0 0 256 256"

COLORS:
- Main motif: ${mainColor}
- Background: #f5f0e8 (cream)
- Accent 1: #c41e3a (red)
- Accent 2: #1a3a6b (navy)
- Border: #5c1a0a (dark brown)
- Gold: #c8a951

BORDER: Add a 6px geometric border with small repeating diamonds.

Output ONLY the SVG code. Start with <svg, end with </svg>. No markdown, no text.`;
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
            console.warn(`⚠️ Analiz başarısız, varsayılan: ${err.message}`);
        }

        // STEP 2: Kilim motifi SVG üret
        const motifSvg = await generateMotifSVG(subject, primaryColor);
        if (motifSvg) {
            console.log(`✅ Kilim motifi SVG hazır: "${subject}" (${motifSvg.length} byte)`);
            const base64Svg = Buffer.from(motifSvg).toString('base64');
            return `data:image/svg+xml;base64,${base64Svg}`;
        }

        // STEP 3: Subject-specific fallback
        console.log(`🔄 SVG gen başarısız, fallback: "${subject}"...`);
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
 * gemini-3-flash ile kilim motifi SVG üretimi
 */
async function generateMotifSVG(subject, primaryColor) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const prompt = getMotifPrompt(subject, primaryColor);
            const result = await callAPI(MOTIF_MODEL, [
                { type: 'text', text: prompt }
            ], 8192);

            let svg = result;
            svg = svg.replace(/```(?:xml|svg|html)?\n?/g, '').replace(/```/g, '').trim();

            let svgMatch = svg.match(/<svg[\s\S]*<\/svg>/i);
            if (!svgMatch && svg.includes('<svg')) {
                svg = svg + '</svg>';
                svgMatch = svg.match(/<svg[\s\S]*<\/svg>/i);
            }
            if (!svgMatch) {
                console.warn(`⚠️ SVG yanıtında <svg> tag yok (attempt ${attempt})`);
                if (attempt < MAX_RETRIES) continue;
                return null;
            }

            svg = svgMatch[0];
            if (!svg.includes('viewBox')) {
                svg = svg.replace('<svg', '<svg viewBox="0 0 256 256"');
            }
            if (!svg.includes('width=')) {
                svg = svg.replace('<svg', '<svg width="256" height="256"');
            }

            console.log(`✅ SVG motif oluşturuldu! ("${subject}", ${svg.length} byte)`);
            return svg;
        } catch (err) {
            if ((err.status === 503 || err.status === 429) && attempt < MAX_RETRIES) {
                const delay = 5000 * attempt;
                console.log(`⏳ SVG retry ${attempt}/${MAX_RETRIES} — ${delay / 1000}s...`);
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
 * Subject-specific fallback motifler (AI olmadan)
 */
function generateFallbackMotif(subject, primaryColor) {
    const colorMap = {
        'yellow': '#c8a951', 'red': '#c41e3a', 'blue': '#1a3a6b',
        'green': '#2d5a27', 'orange': '#e8a23e', 'purple': '#7b2d4f'
    };
    const main = colorMap[primaryColor] || '#c8a951';

    // Subject'e göre farklı motifler
    if (subject.includes('sun') || subject.includes('güneş')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<rect width="256" height="256" fill="#f5f0e8"/>
<rect x="3" y="3" width="250" height="250" fill="none" stroke="#5c1a0a" stroke-width="6"/>
<rect x="10" y="10" width="236" height="236" fill="none" stroke="#c8a951" stroke-width="2"/>
<!-- Central sun octagon -->
<polygon points="128,60 168,80 188,120 188,136 168,176 128,196 88,176 68,136 68,120 88,80" fill="${main}"/>
<polygon points="128,80 155,95 168,120 168,136 155,161 128,176 101,161 88,136 88,120 101,95" fill="#e8a23e"/>
<polygon points="128,100 142,108 148,128 142,148 128,156 114,148 108,128 114,108" fill="#c41e3a"/>
<!-- 8 Rays -->
<polygon points="128,10 140,55 116,55" fill="${main}"/>
<polygon points="128,246 140,201 116,201" fill="${main}"/>
<polygon points="10,128 55,116 55,140" fill="${main}"/>
<polygon points="246,128 201,116 201,140" fill="${main}"/>
<polygon points="45,45 75,70 60,85" fill="${main}"/>
<polygon points="211,45 181,70 196,85" fill="${main}"/>
<polygon points="45,211 75,186 60,171" fill="${main}"/>
<polygon points="211,211 181,186 196,171" fill="${main}"/>
<!-- Corner diamonds -->
<polygon points="20,20 30,12 40,20 30,28" fill="#c41e3a"/>
<polygon points="216,20 226,12 236,20 226,28" fill="#c41e3a"/>
<polygon points="20,236 30,228 40,236 30,244" fill="#c41e3a"/>
<polygon points="216,236 226,228 236,236 226,244" fill="#c41e3a"/>
</svg>`;
    }

    if (subject.includes('flower') || subject.includes('çiçek')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<rect width="256" height="256" fill="#f5f0e8"/>
<rect x="3" y="3" width="250" height="250" fill="none" stroke="#5c1a0a" stroke-width="6"/>
<rect x="10" y="10" width="236" height="236" fill="none" stroke="#c8a951" stroke-width="2"/>
<!-- Petals (6 diamonds) -->
<polygon points="128,30 148,70 128,110 108,70" fill="${main}"/>
<polygon points="128,146 148,186 128,226 108,186" fill="${main}"/>
<polygon points="30,128 70,108 110,128 70,148" fill="${main}"/>
<polygon points="146,128 186,108 226,128 186,148" fill="${main}"/>
<polygon points="55,55 90,70 75,105 40,90" fill="${main}" opacity="0.8"/>
<polygon points="181,55 216,90 181,105 166,70" fill="${main}" opacity="0.8"/>
<!-- Center -->
<polygon points="128,95 161,128 128,161 95,128" fill="#c41e3a"/>
<polygon points="128,108 148,128 128,148 108,128" fill="#c8a951"/>
<!-- Stem -->
<rect x="124" y="195" width="8" height="40" fill="#2d5a27"/>
<polygon points="115,210 124,200 124,220" fill="#2d5a27"/>
<polygon points="141,215 132,205 132,225" fill="#2d5a27"/>
</svg>`;
    }

    if (subject.includes('heart') || subject.includes('kalp')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<rect width="256" height="256" fill="#f5f0e8"/>
<rect x="3" y="3" width="250" height="250" fill="none" stroke="#5c1a0a" stroke-width="6"/>
<!-- Heart shape from triangles -->
<polygon points="128,220 30,100 80,50 128,90 176,50 226,100" fill="${main}"/>
<polygon points="128,200 50,105 85,65 128,100 171,65 206,105" fill="#c41e3a"/>
<polygon points="128,170 80,110 105,85 128,110 151,85 176,110" fill="#c8a951"/>
<polygon points="128,145 105,115 118,100 128,115 138,100 151,115" fill="#f5f0e8"/>
</svg>`;
    }

    if (subject.includes('star') || subject.includes('yıldız')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<rect width="256" height="256" fill="#f5f0e8"/>
<rect x="3" y="3" width="250" height="250" fill="none" stroke="#5c1a0a" stroke-width="6"/>
<!-- 6-pointed star -->
<polygon points="128,25 165,95 235,95 180,145 200,220 128,175 56,220 76,145 21,95 91,95" fill="${main}"/>
<polygon points="128,55 155,105 215,105 172,145 188,200 128,165 68,200 84,145 41,105 101,105" fill="#c41e3a"/>
<polygon points="128,95 145,128 128,161 111,128" fill="#c8a951"/>
</svg>`;
    }

    // Genel fallback — nested diamonds
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<rect width="256" height="256" fill="#f5f0e8"/>
<rect x="3" y="3" width="250" height="250" fill="none" stroke="#5c1a0a" stroke-width="6"/>
<rect x="10" y="10" width="236" height="236" fill="none" stroke="#c8a951" stroke-width="2"/>
<polygon points="128,25 230,128 128,231 26,128" fill="${main}" opacity="0.7"/>
<polygon points="128,50 205,128 128,206 51,128" fill="#f5f0e8"/>
<polygon points="128,70 185,128 128,186 71,128" fill="${main}" opacity="0.5"/>
<polygon points="128,90 165,128 128,166 91,128" fill="#c41e3a"/>
<polygon points="128,108 148,128 128,148 108,128" fill="#c8a951"/>
<polygon points="25,25 35,15 45,25 35,35" fill="#c41e3a"/>
<polygon points="211,25 221,15 231,25 221,35" fill="#c41e3a"/>
<polygon points="25,231 35,221 45,231 35,241" fill="#c41e3a"/>
<polygon points="211,231 221,221 231,231 221,241" fill="#c41e3a"/>
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
