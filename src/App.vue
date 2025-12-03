<template>
  <div class="page">
    <header class="hero">
      <div class="hero__text">
        <p class="eyebrow">GridFaces · Vue 3</p>
        <h1>Arma grillas de retratos detectando rostros automáticamente</h1>
        <p class="lede">
          Sube varias fotos, detectamos los rostros con face-api.js, los recortamos en plano retrato y los
          acomodamos en una grilla responsive lista para usar.
        </p>
        <p class="hint">Modelos de detección: {{ modelStatus }}</p>
      </div>
    </header>

    <section class="panel">
      <!-- Configuración de modo -->
      <div class="config-section">
        <h3>⚙️ Configuración</h3>
        <div class="config-group">
          <label class="control">
            <input
              v-model="devMode"
              type="checkbox"
              aria-label="Modo desarrollo"
            />
            <span>Modo Desarrollo (BodyPix local)</span>
          </label>
          <p class="hint" v-if="devMode">Usa BodyPix sin consumir requests API</p>
          <p class="hint" v-else>Usa Remove.bg API (profesional)</p>
        </div>
        
        <div class="config-group" v-if="!devMode">
          <label class="control">
            <span>API Key Remove.bg</span>
            <input
              v-model="apiKey"
              type="password"
              placeholder="Ingresa tu API Key"
              aria-label="API Key Remove.bg"
              class="api-key-input"
            />
          </label>
          <p class="hint">Obtén una gratis en <a href="https://www.remove.bg/api" target="_blank">remove.bg/api</a></p>
        </div>
      </div>

      <PhotoUploader
        :disabled="isLoading"
        @files-selected="handleFiles"
      />
      <div class="controls">
        <label class="control">
          <span>Color de fondo</span>
          <input
            v-model="backgroundColor"
            type="color"
            aria-label="Color de fondo"
          />
        </label>
        <label class="control">
          <input
            v-model="isBlackAndWhite"
            type="checkbox"
            aria-label="Blanco y negro"
          />
          <span>Blanco y negro</span>
        </label>
        <label class="control">
          <input
            v-model="isHighContrast"
            type="checkbox"
            aria-label="Aumentar contraste"
          />
          <span>Aumentar contraste</span>
        </label>
        <button class="btn btn--secondary" @click="refreshPortraits" v-if="portraits.length > 0">
          🔄 Actualizar
        </button>
      </div>
      <div class="status">
        <p v-if="isLoading" class="pill pill--info">Procesando imágenes…</p>
        <p v-else class="pill pill--muted">Listo para procesar</p>
        <p v-if="errorMessage" class="pill pill--error">{{ errorMessage }}</p>
      </div>
    </section>

    <section v-if="portraits.length" class="panel">
      <div class="panel__header">
        <h2>Retratos detectados</h2>
        <p>{{ portraits.length }} rostro(s) listos en la grilla</p>
        <button class="btn btn--primary" @click="downloadAll">
          ⬇️ Descargar todos
        </button>
      </div>
      <FaceGrid 
        :key="faceGridKey"
        :portraits="portraits" 
        :isBlackAndWhite="isBlackAndWhite"
        :isHighContrast="isHighContrast"
        :backgroundColor="backgroundColor"
        @download="downloadPortrait"
      />
    </section>

    <section
      v-else-if="!isLoading && processedOnce"
      class="panel panel--ghost"
    >
      <p>No se detectaron rostros en las imágenes seleccionadas.</p>
      <p class="hint">Prueba con fotos más cercanas o bien iluminadas.</p>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import PhotoUploader from './components/PhotoUploader.vue';
import FaceGrid from './components/FaceGrid.vue';
import {
  ensureFaceApiReady,
  detectFaces,
  cropFacesToPortraits,
  setConfig,
} from './services/FaceService';

const isLoading = ref(false);
const errorMessage = ref('');
const modelStatus = ref('Cargando modelos…');
const processedOnce = ref(false);
const portraits = ref([]);
const backgroundColor = ref('#0f172a');
const isBlackAndWhite = ref(false);
const isHighContrast = ref(false);
const faceGridKey = ref(0); // Clave para forzar re-render del FaceGrid
const devMode = ref(import.meta.env.VITE_DEV_MODE === 'true');
const apiKey = ref(import.meta.env.VITE_REMOVEBG_API_KEY || '');

// Sincronizar cambios de configuración con FaceService
watch([devMode, apiKey], ([newMode, newKey]) => {
  setConfig({
    devMode: newMode,
    apiKey: newKey,
  });
  // Guardar API key en localStorage
  if (newKey) {
    localStorage.setItem('removebg_api_key', newKey);
  }
}, { immediate: true });

