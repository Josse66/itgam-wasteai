// ============================================================
// API Edge Function — Proxy a Gemini Vision y Texto
// Edge Runtime: sin límite de 10s, fetch nativo, sin NPM de Google
// La key va en Vercel Environment Variables, no en el código
// ============================================================

export const runtime = 'edge';   // ← elimina el timeout de 10s de Serverless

// Backoff acotado para UX interactivo (no esperar 30s entre reintentos)
const DELAYS_MS = [600, 1800];   // máx 2 reintentos

async function fetchGemini(url, payload, intento = 0) {
    const ctrl      = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 22000); // 22s por intento

    let res;
    try {
        res = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
            signal:  ctrl.signal
        });
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') throw new Error('TIMEOUT');
        throw err;
    }
    clearTimeout(timeoutId);

    // 429 — rate limit: respetar Retry-After si viene, sino backoff fijo
    if (res.status === 429 && intento < DELAYS_MS.length) {
        const retryAfter = res.headers.get('Retry-After');
        const espera     = retryAfter ? parseInt(retryAfter) * 1000 : DELAYS_MS[intento];
        await new Promise(r => setTimeout(r, espera));
        return fetchGemini(url, payload, intento + 1);
    }

    // 5xx — reintento con backoff
    if (res.status >= 500 && intento < DELAYS_MS.length) {
        await new Promise(r => setTimeout(r, DELAYS_MS[intento]));
        return fetchGemini(url, payload, intento + 1);
    }

    return res;
}

// Valida y normaliza el número de clase que devuelve Gemini vision
function parsearClaseVision(texto) {
    const mapa = {
        '1': 'organico',
        '2': 'inorganico_reciclable',
        '3': 'no_aprovechable',
        '4': 'peligroso'
    };
    const num = (texto || '').replace(/\D/g, '').charAt(0);
    return mapa[num] || null;
}

// ============================================================
// HANDLER — Edge Runtime usa Request/Response (Web API)
// ============================================================
export default async function handler(request) {

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: 'GEMINI_API_KEY no configurada en Vercel' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'JSON inválido' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const { tipo, base64Img, clase } = body;

    // ── Construir payload según tipo ──────────────────────────
    let payload;

    if (tipo === 'vision') {
        if (!base64Img || base64Img.length < 500) {
            return new Response(JSON.stringify({ error: 'Imagen inválida', texto: null }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        payload = {
            contents: [{
                parts: [
                    {
                        inline_data: {
                            mime_type: 'image/jpeg',
                            data: base64Img
                        }
                    },
                    {
                        text: 'Clasifica este residuo en UNA de estas categorías. Responde SOLO con el número correspondiente, sin texto adicional:\n1 = organico (restos de comida, frutas, verduras, plantas, papel sucio de comida)\n2 = inorganico_reciclable (plástico, vidrio, metal, cartón limpio, papel limpio, latas)\n3 = no_aprovechable (colillas, chicles, papel higiénico, envolturas metalizadas, residuos sanitarios, unicel sucio)\n4 = peligroso (pilas, baterías, medicamentos, productos químicos, electrónicos, focos)\nResponde SOLO el número.'
                    }
                ]
            }],
            generationConfig: {
                maxOutputTokens: 10,
                temperature: 0
            }
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
                parts: [{
                    text: `Para un residuo clasificado como "${nombres[clase] || clase}" en una institución educativa de la Ciudad de México: escribe UN dato curioso breve y UN consejo de reciclaje. Máximo 2 oraciones cortas en español. Sin emojis, sin viñetas, solo texto corrido.`
                }]
            }],
            generationConfig: {
                maxOutputTokens: 150,
                temperature: 0.7
            }
        };

    } else {
        return new Response(JSON.stringify({ error: 'Tipo inválido. Usa "vision" o "dato".' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    // ── Llamada a Gemini con reintentos ───────────────────────
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
        status, headers: { 'Content-Type': 'application/json' }
    });

    try {
        const geminiRes = await fetchGemini(GEMINI_URL, payload);

        // Rate limit agotado (ya se reintentó)
        if (geminiRes.status === 429) {
            return json({ fallback: true, message: 'Límite de consultas alcanzado' });
        }

        const data = await geminiRes.json();

        if (!geminiRes.ok || data.error) {
            console.error('Gemini error:', JSON.stringify(data.error || {}));
            return json({
                texto: null,
                error: data.error?.message || `Gemini HTTP ${geminiRes.status}`
            });
        }

        const parts  = data.candidates?.[0]?.content?.parts || [];
        const texto  = parts.find(p => p.text)?.text?.trim() || '';

        if (tipo === 'vision') {
            const claseDetectada = parsearClaseVision(texto);
            console.log(`Gemini vision: raw="${texto}" → clase=${claseDetectada}`);
            return json({ texto: claseDetectada });
        }

        return json({ texto });

    } catch (err) {
        if (err.message === 'TIMEOUT') {
            return json({ fallback: true, message: 'Tiempo de respuesta agotado' });
        }
        console.error('Error en handler:', err.message);
        return json({ texto: null, error: err.message });
    }
}