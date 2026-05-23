// ============================================================
// API Serverless — Proxy a Gemini Vision y Texto
// La key va en Vercel Environment Variables, no en el código
// ============================================================

export default async function handler(req, res) {
    // Solo POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verificar key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en Vercel' });
    }

    const { tipo, base64Img, clase } = req.body;
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
        let payload;

        if (tipo === 'vision') {
            // Validar que la imagen no esté vacía
            if (!base64Img || base64Img.length < 500) {
                return res.status(400).json({ error: 'Imagen inválida', texto: null });
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
                    thinkingConfig: {
                        thinkingBudget: 0
                    },
                    maxOutputTokens: 10,
                    temperature: 0
                }
            };

        } else if (tipo === 'dato') {
            const nombres = {
                organico: 'ORGÁNICO',
                inorganico_reciclable: 'INORGÁNICO RECICLABLE',
                no_aprovechable: 'NO APROVECHABLE',
                peligroso: 'RESIDUO PELIGROSO'
            };

            payload = {
                contents: [{
                    parts: [{
                        text: `Para un residuo clasificado como "${nombres[clase] || clase}" en una institución educativa de la Ciudad de México: escribe UN dato curioso breve y UN consejo de reciclaje. Máximo 2 oraciones cortas en español. Sin emojis, sin viñetas, solo texto corrido.`
                    }]
                }],
                generationConfig: {
                    thinkingConfig: {
                        thinkingBudget: 0
                    },
                    maxOutputTokens: 150,
                    temperature: 0.7
                }
            };

        } else {
            return res.status(400).json({ error: 'Tipo inválido. Usa "vision" o "dato".' });
        }

        // Llamar a Gemini
        const geminiRes = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await geminiRes.json();

        // Verificar errores de Gemini
        if (!geminiRes.ok || data.error) {
            console.error('Gemini error:', JSON.stringify(data.error || {}));
            return res.status(200).json({
                texto: null,
                error: data.error?.message || `Gemini HTTP ${geminiRes.status}`
            });
        }

        // Extraer texto de respuesta
        // Gemini 2.5 Flash puede devolver bloques de "thought" antes del texto real
        const parts = data.candidates?.[0]?.content?.parts || [];
        let texto = '';
        for (const part of parts) {
            if (part.text && !part.thought) {
                texto = part.text.trim();
                break;
            }
        }

        // Si no encontramos texto sin thought, tomar cualquier texto
        if (!texto) {
            texto = parts.find(p => p.text)?.text?.trim() || '';
        }

        // Procesar según tipo
        if (tipo === 'vision') {
            const mapa = {
                '1': 'organico',
                '2': 'inorganico_reciclable',
                '3': 'no_aprovechable',
                '4': 'peligroso'
            };
            // Extraer primer dígito de la respuesta
            const digitos = texto.replace(/\D/g, '');
            const num = digitos.charAt(0);
            const claseDetectada = mapa[num] || null;

            console.log(`Gemini vision: raw="${texto}" → clase=${claseDetectada}`);
            return res.status(200).json({ texto: claseDetectada });
        }

        // tipo === 'dato'
        return res.status(200).json({ texto });

    } catch (err) {
        console.error('Error en handler:', err.message);
        return res.status(200).json({ texto: null, error: err.message });
    }
}
