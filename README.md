# 🗑️ ITGAM WasteAI

App web progresiva (PWA) que clasifica residuos en tiempo real usando un ensemble de 3 modelos de IA corriendo directamente en el navegador del celular, sin instalación y con soporte offline.

## ¿Qué hace?

Tomas foto a cualquier residuo y la app te dice en segundos dónde va:

- 🟢 **Orgánico** — restos de comida, papel mojado, cáscaras
- 🔵 **Inorgánico reciclable** — plástico, vidrio, metal limpio
- ⚫ **No aprovechable** — unicel, pañales, papel encerado
- 🔴 **Peligroso** — medicamentos, baterías, aerosoles, electrónicos

## Cómo funciona

Tres modelos de IA votan simultáneamente sobre la imagen capturada:

- Si los 3 coinciden → **UNANIMIDAD** (confianza hasta 98%)
- Si 2 coinciden → **MAYORÍA** (confianza media)
- Si ninguno coincide → **Gemini 2.5 Flash** entra como árbitro

Este sistema de ensemble pasó la confianza de clasificación de ~40% (modelo único) a 65–98% en casos claros.

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML, JavaScript vanilla, Tailwind CSS |
| IA en browser | TensorFlow.js (3 modelos en paralelo) |
| Árbitro externo | Gemini 2.5 Flash API con rotación de 4 keys |
| Backend | Python FastAPI (Vercel serverless) |
| Deploy | Vercel |
| Offline | Service Worker + PWA |

## Variables de entorno

```env
GEMINI_API_KEY=tu_key_1
GEMINI_API_KEY_2=tu_key_2
GEMINI_API_KEY_3=tu_key_3
GEMINI_API_KEY_4=tu_key_4
```

## Demo

🌐https://itgam-wasteai.vercel.app/
