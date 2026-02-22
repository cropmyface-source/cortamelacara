<template>
  <Teleport to="body">
    <div v-if="isOpen" class="editor-overlay" @click.self="close">
      <div class="editor-modal">
        <div class="editor-header">
          <h3>✏️ Editar Retrato</h3>
          <button class="btn-close" @click="close" aria-label="Cerrar editor">✕</button>
        </div>

        <div class="editor-body">
          <!-- Canvas preview -->
          <div class="canvas-wrapper">
            <canvas
              ref="canvasRef"
              class="editor-canvas"
              :style="{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              }"
            />
            <!-- Grid overlay -->
            <div v-if="showCropHandles" class="grid-overlay">
              <div class="grid-line grid-line-h1" />
              <div class="grid-line grid-line-h2" />
              <div class="grid-line grid-line-v1" />
              <div class="grid-line grid-line-v2" />
            </div>

            <!-- Crop area visualization -->
            <div v-if="showCropHandles" class="crop-visualization">
              <div class="crop-darken" />
              <div
                class="crop-rect"
                :style="{
                  left: cropRect.x + 'px',
                  top: cropRect.y + 'px',
                  width: cropRect.width + 'px',
                  height: cropRect.height + 'px',
                }"
              >
                <!-- Crop handles -->
                <div class="crop-handle handle-tl" @mousedown="startDrag('tl')" />
                <div class="crop-handle handle-tr" @mousedown="startDrag('tr')" />
                <div class="crop-handle handle-bl" @mousedown="startDrag('bl')" />
                <div class="crop-handle handle-br" @mousedown="startDrag('br')" />
              </div>
            </div>
          </div>

          <!-- Controls -->
          <div class="controls-section">
            <!-- Zoom control -->
            <div class="control-group">
              <label>🔍 Zoom: {{ zoom }}%</label>
              <input
                v-model.number="zoom"
                type="range"
                min="50"
                max="200"
                step="5"
                class="slider"
              />
            </div>

            <!-- Rotation control -->
            <div class="control-group">
              <label>🔄 Rotación: {{ rotation }}°</label>
              <input
                v-model.number="rotation"
                type="range"
                min="0"
                max="360"
                step="5"
                class="slider"
              />
            </div>

            <!-- Crop toggle -->
            <div class="control-group">
              <button
                class="btn-toggle"
                :class="{ active: showCropHandles }"
                @click="showCropHandles = !showCropHandles"
              >
                {{ showCropHandles ? '✓ Crop activo' : '□ Activar crop' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Footer buttons -->
        <div class="editor-footer">
          <button class="btn btn-reset" @click="reset">↺ Resetear</button>
          <button class="btn btn-cancel" @click="close">✕ Cancelar</button>
          <button class="btn btn-apply" @click="apply">✓ Aplicar Cambios</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const isOpen = ref(false);
const canvasRef = ref(null);
const zoom = ref(100);
const rotation = ref(0);
const showCropHandles = ref(false);
const cropRect = ref({ x: 50, y: 50, width: 150, height: 150 });
const originalImage = ref(null);
const sourceImageUrl = ref('');
const isDragging = ref(false);
const dragHandle = ref(null);
const dragStartX = ref(0);
const dragStartY = ref(0);

// Emit events
const emit = defineEmits(['apply', 'close']);

/**
 * Abre el editor con una imagen
 */
async function openEditor(imageUrl) {
  sourceImageUrl.value = imageUrl;
  isOpen.value = true;

  // Espera a que el DOM se renderice
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Carga la imagen
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    originalImage.value = img;
    drawCanvas();
  };
  img.src = imageUrl;
}

/**
 * Dibuja el canvas con la imagen y transformaciones
 */
function drawCanvas() {
  if (!canvasRef.value || !originalImage.value) return;

  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');

  // Limpia el canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dibuja la imagen con transformaciones
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation.value * Math.PI) / 180);
  ctx.scale(zoom.value / 100, zoom.value / 100);
  ctx.drawImage(
    originalImage.value,
    -originalImage.value.width / 2,
    -originalImage.value.height / 2,
  );
  ctx.restore();
}

/**
 * Inicia el arrastre de un handle de crop
 */
function startDrag(handle) {
  isDragging.value = true;
  dragHandle.value = handle;
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
}

/**
 * Maneja el arrastre de handles de crop
 */
function onDrag(e) {
  if (!isDragging.value) return;

  const deltaX = e.clientX - dragStartX.value;
  const deltaY = e.clientY - dragStartY.value;

  dragStartX.value = e.clientX;
  dragStartY.value = e.clientY;

  const handle = dragHandle.value;
  const minSize = 50;

  if (handle === 'tl') {
    cropRect.value.x = Math.max(0, cropRect.value.x + deltaX);
    cropRect.value.y = Math.max(0, cropRect.value.y + deltaY);
    cropRect.value.width = Math.max(minSize, cropRect.value.width - deltaX);
    cropRect.value.height = Math.max(minSize, cropRect.value.height - deltaY);
  } else if (handle === 'tr') {
    cropRect.value.y = Math.max(0, cropRect.value.y + deltaY);
    cropRect.value.width = Math.max(minSize, cropRect.value.width + deltaX);
    cropRect.value.height = Math.max(minSize, cropRect.value.height - deltaY);
  } else if (handle === 'bl') {
    cropRect.value.x = Math.max(0, cropRect.value.x + deltaX);
    cropRect.value.width = Math.max(minSize, cropRect.value.width - deltaX);
    cropRect.value.height = Math.max(minSize, cropRect.value.height + deltaY);
  } else if (handle === 'br') {
    cropRect.value.width = Math.max(minSize, cropRect.value.width + deltaX);
    cropRect.value.height = Math.max(minSize, cropRect.value.height + deltaY);
  }
}

