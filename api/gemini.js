export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'API key no configurada en Vercel' });
    }

    const { tipo, base64Img, clase } = req.body;

    let payload;

    if (tipo === 'vision') {
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
                        text: `Eres un clasificador de residuos para el Instituto Tecnológico de Gustavo A. Madero (ITGAM) en la Ciudad de México.

Observa esta imagen y clasifica el residuo en EXACTAMENTE una de estas 4 categorías:
- organico (restos de comida, plantas, papel sucio de comida)
- inorganico_reciclable (plástico, vidrio, metal, cartón limpio, papel limpio)
- no_aprovechable (colillas, chicles, papel higiénico, envolturas metalizadas, residuos sanitarios)
- peligroso (pilas, baterías, medicamentos, productos químicos, electrónicos)

Responde ÚNICAMENTE con el nombre de la categoría, sin explicación ni puntuación.`
                    }
                ]
            }]
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
                    text: `Para un residuo clasificado como "${nombres[clase]}" en una institución educativa de la Ciudad de México:
Genera EN ESPAÑOL un dato curioso breve y un consejo de reciclaje.
Máximo 2 oraciones en total. Sé conciso, educativo y usa un tono amigable.
No uses emojis ni viñetas. Solo texto corrido.`
                }]
            }]
        };
    } else {
        return res.status(400).json({ error: 'tipo inválido' });
    }

    try {
        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }
        );

        const data = await geminiRes.json();
        const texto = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        res.status(200).json({ texto });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