onMounted(async () => {
  try {
    // Cargar API key del localStorage si existe
    const savedApiKey = localStorage.getItem('removebg_api_key');
    if (savedApiKey && !apiKey.value) {
      apiKey.value = savedApiKey;
    }
    
    await ensureFaceApiReady();
    modelStatus.value = 'Modelos listos (TinyFaceDetector)';
  } catch (err) {
    // Si falla la carga de modelos, seguimos permitiendo subir imágenes para mostrar el flujo de errores.
    errorMessage.value = 'No se pudieron cargar los modelos de face-api.js. Verifica la carpeta /models.';
    modelStatus.value = 'Error al cargar modelos';
    console.error(err);
  }
});

/**
 * Maneja la selección de archivos desde el componente de subida.
 * - Filtra imágenes.
 * - Detecta rostros y recorta en formato retrato.
 */
async function handleFiles(files) {
  errorMessage.value = '';
  portraits.value = [];
  processedOnce.value = false;

  // Validar configuración en modo producción
  if (!devMode.value && !apiKey.value) {
    errorMessage.value = 'Por favor, ingresa tu API Key de Remove.bg en modo Producción.';
    return;
  }

  const validImages = Array.from(files || []).filter((file) =>
    file.type.startsWith('image/'),
  );

  if (!validImages.length) {
    errorMessage.value = 'Selecciona archivos de imagen válidos (jpg, png, etc.).';
    return;
  }

  isLoading.value = true;

  try {
    for (const file of validImages) {
      console.log(`📸 Procesando: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)}KB)`);
      const faces = await detectFaces(file);
      if (!faces.length) {
        console.log(`   → No se detectaron rostros`);
        continue;
      }

      console.log(`   → Se detectaron ${faces.length} rostro(s)`);
      const crops = await cropFacesToPortraits(file, faces, backgroundColor.value);
      portraits.value.push(
        ...crops.map((crop) => ({
          ...crop,
          sourceName: file.name,
        })),
      );
      console.log(`   → Generados ${crops.length} retrato(s)`);
    }

    if (!portraits.value.length) {
      errorMessage.value = 'No se detectaron rostros en las imágenes seleccionadas.';
    }
  } catch (err) {
    errorMessage.value = 'Ocurrió un error procesando las imágenes. Revisa la consola para más detalles.';
    console.error(err);
  } finally {
    processedOnce.value = true;
    isLoading.value = false;
  }
}

/**
 * Actualiza/reprocesa todas las imágenes
 */
function refreshPortraits() {
  // Cambia la clave para forzar que FaceGrid se vuelva a montar
  faceGridKey.value += 1;
}

/**
 * Descarga una imagen individual
 */
