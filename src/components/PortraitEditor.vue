<template>
  <Teleport to="body">
    <div v-if="isOpen" class="editor-overlay" @click.self="close">
      <div class="editor-modal" role="dialog" aria-modal="true" aria-label="Ajustar recorte">
        <div class="editor-header">
          <div>
            <h3>Ajustar recorte</h3>
            <p>Arrastrá la imagen y usá el zoom hasta que el encuadre te cierre.</p>
          </div>
          <button class="btn-icon" type="button" aria-label="Cerrar editor" @click="close">×</button>
        </div>

        <div class="editor-body">
          <div class="editor-stage">
            <div class="editor-frame editor-frame--checker">
              <canvas
                ref="canvasRef"
                class="editor-canvas"
                width="360"
                height="360"
                @pointerdown="startPan"
              />
            </div>
          </div>

          <div class="editor-controls">
            <label class="editor-control">
              <span>Zoom</span>
              <input
                v-model.number="zoom"
                type="range"
                min="60"
                max="180"
                step="1"
                @input="handleZoom"
              />
            </label>
            <p class="editor-hint">
              El encuadre final sale cuadrado y reemplaza el recorte automático solo para esta foto.
            </p>
          </div>
        </div>

        <div class="editor-footer">
          <button class="btn btn-muted" type="button" @click="reset">Reset</button>
          <button class="btn btn-muted" type="button" @click="close">Cancelar</button>
          <button class="btn btn-primary" type="button" @click="apply">Aplicar</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';

const VIEWPORT_SIZE = 360;
const MIN_CROP_SIZE = 80;

const emit = defineEmits(['apply', 'close']);

const isOpen = ref(false);
const canvasRef = ref(null);
const sourceImage = ref(null);
const sourceConfig = ref(null);
const cropBox = ref({ x: 0, y: 0, size: VIEWPORT_SIZE });
const initialCropBox = ref({ x: 0, y: 0, size: VIEWPORT_SIZE });
const baseCropSize = ref(VIEWPORT_SIZE);
const zoom = ref(100);

let dragPointerId = null;
let dragStartX = 0;
let dragStartY = 0;
let dragStartCropX = 0;
let dragStartCropY = 0;

async function openEditor(config) {
  sourceConfig.value = {
    backgroundColor: '#ffffff',
    outputWidth: 700,
    transparentOutput: false,
    ...config,
  };
  const image = await loadImage(config.imageUrl);
  sourceImage.value = image;

  const fallbackSize = Math.min(image.width, image.height);
  const nextCrop = clampCropBox(
    config.initialCrop || {
      x: (image.width - fallbackSize) / 2,
      y: (image.height - fallbackSize) / 2,
      size: fallbackSize,
    },
    image,
  );

  initialCropBox.value = { ...nextCrop };
  cropBox.value = { ...nextCrop };
  baseCropSize.value = nextCrop.size;
  zoom.value = 100;
  isOpen.value = true;

  requestAnimationFrame(() => {
    drawPreview();
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen para editar.'));
    img.src = url;
  });
}

function clampCropBox(box, image) {
  const maxSize = Math.min(image.width, image.height);
  const size = Math.max(MIN_CROP_SIZE, Math.min(box.size || maxSize, maxSize));
  const maxX = Math.max(0, image.width - size);
  const maxY = Math.max(0, image.height - size);
  return {
    x: Math.min(Math.max(0, box.x || 0), maxX),
    y: Math.min(Math.max(0, box.y || 0), maxY),
    size,
  };
}

