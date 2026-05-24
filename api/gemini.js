// ============================================================
// API Serverless — Proxy a Gemini Vision y Texto
// Plain Vercel Node.js — sin Edge Runtime, sin framework
// 4 API Keys en rotación automática con fallback
// ============================================================

export const maxDuration = 15;

// ── Rotación de keys ─────────────────────────────────────────
const GEMINI_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
].filter(Boolean);

let currentKeyIndex = 0;

function getGeminiURL(keyIndex) {
    const key = GEMINI_KEYS[keyIndex % GEMINI_KEYS.length];
    return `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${key}`;
}

async function fetchConRotacion(payload, t0) {
    const total = GEMINI_KEYS.length;

    for (let intento = 0; intento < total; intento++) {
        const idx = (currentKeyIndex + intento) % total;
        const url = getGeminiURL(idx);

        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 12000);

        try {
            const geminiRes = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: ctrl.signal
            });
            clearTimeout(timeoutId);

            const elapsed = Date.now() - t0;
            console.log(`[GEMINI] 📡 Key ${idx + 1}/${total} → HTTP ${geminiRes.status} en ${elapsed}ms`);

            if (geminiRes.status === 429) {
                console.warn(`[GEMINI] ⚠ Key ${idx + 1} en rate limit 429, rotando a siguiente...`);
                continue; // prueba la siguiente key
            }

            // Key funcionó — la dejamos como preferida para el próximo request
            currentKeyIndex = idx;
            console.log(`[GEMINI] ✅ Usando key ${idx + 1} como activa`);
            return { geminiRes, elapsed };

        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                console.warn(`[GEMINI] ⏰ Key ${idx + 1} timeout 12s, rotando...`);
                continue;
            }
            console.error(`[GEMINI] 💥 Key ${idx + 1} excepción: ${err.message}`);
            continue;
        }
    }

    // Todas las keys fallaron
    console.error(`[GEMINI] ❌ Todas las ${total} keys fallaron (429 o timeout)`);
    return null;
}
// ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
    const t0 = Date.now();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (GEMINI_KEYS.length === 0) {
        console.error('[GEMINI] ❌ Ninguna GEMINI_API_KEY configurada en Vercel');
        return res.status(500).json({ error: 'API keys no configuradas' });
    }

    console.log(`[GEMINI] 🔑 ${GEMINI_KEYS.length} key(s) disponibles`);

    const { tipo, base64Img, clase } = req.body;
    console.log(`[GEMINI] ▶ Inicio tipo="${tipo}" clase="${clase || 'N/A'}" imgLen=${base64Img?.length || 0}`);

    let payload;

    if (tipo === 'vision') {
        if (!base64Img || base64Img.length < 500) {
            console.warn('[GEMINI] ⚠ Imagen demasiado pequeña o vacía');
            return res.status(400).json({ error: 'Imagen inválida', texto: null });
        }
        payload = {
            contents: [{
                parts: [
                    { inline_data: { mime_type: 'image/jpeg', data: base64Img } },
                    { text: 'Clasifica este residuo en UNA de estas categorías. Responde SOLO con el número correspondiente, sin texto adicional:\n1 = organico (restos de comida, frutas, verduras, plantas, papel sucio de comida)\n2 = inorganico_reciclable (plástico, vidrio, metal, cartón limpio, papel limpio, latas)\n3 = no_aprovechable (colillas, chicles, papel higiénico, envolturas metalizadas, residuos sanitarios, unicel sucio)\n4 = peligroso (pilas, baterías, medicamentos, productos químicos, electrónicos, focos)\nResponde SOLO el número.' }
                ]
            }],
            generationConfig: { maxOutputTokens: 10, temperature: 0 },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
            ]
        };
        console.log('[GEMINI] 📷 Payload vision armado');

    } else if (tipo === 'dato') {
        const nombres = {
            organico:              'ORGÁNICO',
            inorganico_reciclable: 'INORGÁNICO RECICLABLE',
            no_aprovechable:       'NO APROVECHABLE',
            peligroso:             'RESIDUO PELIGROSO'
        };
        payload = {
            contents: [{
                parts: [{ text: `Para un residuo clasificado como "${nombres[clase] || clase}" en una institución educativa de la Ciudad de México: escribe UN dato curioso breve y UN consejo de reciclaje. Máximo 2 oraciones cortas en español. Sin emojis, sin viñetas, solo texto corrido.` }]
            }],
            generationConfig: { maxOutputTokens: 150, temperature: 0.7 }
        };
        console.log(`[GEMINI] 📝 Payload dato armado para clase="${clase}"`);

    } else {
        console.error(`[GEMINI] ❌ Tipo inválido: "${tipo}"`);
        return res.status(400).json({ error: 'Tipo inválido.' });
    }

    // ── Llamada con rotación automática ──────────────────────
    const resultado = await fetchConRotacion(payload, t0);

    if (!resultado) {
        // Todas las keys agotadas
        return res.status(200).json({ fallback: true, texto: null });
    }

    const { geminiRes, elapsed } = resultado;

    if (!geminiRes.ok) {
        const errData = await geminiRes.json().catch(() => ({}));
        console.error(`[GEMINI] ❌ Error HTTP ${geminiRes.status}:`, errData.error?.message || 'sin detalle');
        return res.status(200).json({ texto: null });
    }

    const data = await geminiRes.json();

    // Candidates vacío = safety filter
    const candidates = data.candidates || [];
    if (candidates.length === 0) {
        const blockReason    = data.promptFeedback?.blockReason || 'no especificado';
        const safetyRatings  = JSON.stringify(data.promptFeedback?.safetyRatings?.map(r => `${r.category}:${r.probability}`) || []);
        console.warn(`[GEMINI] 🛡 Candidates vacío — blockReason=${blockReason} safety=${safetyRatings}`);
        return res.status(200).json({ texto: null, blocked: true });
    }

    const finishReason = candidates[0]?.finishReason || 'UNKNOWN';
    console.log(`[GEMINI] ✓ finishReason=${finishReason}`);

    if (finishReason === 'SAFETY') {
        console.warn('[GEMINI] 🛡 finishReason=SAFETY');
        return res.status(200).json({ texto: null, blocked: true });
    }

    const parts  = candidates[0]?.content?.parts || [];
    const texto  = parts.find(p => p.text)?.text?.trim() || '';

    if (tipo === 'vision') {
        const mapa       = { '1': 'organico', '2': 'inorganico_reciclable', '3': 'no_aprovechable', '4': 'peligroso' };
        const num        = texto.replace(/\D/g, '').charAt(0);
        const claseResult = mapa[num] || null;
        console.log(`[GEMINI] 🎯 Vision: raw="${texto}" num="${num}" → clase=${claseResult} (${elapsed}ms)`);
        return res.status(200).json({ texto: claseResult });
    }

    console.log(`[GEMINI] 📖 Dato: "${texto.substring(0, 80)}..." (${elapsed}ms)`);
    return res.status(200).json({ texto });
}