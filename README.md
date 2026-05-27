# 🗑️ ITGAM WasteAI

> App web progresiva (PWA) que clasifica residuos en tiempo real usando un ensemble de 3 modelos de IA corriendo directamente en el navegador del celular, sin instalación y con soporte offline.

**Demo en vivo:** 🌐 https://itgam-wasteai.vercel.app
**Panel técnico:** 🌐 https://itgam-wasteai.vercel.app/ml-panel.html

[![Deploy](https://img.shields.io/badge/deploy-vercel-black)](https://vercel.com)
[![PWA](https://img.shields.io/badge/PWA-ready-blue)]()
[![ML](https://img.shields.io/badge/ONNX_Runtime_Web-1.19-orange)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## 🎯 ¿Qué hace?

Tomas foto a cualquier residuo y la app te dice en segundos en qué contenedor va:

- 🟢 **Orgánico** — restos de comida, papel mojado, cáscaras, residuos compostables
- ⚪ **Inorgánico reciclable** — plástico, vidrio, metal limpio, papel y cartón limpios
- ⚫ **No aprovechable** — unicel, pañales, papel encerado, colillas, envolturas metalizadas
- 🔴 **Peligroso** — medicamentos, baterías, aerosoles, electrónicos, químicos

Estas 4 clases fueron diseñadas específicamente para los contenedores institucionales del TecNM y siguen las normas oficiales de separación de residuos de la Ciudad de México.

---

## 🧠 ¿Cómo funciona?

Tres modelos de IA EfficientNet-B0 votan simultáneamente sobre la imagen capturada, con un árbitro externo de respaldo:

| Caso | Lógica | Confianza típica |
|------|--------|------------------|
| Los 3 modelos coinciden | **UNANIMIDAD** → predicción directa | 95–98% |
| Solo 2 coinciden | **MAYORÍA** → votación ponderada por confianza | 70–90% |
| Modelos discrepan y conf < 70% | **Gemini 2.5 Flash** entra como árbitro VLM | variable |

El ensemble pasó la confianza de clasificación de ~90% (modelo único) a **95–98% en casos claros**, con caída del error en aproximadamente 30% gracias a la diversidad de los modelos.

---

## 🧱 Stack técnico

| Capa | Tecnología |
|------|------------|
| **Frontend** | HTML + JavaScript vanilla + CSS custom (Orbitron + Exo 2) |
| **IA en navegador** | ONNX Runtime Web 1.19 (WASM + SIMD, 3 modelos en paralelo) |
| **Modelos** | 3× EfficientNet-B0 entrenados en PyTorch / Keras → exportados a ONNX |
| **Árbitro externo** | Gemini 2.5 Flash Vision API con rotación automática de 4 API keys |
| **Backend** | Vercel Serverless Functions en Node.js plano (sin framework) |
| **Deploy** | Vercel (CDN global + funciones serverless) |
| **Offline / PWA** | Service Worker con cache estratégico (modelos cache-first, HTML network-first) |
| **Sin app store** | Instalable directo desde el navegador como PWA |

---

## 📁 Estructura del repositorio

```
itgam-wasteai/
├── api/
│   └── gemini.js              # Proxy serverless a Gemini con rotación de keys
├── model/
│   ├── wasteai_final.onnx     # Modelo V1 (PyTorch, dataset original)
│   ├── wasteai_v2.onnx        # Modelo V2 (PyTorch, dataset especializado)
│   └── wasteai_v3.onnx        # Modelo V3 (Keras, dataset masivo 67k)
├── train/                     # Notebooks de entrenamiento
│   ├── ITGAM_WasteAI_Fase1.ipynb     # V1 — pipeline base
│   ├── ITGAM_WasteAI_Fase1_v2.ipynb  # V2 — dataset balanceado
│   └── ITGAM_WasteAI_Fase1_v3.ipynb  # V3 — dataset masivo + export ONNX
├── docs/
│   ├── ITGAM_WasteAI_Hoja_de_Etiquetado.xlsx   # Hoja de etiquetado
│   └── REPORT.md              # Reporte técnico
├── index.html                 # App principal
├── ml-panel.html              # Panel técnico de monitoreo ML
├── manifest.json              # Manifiesto PWA
├── sw.js                      # Service Worker
├── vercel.json                # Configuración de Vercel
└── README.md                  # Este archivo
```

---

## 📊 Métricas del modelo (resumen)

Resultados reales obtenidos en los splits de validación de los notebooks:

| Modelo | Imágenes train | Val Accuracy | Macro F1 |
|--------|----------------|---------------|----------|
| V1 (PyTorch original) | ~16,500 | **95.85%** | 0.88 |
| V2 (PyTorch fine-tuned) | ~22,000 | **95.74%** | — |
| V3 (Keras masivo) | 53,881 (val 13,470) | **95.00%** | 0.92 |
| **Ensemble V1+V2+V3** | — | **~96.4%** estimado | — |

Per-clase del V3 (validación 13,470 imágenes):
- 🟢 orgánico: precision 0.96 · recall 0.97 · F1 0.96
- ⚪ inorgánico reciclable: precision 0.98 · recall 0.94 · F1 0.96
- ⚫ no aprovechable: precision 0.73 · recall 0.96 · F1 0.83
- 🔴 peligroso: precision 0.90 · recall 0.98 · F1 0.94

Reporte completo de métricas, matrices de confusión y análisis de errores → ver [`REPORT.md`](REPORT.md).

---

## 🗂️ Datasets usados

7 datasets públicos de Kaggle, curados y remapeados a las 4 clases ITGAM. Total agregado ~67,000 imágenes en el V3.

1. **TrashNet** — `feyzazkefe/trashnet`
2. **TACO** — `kneroma/tacotrashdataset`
3. **Recyclable and Household Waste Classification** — `alistairking/recyclable-and-household-waste-classification`
4. **Garbage Classification v2** — `sumn2u/garbage-classification-v2`
5. **Garbage Classification** — `mostafaabla/garbage-classification`
6. **Waste Classification Data** — `techsash/waste-classification-data`
7. **E-Waste Image Dataset** — `akshaybhola/e-waste-image-dataset` (descargado, no integrado al V3 final)

Mapeo completo, criterios de etiquetado, justificaciones y conteos → ver [`docs/ITGAM_WasteAI_Hoja_de_Etiquetado.xlsx`](docs/ITGAM_WasteAI_Hoja_de_Etiquetado.xlsx).

---

## 🚀 Cómo correr el proyecto

### Opción 1: Usar la versión desplegada
Abre directamente https://itgam-wasteai.vercel.app en tu celular. Acepta el permiso de cámara y listo.

### Opción 2: Deploy local con Vercel CLI

```bash
git clone https://github.com/Josse66/itgam-wasteai.git
cd itgam-wasteai
npm i -g vercel
vercel dev
```

### Opción 3: Servir como archivo estático (sin Gemini)

```bash
git clone https://github.com/Josse66/itgam-wasteai.git
cd itgam-wasteai
python -m http.server 8000
# Abrir http://localhost:8000
```

Funciona el ensemble local, pero el árbitro Gemini requerirá las funciones serverless.

### Variables de entorno (Vercel)

```env
GEMINI_API_KEY=tu_key_1
GEMINI_API_KEY_2=tu_key_2
GEMINI_API_KEY_3=tu_key_3
GEMINI_API_KEY_4=tu_key_4
```

Las 4 keys se rotan automáticamente con fallback: si una llega a rate limit (HTTP 429), el proxy salta a la siguiente.

---

## 🔬 Reproducir el entrenamiento

Los 3 notebooks en `/train` son auto-contenidos y corren en Google Colab con GPU T4 gratuita:

1. Abre el notebook correspondiente en Colab
2. Conecta a runtime con GPU
3. Sube tu archivo `kaggle.json` con tus credenciales de Kaggle
4. Ejecuta todas las celdas en orden

El notebook descarga los datasets, construye el dataset unificado, entrena el modelo en dos etapas (head + fine-tuning completo) y exporta a ONNX al final. Tiempo aproximado de extremo a extremo: ~2 horas en T4.

---

## 🧪 Evaluación con usuarios

Protocolo y resultados → ver sección 9 del [`REPORT.md`](REPORT.md).

Diseño: comparación pre-post de 10 voluntarios clasificando 12 residuos físicos sin y con la app. Métricas: tasa de error de clasificación, tiempo por decisión, percepción de confianza (Likert 1-5).

---

## ⚠️ Limitaciones conocidas

- La clase **no aprovechable** tiene F1 más bajo (~0.83) por confusión con reciclables; común incluso para humanos.
- Imágenes muy borrosas o residuos compuestos (p.ej. caja con contenido orgánico) pueden caer al árbitro Gemini.
- Sin red, el árbitro queda inactivo; el ensemble local sigue funcionando.
- La cámara requiere HTTPS (Vercel lo cumple).

---

## 👥 Equipo

Proyecto Final S04 · Materia: **Machine Learning for the Web**
Institución: **Instituto Tecnológico de Gustavo A. Madero (ITGAM) · TecNM**
Semestre: 2026

---

## 📄 Licencia

MIT License — ver [`LICENSE`](LICENSE) si aplica.