function drawPreview() {
  if (!canvasRef.value || !sourceImage.value) return;
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    sourceImage.value,
    cropBox.value.x,
    cropBox.value.y,
    cropBox.value.size,
    cropBox.value.size,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

function handleZoom() {
  if (!sourceImage.value) return;
  const centerX = cropBox.value.x + cropBox.value.size / 2;
  const centerY = cropBox.value.y + cropBox.value.size / 2;
  const targetSize = Math.round(baseCropSize.value * (100 / zoom.value));
  cropBox.value = clampCropBox({
    x: centerX - targetSize / 2,
    y: centerY - targetSize / 2,
    size: targetSize,
  }, sourceImage.value);
  drawPreview();
}

function startPan(event) {
  if (!sourceImage.value) return;
  dragPointerId = event.pointerId;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  dragStartCropX = cropBox.value.x;
  dragStartCropY = cropBox.value.y;
  event.target.setPointerCapture?.(event.pointerId);
  event.target.addEventListener('pointermove', onPan);
  event.target.addEventListener('pointerup', stopPan);
  event.target.addEventListener('pointercancel', stopPan);
}

function onPan(event) {
  if (!sourceImage.value || dragPointerId !== event.pointerId) return;
  const scale = cropBox.value.size / VIEWPORT_SIZE;
  const nextX = dragStartCropX - (event.clientX - dragStartX) * scale;
  const nextY = dragStartCropY - (event.clientY - dragStartY) * scale;
  cropBox.value = clampCropBox({
    ...cropBox.value,
    x: nextX,
    y: nextY,
  }, sourceImage.value);
  drawPreview();
}

function stopPan(event) {
  if (dragPointerId !== event.pointerId) return;
  dragPointerId = null;
  event.target.releasePointerCapture?.(event.pointerId);
  event.target.removeEventListener('pointermove', onPan);
  event.target.removeEventListener('pointerup', stopPan);
  event.target.removeEventListener('pointercancel', stopPan);
}

function reset() {
  cropBox.value = { ...initialCropBox.value };
  zoom.value = 100;
  drawPreview();
}

function renderOutput({ transparent }) {
  if (!sourceImage.value || !sourceConfig.value) return null;
  const canvas = document.createElement('canvas');
  const outputWidth = Number(sourceConfig.value.outputWidth) || 700;
  canvas.width = outputWidth;
  canvas.height = outputWidth;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (!transparent) {
    ctx.fillStyle = sourceConfig.value.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(
    sourceImage.value,
    cropBox.value.x,
    cropBox.value.y,
    cropBox.value.size,
    cropBox.value.size,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvas.toDataURL('image/png');
}

function apply() {
  const urlTransparent = renderOutput({ transparent: true });
  const url = sourceConfig.value?.transparentOutput
    ? renderOutput({ transparent: false })
    : (urlTransparent || renderOutput({ transparent: false }));

  emit('apply', {
    url,
    urlTransparent: sourceConfig.value?.transparentOutput ? urlTransparent : null,
    cropBox: { ...cropBox.value },
  });
  close();
}

function close() {
  isOpen.value = false;
  emit('close');
}

defineExpose({
  openEditor,
});
</script>

<style scoped>
.editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

.editor-modal {
  width: min(680px, 94vw);
  background: #ffffff;
  border: 1px solid #e4e4e4;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
}

.editor-header,
.editor-footer {
  padding: 18px 20px;
}

.editor-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid #ececec;
}

.editor-header h3 {
  margin: 0;
  font-size: 22px;
  font-family: 'Montserrat', Arial, sans-serif;
}

.editor-header p {
  margin: 6px 0 0;
  color: #666666;
  font-size: 13px;
}

.btn-icon {
  border: none;
  background: transparent;
  color: #111111;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.editor-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 20px;
  padding: 20px;
}

.editor-stage {
  display: flex;
  justify-content: center;
}

.editor-frame {
  width: min(100%, 360px);
  aspect-ratio: 1;
  border: 1px solid #d7d7d7;
  overflow: hidden;
}

.editor-frame--checker {
  background-color: #f3f3f3;
  background-image:
    linear-gradient(45deg, #ebebeb 25%, transparent 25%),
    linear-gradient(-45deg, #ebebeb 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ebebeb 75%),
    linear-gradient(-45deg, transparent 75%, #ebebeb 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}

.editor-canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
  touch-action: none;
}

.editor-canvas:active {
  cursor: grabbing;
}

.editor-controls {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.editor-control {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
  font-weight: 700;
}

.editor-control input {
  width: 100%;
  accent-color: #d46060;
}

.editor-hint {
  margin: 0;
  color: #666666;
  font-size: 13px;
  line-height: 1.5;
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid #ececec;
}

.btn {
  border: 1px solid #d0d0d0;
  background: #ffffff;
  color: #111111;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.btn-primary {
  background: #111111;
  border-color: #111111;
  color: #ffffff;
}

@media (max-width: 720px) {
  .editor-body {
    grid-template-columns: 1fr;
  }

  .editor-stage {
    justify-content: stretch;
  }

  .editor-frame {
    width: 100%;
  }

  .editor-footer {
    flex-wrap: wrap;
  }

  .btn {
    flex: 1 1 140px;
  }
}
</style>
