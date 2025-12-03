# GridFaces (Vue 3 + Vite)

Webapp que:
1) Recibe imágenes del usuario.  
2) Detecta rostros con `face-api.js` (TinyFaceDetector).  
3) Elimina fondo con **Remove.bg API** (producción) o **BodyPix** (desarrollo).
4) Recorta cada rostro a retrato 3:4 y lo coloca sobre un color plano elegido.  
5) Aplica filtros opcionales: **Blanco y Negro** y **Aumentar Contraste**.
6) Permite **descargar** imágenes individuales o en lote.
7) Muestra una grilla responsive con todos los retratos.

## Requisitos
- Node 16+ (Vite 4 en este proyecto).  
- Navegador con soporte WebGL (para BodyPix en desarrollo).
- API Key de **Remove.bg** (gratuita, 50 requests/mes).

## Instalación
```bash
npm install
```

## Configuración

### API Key de Remove.bg
1. Crea un archivo `.env.local` en la raíz del proyecto:
```env
VITE_REMOVEBG_API_KEY=tu_api_key_aqui
VITE_DEV_MODE=false
```

2. Obtén tu clave gratuita en: https://www.remove.bg/api

### Modelos locales (solo para modo desarrollo)
Coloca los modelos en `public/models` si quieres usar BodyPix en vez de Remove.bg:
```
public/models/tiny_face_detector_model-weights_manifest.json
public/models/tiny_face_detector_model-shard1
public/models/bodypix/model-stride16.json
public/models/bodypix/group1-shard1of2.bin
public/models/bodypix/group1-shard2of2.bin
```

**Descargas:**
- TinyFaceDetector: repo de face-api.js (carpeta `weights`)  
- BodyPix MobileNet 0.75 stride16: https://storage.googleapis.com/tfjs-models/savedmodel/bodypix/mobilenet/float/075/

## Ejecutar en desarrollo
```bash
npm run dev
```
Abre la URL que muestra Vite (por defecto `http://localhost:5173`).

## Modo de operación

### Producción (Remove.bg)
- `VITE_DEV_MODE=false`
- Usa Remove.bg API para quitar fondos (profesional, rápido)
- Consume 1 request por rostro detectado
- Excelente calidad de segmentación

### Desarrollo (BodyPix)
- `VITE_DEV_MODE=true`
- Usa segmentación local con BodyPix (TensorFlow.js)
- Sin consumir requests API
- Menor precisión que Remove.bg

## Uso
1) **Selecciona color de fondo** con el selector de color.  
2) **Sube fotos** (JPG, PNG, etc.).  
3) La app detecta rostros y los procesa automáticamente.  
4) **Aplica filtros** (opcional):
   - ✅ **Blanco y Negro**: Convierte solo la foto a escala de grises, preservando el color del fondo
   - ✅ **Aumentar Contraste**: Aumenta el contraste (1.5x) solo en la foto, no afecta el fondo
5) **Descarga**:
   - Botón individual ⬇️ en cada retrato
   - Botón "Descargar todos" para descarga en lote (200ms entre archivos)

## Filtros

### Blanco y Negro
- Detecta automáticamente el color de fondo más frecuente
- Convierte la foto a escala de grises usando luminancia
- **Preserva el color del fondo** (no se convierte a B&N)

### Aumentar Contraste
- Factor de contraste: 1.5x
- Se aplica solo a la foto
- **El fondo mantiene su color original**

### Combinación
Puedes activar B&N y Contraste simultáneamente:
- La foto se convierte a B&N
- Luego se aplica contraste al B&N
- El fondo permanece inmodificable

## Tecnologías
- **Frontend**: Vue 3 + Composition API (Vite)
- **Face Detection**: face-api.js (TinyFaceDetector model)
- **Background Removal**: 
  - Remove.bg API v1.0 (producción)
  - BodyPix + TensorFlow.js (desarrollo/fallback)
- **Image Processing**: Canvas API 2D (filtros, recorte, descarga)
- **Storage**: localStorage para cache (opcional)

## Estructura de archivos
```
src/
├── App.vue                 # Componente principal
├── main.js                 # Entrada Vue
├── style.css               # Estilos globales
├── components/
│   ├── FaceGrid.vue        # Grilla de retratos
│   └── PhotoUploader.vue   # Selector de imágenes
└── services/
    └── FaceService.js      # Lógica de detección y procesamiento
```

## Notas técnicas

### Detección del color de fondo
Se utiliza un análisis de frecuencia de píxeles:
- Muestrea píxeles distribuidos en la imagen
- Agrupa colores similares (redondeo de ±10 en RGB)
- Identifica el color más frecuente (probablemente el fondo)
- Tolerancia: 25 píxeles de diferencia en RGB

### Procesamiento en background
Los filtros se procesan de forma asíncrona:
- Las imágenes se muestran mientras se procesan
- Cache local para evitar reprocesar imágenes
- `requestIdleCallback` para no bloquear UI

### Descarga de imágenes
- Se aplican filtros en tiempo real durante la descarga
- Genera archivos PNG con transparencia donde es necesario
- Nombres automáticos: `retrato-1.png`, `retrato-2.png`, etc.

## Troubleshooting

### "No se pudieron cargar los modelos"
- Verifica que `public/models` tenga los archivos correctos
- Revisa la consola del navegador (F12)

### Bajo rendimiento en BodyPix
- Reduce el número de imágenes procesadas simultáneamente
- Aumenta el timeout de procesamiento

### Remove.bg sin funcionar
- Verifica que el API Key esté en `.env.local`
- Confirma que no hayas agotado los 50 requests gratuitos del mes
- Revisa la consola para errores de API

## Licencia
MIT  
- Detección: `face-api.js` (TinyFaceDetector).  
- Segmentación: `@tensorflow-models/body-pix` + `@tensorflow/tfjs@1.7.4` (compatibles con face-api).  
- Archivos clave:
  - `src/main.js`: bootstrap de Vue.
  - `src/App.vue`: flujo principal, estados, selector de color.
  - `src/components/PhotoUploader.vue`: subida y previsualización.
  - `src/components/FaceGrid.vue`: grilla responsive.
  - `src/services/FaceService.js`: carga de modelos, detección, segmentación, recorte y punto de extensión `optimizePortrait`.

## Punto de extensión IA
`optimizePortrait(portraitDataUrl)` está listo para conectarse a un servicio externo que mejore contraste/nitidez/balance de blancos. Actualmente retorna la imagen sin cambios.

## Notas y solución de problemas
- Si ves “No se pudo segmentar la persona…” se usa el recorte básico sin máscara; revisa que los modelos BodyPix estén en `public/models/bodypix` y que el navegador tenga WebGL.  
- Warnings de “platform already set” provienen de tfjs al reutilizar backend; no afectan el flujo normal.  
- Si aparece 404 de algún modelo en consola, revisa nombres/rutas exactas y que Vite esté sirviendo la carpeta `public/models`.  
- Fondos complejos o personas pequeñas pueden segmentar peor; prueba fotos más cercanas y bien iluminadas.  
- Para producción, considera precargar modelos y optimizar pesos (quantized) si el tamaño importa.
