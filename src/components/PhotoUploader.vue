<template>
  <div class="uploader">
    <label
      class="drop"
      :class="{ 'drop--disabled': disabled, 'drop--active': isDragActive }"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <input
        class="input"
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        :disabled="disabled"
        @change="onFilesChange"
      />
      <div class="drop__content">
        <button class="drop__button" type="button">SUBÍ TUS FOTOS</button>
        <span class="drop__text">O ARRASTRALAS ACÁ</span>
      </div>
    </label>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['files-selected']);
const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
});

const isDragActive = ref(false);

function onFilesChange(event) {
  const files = Array.from(event.target.files || []);
  emit('files-selected', files);
}

function onDragEnter() {
  if (props.disabled) return;
  isDragActive.value = true;
}

function onDragOver() {
  if (props.disabled) return;
  isDragActive.value = true;
}

function onDragLeave() {
  isDragActive.value = false;
}

function onDrop(event) {
  isDragActive.value = false;
  if (props.disabled) return;
  const files = Array.from(event.dataTransfer?.files || []);
  emit('files-selected', files);
}
</script>

<style scoped>
.uploader {
  width: 100%;
}

.drop {
  position: relative;
  border: none;
  border-radius: 11px;
  padding: 80px 24px 72px;
  text-align: center;
  background: #fafafa;
  cursor: pointer;
  width: 100%;
  min-height: 420px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 1210px;
  margin: auto;
  --dash-color: #d6d6d6;
}

.drop::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 11px;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='11' ry='11' stroke='%23d6d6d6' stroke-width='6' stroke-dasharray='4%2c 10' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
}

.drop--active {
  background: #fff6f6;
}

.drop--active::before {
  background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='11' ry='11' stroke='%23d46060' stroke-width='6' stroke-dasharray='4%2c 10' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
}

.drop--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.drop__content {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.drop__button {
  border: none;
  background: #d46060;
  color: #ffffff;
  padding: 18px 46px;
  border-radius: 999px;
  font-family: 'Roboto', Arial, sans-serif;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.06em;
}

.drop__text {
  color: #d46060;
  font-weight: 600;
  font-family: 'Roboto', Arial, sans-serif;
  font-size: 14px;
}

@media (max-width: 640px) {
  .drop__text {
    display: none;
  }
}

</style>
