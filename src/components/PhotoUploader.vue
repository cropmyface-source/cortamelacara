<template>
  <div class="uploader">
    <label class="drop" :class="{ 'drop--disabled': disabled }">
      <input
        class="input"
        type="file"
        multiple
        accept="image/*"
        :disabled="disabled"
        @change="onFilesChange"
      />
      <div class="drop__copy">
        <p class="eyebrow">Paso 1</p>
        <h3>Sube una o varias fotos</h3>
        <p class="hint">
          Formatos soportados: jpg, png, webp. Se detectarán todos los rostros encontrados en cada imagen.
        </p>
        <p class="cta">Haz click o arrastra los archivos aquí</p>
      </div>
    </label>

    <ul v-if="previews.length" class="file-list">
      <li v-for="file in previews" :key="file.name" class="file-item">
        <div class="file-item__thumb" v-if="file.preview">
          <img :src="file.preview" alt="" />
        </div>
        <div class="file-item__meta">
          <p class="file-name">{{ file.name }}</p>
          <p class="file-size">{{ formatSize(file.size) }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue';

const emit = defineEmits(['files-selected']);
const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
});

const previews = ref([]);

function formatSize(bytes) {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function revokePreviews() {
  previews.value.forEach((file) => {
    if (file.preview) {
      URL.revokeObjectURL(file.preview);
    }
  });
}

function onFilesChange(event) {
  const files = Array.from(event.target.files || []);
  revokePreviews();

  previews.value = files.map((file) => ({
    name: file.name,
    size: file.size,
    preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
  }));

  emit('files-selected', files);
}

onBeforeUnmount(() => {
  revokePreviews();
});
</script>

<style scoped>
.uploader {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.drop {
  position: relative;
  padding: 24px;
  border: 1.5px dashed rgba(148, 163, 184, 0.5);
  background: rgba(226, 232, 240, 0.02);
  border-radius: 14px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
  overflow: hidden;
}

.drop:hover {
  border-color: rgba(125, 211, 252, 0.8);
  background: rgba(14, 165, 233, 0.06);
}

.drop--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.drop__copy h3 {
  margin: 6px 0;
}

.cta {
  margin: 12px 0 0;
  color: #a5b4fc;
}

.input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.file-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.file-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.4);
}

.file-item__thumb {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(30, 41, 59, 0.8);
  flex-shrink: 0;
}

.file-item__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-name {
  margin: 0;
  color: #e2e8f0;
}

.file-size {
  margin: 2px 0 0;
  color: #94a3b8;
  font-size: 13px;
}
</style>
