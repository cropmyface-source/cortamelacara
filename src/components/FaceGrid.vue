<template>
  <div>
    <div class="grid" :style="{ gridTemplateColumns: gridTemplate }">
      <figure v-for="(portrait, index) in portraits" :key="`${portrait.sourceName}-${index}`" class="card">
        <div class="card__image-wrapper">
          <img 
            :src="getProcessedImageUrl(portrait.url, index)" 
            :alt="`Retrato ${index + 1}`" 
            loading="lazy"
            class="card__image"
          />
          <div class="card__overlay">
            <button 
              class="btn btn--sm btn--download"
              @click="$emit('download', portrait, index)"
              title="Descargar"
            >
              ⬇️
            </button>
          </div>
        </div>
        <figcaption>
          <p class="caption-title">Retrato {{ index + 1 }}</p>
          <p class="caption-sub">{{ portrait.sourceName || 'Imagen' }}</p>
        </figcaption>
      </figure>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue';

const props = defineProps({
  portraits: {
    type: Array,
    default: () => [],
  },
  isBlackAndWhite: {
    type: Boolean,
    default: false,
  },
  isHighContrast: {
    type: Boolean,
    default: false,
  },
  backgroundColor: {
    type: String,
    default: '#0f172a',
  },
});

const emit = defineEmits(['download']);

// Cache para imágenes procesadas (B&N, contraste, etc)
const processedCache = ref({});

/**
 * Obtiene la URL de la imagen procesada (con B&N y/o contraste)
 */
function getProcessedImageUrl(imageUrl, index) {
  // Si no hay filtros activos, retorna la original
  if (!props.isBlackAndWhite && !props.isHighContrast) {
    return imageUrl;
  }
  
  // Crea una clave de cache única por imagen
  const cacheKey = `${index}-${props.isBlackAndWhite}-${props.isHighContrast}-${props.backgroundColor}-${imageUrl}`;
  
  if (processedCache.value[cacheKey]) {
    return processedCache.value[cacheKey];
  }
  
  // Inicia el procesamiento asíncrono
  if (!processedCache.value[`${cacheKey}-processing`]) {
    processedCache.value[`${cacheKey}-processing`] = true;
    processImageAsync(imageUrl, index, cacheKey);
  }
  
  return imageUrl; // Retorna original mientras se procesa
}

/**
 * Procesa la imagen de forma asíncrona y actualiza el cache
 */
async function processImageAsync(imageUrl, indexNum, cacheKey) {
  const canvas = document.createElement('canvas');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    
    // Primero, rellena el fondo con el color seleccionado
    ctx.fillStyle = props.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Dibuja la imagen original
    ctx.drawImage(img, 0, 0);
    
    // Obtén los datos de la imagen
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Detecta el color de fondo
    const bgColor = detectBackgroundColor(data, canvas.width, canvas.height);
    const bgTolerance = 25;
    
    // Procesa cada píxel
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // Verifica si este píxel es del fondo
      const isLowAlpha = a < 100;
      const isSimilarColor = Math.abs(r - bgColor.r) < bgTolerance &&
                             Math.abs(g - bgColor.g) < bgTolerance &&
                             Math.abs(b - bgColor.b) < bgTolerance;
      const isBg = isLowAlpha || isSimilarColor;
      
      // Si NO es fondo, aplica los filtros
      if (!isBg) {
        let newR = r;
        let newG = g;
        let newB = b;
        
        // Aplica B&N si está habilitado
        if (props.isBlackAndWhite) {
          const gray = r * 0.299 + g * 0.587 + b * 0.114;
          newR = gray;
          newG = gray;
          newB = gray;
        }
        
        // Aplica contraste si está habilitado
        if (props.isHighContrast) {
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
    const processedUrl = canvas.toDataURL('image/png');
    
    // Fuerza la reactividad con nextTick
    nextTick(() => {
      processedCache.value[cacheKey] = processedUrl;
    });
  };
  
  img.src = imageUrl;
}

// Cache para imágenes en B&N (mantener para compatibilidad si es necesario)
const bnwCache = ref({});

// Ajusta el número de columnas según la cantidad de retratos detectados.
const gridTemplate = computed(() => {
  const count = props.portraits.length;
  if (count <= 2) return 'repeat(auto-fit, minmax(260px, 1fr))';
  if (count <= 4) return 'repeat(2, minmax(220px, 1fr))';
  if (count <= 9) return 'repeat(3, minmax(180px, 1fr))';
  return 'repeat(auto-fit, minmax(160px, 1fr))';
});

/**
 * Detecta el color de fondo de la imagen (color más frecuente)
 */
function detectBackgroundColor(data, width, height) {
  // Toma una muestra de píxeles distribuida en toda la imagen
  // Asume que el fondo es el color más frecuente
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
</script>

<style scoped>
.grid {
  display: grid;
  gap: 14px;
  width: 100%;
}

.card {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
}

.card__image-wrapper {
  position: relative;
  overflow: hidden;
}

.card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  aspect-ratio: 3 / 4;
}

.card__overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.3s ease;
}

.card:hover .card__overlay {
  background: rgba(0, 0, 0, 0.5);
  opacity: 1;
}

.btn--download {
  padding: 8px 12px;
  font-size: 16px;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn--download:hover {
  background: white;
  transform: scale(1.1);
}

.caption-title {
  margin: 6px 0 0;
  color: #e2e8f0;
}

.caption-sub {
  margin: 2px 0 10px;
  color: #94a3b8;
  font-size: 13px;
}

figcaption {
  padding: 8px 10px 12px;
}
</style>
