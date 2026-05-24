// ============================================================
// API Serverless — Proxy a Gemini Vision y Texto
// Plain Vercel Node.js — sin Edge Runtime, sin framework
// ============================================================

export const maxDuration = 15;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' });
    }

    const { tipo, base64Img, clase } = req.body;
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    let payload;

    if (tipo === 'vision') {
        if (!base64Img || base64Img.length < 500) {
            return res.status(400).json({ error: 'Imagen inválida', texto: null });
        }
        payload = {
            contents: [{
                parts: [
                    { inline_data: { mime_type: 'image/jpeg', data: base64Img } },
                    { text: 'Clasifica este residuo en UNA de estas categorías. Responde SOLO con el número correspondiente, sin texto adicional:\n1 = organico (restos de comida, frutas, verduras, plantas, papel sucio de comida)\n2 = inorganico_reciclable (plástico, vidrio, metal, cartón limpio, papel limpio, latas)\n3 = no_aprovechable (colillas, chicles, papel higiénico, envolturas metalizadas, residuos sanitarios, unicel sucio)\n4 = peligroso (pilas, baterías, medicamentos, productos químicos, electrónicos, focos)\nResponde SOLO el número.' }
                ]
            }],
            generationConfig: { maxOutputTokens: 10, temperature: 0 }
        };

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

    } else {
        return res.status(400).json({ error: 'Tipo inválido.' });
    }

    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 12000);

    try {
        const geminiRes = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: ctrl.signal
        });
        clearTimeout(timeoutId);

        if (geminiRes.status === 429) {
            return res.status(200).json({ fallback: true, texto: null });
        }

        const data = await geminiRes.json();

        if (!geminiRes.ok || data.error) {
            console.error(`Gemini ${tipo} error:`, data.error?.message || geminiRes.status);
            return res.status(200).json({ texto: null });
        }

        // Candidates vacío = safety filter de Gemini
        const candidates = data.candidates || [];
        if (candidates.length === 0) {
            console.warn(`Gemini ${tipo}: candidates vacío (safety filter o sin respuesta)`);
            return res.status(200).json({ texto: null });
        }

        const parts = candidates[0]?.content?.parts || [];
        const texto = parts.find(p => p.text)?.text?.trim() || '';

        if (tipo === 'vision') {
            const mapa  = { '1': 'organico', '2': 'inorganico_reciclable', '3': 'no_aprovechable', '4': 'peligroso' };
            const num   = texto.replace(/\D/g, '').charAt(0);
            const clase = mapa[num] || null;
            console.log(`Gemini vision: raw="${texto}" num="${num}" → clase=${clase}`);
            return res.status(200).json({ texto: clase });
        }

        console.log(`Gemini dato (${clase}): ${texto.substring(0, 60)}...`);
        return res.status(200).json({ texto });

    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            console.warn(`Gemini ${tipo}: timeout 12s`);
            return res.status(200).json({ fallback: true, texto: null });
        }
        console.error(`Gemini ${tipo} excepción:`, err.message);
        return res.status(200).json({ texto: null });
    }
}