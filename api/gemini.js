export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Sin API key' });

    const { tipo, base64Img, clase } = req.body;
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
        let payload;
        if (tipo === 'vision') {
            if (!base64Img || base64Img.length < 1000) return res.status(400).json({ error: 'Imagen inválida' });
            payload = {
                contents: [{
                    parts: [
                        { inline_data: { mime_type: 'image/jpeg', data: base64Img } },
                        { text: 'Clasifica este residuo. Responde SOLO con uno de estos números: 1=organico, 2=inorganico_reciclable, 3=no_aprovechable, 4=peligroso. Solo el número.' }
                    ]
                }]
            };
        } else {
            const nombres = { organico: 'ORGÁNICO', inorganico_reciclable: 'INORGÁNICO RECICLABLE', no_aprovechable: 'NO APROVECHABLE', peligroso: 'RESIDUO PELIGROSO' };
            payload = {
                contents: [{
                    parts: [{ text: `Para un residuo "${nombres[clase] || clase}" en institución educativa en México: UN dato curioso y UN consejo de reciclaje. Máximo 2 oraciones, sin emojis.` }]
                }]
            };
        }

        const geminiRes = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await geminiRes.json();
        const texto = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        if (tipo === 'vision') {
            const mapa = { '1': 'organico', '2': 'inorganico_reciclable', '3': 'no_aprovechable', '4': 'peligroso' };
            const num = texto.replace(/\D/g, '').charAt(0);
            return res.status(200).json({ texto: mapa[num] || null });
        }

        return res.status(200).json({ texto });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}