/**
 * Detiene el arrastre
 */
function stopDrag() {
  isDragging.value = false;
  dragHandle.value = null;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
}

/**
 * Aplica los cambios y emite el evento
 */
async function apply() {
  if (!canvasRef.value) return;

  // Si crop está activo, recorta la imagen
  if (showCropHandles.value) {
    const canvas = document.createElement('canvas');
    canvas.width = cropRect.value.width;
    canvas.height = cropRect.value.height;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation.value * Math.PI) / 180);
    ctx.scale(zoom.value / 100, zoom.value / 100);

    // Dibuja desde el canvas renderizado
    const sourceCanvas = canvasRef.value;
    const sourceCtx = sourceCanvas.getContext('2d');
    const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    ctx.putImageData(imageData, -cropRect.value.x, -cropRect.value.y);

    ctx.restore();
    emit('apply', canvas.toDataURL('image/png'));
  } else {
    // Si no hay crop, solo zoom y rotación
    emit('apply', canvasRef.value.toDataURL('image/png'));
  }

  close();
}

/**
 * Resetea todos los valores
 */
function reset() {
  zoom.value = 100;
  rotation.value = 0;
  showCropHandles.value = false;
  cropRect.value = { x: 50, y: 50, width: 150, height: 150 };
  if (originalImage.value) {
    drawCanvas();
  }
}

/**
 * Cierra el editor
 */
function close() {
  isOpen.value = false;
  emit('close');
  // Limpia listeners
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
}

// Dibuja cuando cambian zoom o rotación
onMounted(() => {
  const observer = new MutationObserver(() => {
    if (isOpen.value) {
      drawCanvas();
    }
  });
});

// Expone métodos
defineExpose({
  openEditor,
});
</script>

<style scoped>
.editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.editor-modal {
  background: #1e293b;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  max-width: 600px;
  width: 90vw;
  max-height: 90vh;
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.editor-header h3 {
  margin: 0;
  color: #e2e8f0;
  font-size: 16px;
  font-weight: 600;
}

.btn-close {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  transition: color 0.2s ease;
}

.btn-close:hover {
  color: #e2e8f0;
}

.editor-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  overflow-y: auto;
}

.canvas-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 2px dashed rgba(148, 163, 184, 0.3);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.editor-canvas {
  max-width: 100%;
  max-height: 100%;
  transition: transform 0.1s ease;
}

.grid-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.grid-line {
  position: absolute;
  background: rgba(148, 163, 184, 0.2);
}

.grid-line-h1,
.grid-line-h2 {
  width: 100%;
  height: 1px;
  left: 0;
}

.grid-line-h1 {
  top: calc(100% / 3);
}

.grid-line-h2 {
  top: calc(200% / 3);
}

.grid-line-v1,
.grid-line-v2 {
  width: 1px;
  height: 100%;
  top: 0;
}

.grid-line-v1 {
  left: calc(100% / 3);
}

.grid-line-v2 {
  left: calc(200% / 3);
}

.crop-visualization {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.crop-darken {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  pointer-events: none;
}

.crop-rect {
  position: absolute;
  border: 2px solid #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
  cursor: move;
}

.crop-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #10b981;
  border: 2px solid white;
  border-radius: 50%;
  cursor: nwse-resize;
  pointer-events: auto;
}

.handle-tl {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}

.handle-tr {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}

.handle-bl {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}

.handle-br {
  bottom: -6px;
  right: -6px;
  cursor: nwse-resize;
}

.controls-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(30, 41, 59, 0.5);
  padding: 12px;
  border-radius: 8px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.control-group label {
  color: #cbd5e1;
  font-size: 13px;
  font-weight: 500;
}

.slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(148, 163, 184, 0.2);
  outline: none;
  appearance: none;
  -webkit-appearance: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  background: #2563eb;
  transform: scale(1.2);
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.slider::-moz-range-thumb:hover {
  background: #2563eb;
  transform: scale(1.2);
}

.btn-toggle {
  padding: 8px 12px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(148, 163, 184, 0.1);
  color: #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.btn-toggle.active {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.5);
  color: #a7f3d0;
}

.btn-toggle:hover {
  background: rgba(148, 163, 184, 0.15);
}

.editor-footer {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  justify-content: flex-end;
}

.btn {
  padding: 8px 14px;
  border-radius: 6px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-reset {
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.btn-reset:hover {
  background: rgba(148, 163, 184, 0.3);
  color: #e2e8f0;
}

.btn-cancel {
  background: rgba(248, 113, 113, 0.1);
  color: #fecdd3;
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.btn-cancel:hover {
  background: rgba(248, 113, 113, 0.15);
  color: #fee2e2;
}

.btn-apply {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
}

.btn-apply:hover {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

@media (max-width: 640px) {
  .editor-modal {
    max-width: 95vw;
    max-height: 95vh;
  }

  .editor-footer {
    flex-direction: column-reverse;
    gap: 8px;
  }

  .btn {
    flex: 1;
  }
}
</style>
