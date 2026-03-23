# Cortamelacara

App en Vue 3 para subir imágenes, detectar rostros, recortarlos en formato retrato y exportarlos con o sin fondo.

## Qué hace
- Detecta rostros con `face-api.js` usando TinyFaceDetector.
- Permite recortar cada cara en formato retrato.
- Puede quitar el fondo directamente en el navegador con `@imgly/background-removal`.
- Usa `BodyPix` como fallback local cuando el modo desarrollo está activo.
- Aplica filtros de imagen y permite descargar resultados individuales o en lote.

## Requisitos
- Node 16 o superior.
- Navegador moderno.
- Soporte WebGL si vas a usar fallback con BodyPix.

## Instalación
```bash
npm install
```

## Variables de entorno
Crea un archivo `.env.local` en la raíz si necesitás personalizar la app:

```env
VITE_OUTPUT_SIZE=700
VITE_DEV_MODE=false
VITE_SOURCE_CODE_URL=https://github.com/ploscri/cortamelacara/tree/main
```

## Modelos locales
Para detección de rostros y fallback local con BodyPix, asegurate de tener estos archivos en `public/models`:

```text
public/models/tiny_face_detector_model-weights_manifest.json
public/models/tiny_face_detector_model-shard1
public/models/bodypix/model-stride16.json
public/models/bodypix/group1-shard1of2.bin
public/models/bodypix/group1-shard2of2.bin
```

## Desarrollo
```bash
npm run dev
```

## Modos de procesamiento

### Modo normal
- `VITE_DEV_MODE=false`
- Usa `@imgly/background-removal` en el navegador para remover fondo.

### Modo desarrollo
- `VITE_DEV_MODE=true`
- Si falla `@imgly/background-removal`, intenta resolver la segmentación con `BodyPix`.

## Estructura principal
```text
src/
  App.vue
  main.js
  style.css
  components/
    FaceGrid.vue
    PhotoUploader.vue
    PortraitEditor.vue
  services/
    FaceService.js
```

## Notas
- El flujo principal está en `src/App.vue`.
- La lógica de detección, segmentación y recorte está en `src/services/FaceService.js`.
- `optimizePortrait()` sigue siendo un punto de extensión para mejoras futuras.

## Problemas comunes
- Si faltan modelos, `face-api.js` o `BodyPix` no van a cargar correctamente.
- Si aparece un 404 en `/models`, revisá la estructura dentro de `public/models`.
- BodyPix puede rendir peor con imágenes complejas o equipos lentos.
