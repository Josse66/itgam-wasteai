# ITGAM WasteAI — Guía de Deploy

## Estructura del proyecto
```
itgam-wasteai/
├── index.html          ← App principal (todo en un archivo)
├── manifest.json       ← PWA — instalar en Android
├── sw.js               ← Service Worker — cache offline
├── vercel.json         ← Config de deploy
└── model/              ← ⚠️ TÚ agregas estos archivos desde Drive
    ├── model.json
    ├── group1-shard1of5.bin
    ├── group1-shard2of5.bin
    ├── group1-shard3of5.bin
    ├── group1-shard4of5.bin
    ├── group1-shard5of5.bin
    └── metadata.json
```

## Pasos para deploy

### 1. Descargar modelo desde Drive
- Ve a `Google Drive > ITGAM_WasteAI`
- Descarga `modelo_tfjs.zip`
- Descomprime y copia el contenido de `modelo_tfjs/` a la carpeta `model/`

### 2. Agregar API key de Gemini
- Abre `index.html`
- Busca la línea: `const GEMINI_API_KEY = 'TU_API_KEY_AQUI';`
- Reemplaza `TU_API_KEY_AQUI` con tu key de aistudio.google.com

### 3. Deploy en Vercel
1. Ve a vercel.com e inicia sesión con GitHub
2. Sube la carpeta completa a un repo de GitHub
3. En Vercel: New Project → Import ese repo
4. Deploy automático — listo

### 4. Instalar como PWA en Android
- Abre la URL de Vercel en Chrome (tablet)
- Menú ⋮ → "Añadir a pantalla principal"
- Se instala como app nativa