async function downloadPortrait(portrait, index, transparent = false) {
  let url = portrait.url;
  
  // Si se solicita PNG transparente, usar la URL transparente
  if (transparent) {
    url = portrait.urlTransparent || portrait.url; // Fallback a URL normal si no hay transparente
    const link = document.createElement('a');
    link.href = url;
    link.download = `retrato-${index + 1}-transparente.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }
  
  // Si no es transparente, aplicar filtros normales
  if (isBlackAndWhite.value || isHighContrast.value) {
    url = await applyFiltersToPhoto(portrait.url, backgroundColor.value);
  }
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `retrato-${index + 1}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Descarga todas las imágenes
 */
async function downloadAll() {
  for (let index = 0; index < portraits.value.length; index++) {
    await new Promise((resolve) => {
      setTimeout(() => {
        downloadPortrait(portraits.value[index], index).then(resolve);
      }, index * 200); // 200ms entre descargas
    });
  }
}

/**
 * Aplica filtros (B&N y/o contraste) a la foto para descarga
 * B&N solo se aplica a la foto, preserva el fondo de color
 */
async function applyFiltersToPhoto(imageUrl, bgColor) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      // Primero, rellena el fondo con el color
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Dibuja la imagen original encima
      ctx.drawImage(img, 0, 0);
      
      // Obtén los datos de la imagen
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Detecta el color de fondo más frecuente
      const bgDetected = detectMostFrequentColor(data);
      const bgTolerance = 25;
      
      // Procesa cada píxel
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        // Verifica si este píxel es del fondo
        const isLowAlpha = a < 100;
        const isSimilarColor = Math.abs(r - bgDetected.r) < bgTolerance &&
                               Math.abs(g - bgDetected.g) < bgTolerance &&
                               Math.abs(b - bgDetected.b) < bgTolerance;
        const isBg = isLowAlpha || isSimilarColor;
        
        // Si NO es fondo, aplica los filtros
        if (!isBg) {
          let newR = r;
          let newG = g;
          let newB = b;
          
          // Aplica B&N si está habilitado
          if (isBlackAndWhite.value) {
            const gray = r * 0.299 + g * 0.587 + b * 0.114;
            newR = gray;
            newG = gray;
            newB = gray;
          }
          
          // Aplica contraste si está habilitado
          if (isHighContrast.value) {
            newR = Math.min(255, Math.max(0, (newR - 128) * 1.5 + 128));
            newG = Math.min(255, Math.max(0, (newG - 128) * 1.5 + 128));
            newB = Math.min(255, Math.max(0, (newB - 128) * 1.5 + 128));
          }
          
          data[i] = newR;
          data[i + 1] = newG;
          data[i + 2] = newB;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Detecta el color más frecuente en una imagen (generalmente el fondo)
 */
function detectMostFrequentColor(data) {
  const colorCounts = {};
  const step = 4; // Toma cada 4to píxel para optimizar
  
  for (let i = 0; i < data.length; i += step * 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // Ignora píxeles totalmente transparentes
    if (a === 0) continue;
    
    // Redondea los valores de color para agrupar colores similares
    const key = `${Math.round(r / 10) * 10},${Math.round(g / 10) * 10},${Math.round(b / 10) * 10}`;
    colorCounts[key] = (colorCounts[key] || 0) + 1;
  }
  
  // Encuentra el color más frecuente
  let maxColor = { r: 0, g: 0, b: 0 };
  let maxCount = 0;
  
  Object.entries(colorCounts).forEach(([key, count]) => {
    if (count > maxCount) {
      maxCount = count;
      const [r, g, b] = key.split(',').map(Number);
      maxColor = { r, g, b };
    }
  });
  
  return maxColor;
}

// Cómo ejecutar este proyecto:
// 1) Instala dependencias: npm install
// 2) Inicia en desarrollo: npm run dev (Vite)
// 3) Copia los modelos de face-api.js a /public/models (TinyFaceDetector) para habilitar la detección.
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: radial-gradient(circle at 20% 20%, #0f172a 0, #0b1221 35%, #060b19 70%, #050816 100%);
  color: #e2e8f0;
  padding: 56px 16px 80px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.hero {
  max-width: 1024px;
  margin: 0 auto 32px;
  padding: 32px;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.14), rgba(56, 189, 248, 0.12));
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}

.hero__text h1 {
  font-size: clamp(26px, 3vw, 34px);
  margin: 8px 0;
  color: #f8fafc;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  color: #a5b4fc;
}

.lede {
  max-width: 720px;
  color: #cbd5e1;
}

.hint {
  color: #94a3b8;
  margin-top: 8px;
}

.panel {
  max-width: 1024px;
  margin: 0 auto 24px;
  padding: 20px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
}

.panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
}

.panel__header h2 {
  margin: 0;
  color: #e5e7eb;
}

.panel--ghost {
  text-align: center;
}

.status {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.control {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(148, 163, 184, 0.2);
  padding: 8px 12px;
  border-radius: 10px;
  color: #e2e8f0;
}

.control input[type='color'] {
  width: 42px;
  height: 32px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.pill {
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 13px;
  border: 1px solid transparent;
}

.pill--info {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.35);
  color: #bfdbfe;
}

.pill--muted {
  background: rgba(148, 163, 184, 0.12);
  border-color: rgba(148, 163, 184, 0.2);
  color: #e2e8f0;
}

.pill--error {
  background: rgba(248, 113, 113, 0.16);
  border-color: rgba(248, 113, 113, 0.35);
  color: #fecdd3;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(148, 163, 184, 0.2);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.btn--primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  color: white;
}

.btn--primary:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
  transform: translateY(-2px);
}

.btn--secondary {
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: #a7f3d0;
}

.btn--secondary:hover {
  background: rgba(16, 185, 129, 0.3);
  border-color: rgba(16, 185, 129, 0.6);
  transform: translateY(-2px);
}

.btn--sm {
  padding: 6px 10px;
  font-size: 12px;
}

.btn:hover {
  background: rgba(148, 163, 184, 0.3);
  transform: translateY(-1px);
}

@media (max-width: 640px) {
  .panel__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
