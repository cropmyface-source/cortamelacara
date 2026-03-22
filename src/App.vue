<template>
  <div class="page">
    <!--
    <div class="adsense-wrapper">
      <div class="adsense-placeholder">
        <span class="adsense-placeholder__label">PUBLICIDAD</span>
        <div class="adsense-placeholder__card">
          <div class="adsense-placeholder__media"></div>
          <div class="adsense-placeholder__copy">
            <div class="adsense-placeholder__title">Espacio publicitario</div>
            <div class="adsense-placeholder__text">
              Anuncio responsivo 970x250 (placeholder)
            </div>
            <div class="adsense-placeholder__meta">
              <span>AdSense</span>
              <span>Ver</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    -->
    <div
      v-if="!originalFiles.length"
      class="brand-header"
      :class="{ 'brand-header--explainer': !originalFiles.length }"
    >
      <div class="brand-header__inner">
        <div class="brand-copy">
          <div class="brand brand--image">
            <a class="brand__link" href="/" @click.prevent="resetAll">
              <img class="brand__logo-home" :src="logoHome" alt="cortame la cara" />
            </a>
          </div>
          <h1 v-if="!originalFiles.length" class="hero__lede hero__lede--lead">
            Recorte de rostro y eliminación de fondo online.
            <span class="hero__lede__rest">
              Subí varias fotos juntas, nosotros recortamos la cara, quitamos el fondo y descargás
              cada imagen lista para usar.
            </span>
          </h1>
        </div>
        <div v-if="!originalFiles.length" class="hero__steps">
          <template v-for="(item, index) in explainerImages" :key="item.title">
            <div class="step" :class="{ 'step--small': index > 0 }">
              <p class="step__title">
                <strong>{{ item.title }}</strong> {{ item.subtitle }}
              </p>
              <img :src="item.src" :alt="item.alt" />
            </div>
            <span v-if="index < explainerImages.length - 1" class="step__plus">+</span>
          </template>
        </div>
      </div>
    </div>

    <section v-if="!originalFiles.length" class="upload-section upload-section--full">
      <div class="upload-area">
        <div class="upload-frame">
          <PhotoUploader
            :disabled="isProcessing"
            @files-selected="handleFiles"
          />
          <div
            v-if="invalidFilesCount"
            class="upload-warning"
            :class="{ 'upload-warning--solid': !originalFiles.length }"
          >
            <div class="upload-warning__inner">
              <img :src="warningIcon" alt="" />
              <p>{{ invalidLabel }}</p>
              <span
                v-if="originalFiles.length"
                class="upload-warning__hint"
              >
                Formatos soportados: jpg, png, webp
              </span>
            </div>
          </div>
        </div>
      </div>
      <p class="upload-section__formats">Formatos soportados: jpg, png, webp</p>
      <p class="upload-note">NO GUARDAMOS TUS FOTOS</p>
    </section>

    <section v-if="originalFiles.length" class="workspace">
      <aside class="workspace__sidebar">
        <div class="brand brand--image brand--sidebar">
          <a class="brand__link" href="/" @click.prevent="resetAll">
            <img :src="logoShort" alt="cortame la cara" />
          </a>
        </div>
        <div class="settings-panel">
          <p class="settings-panel__title">QUE QUERES HACER</p>

          <label class="check check--block">
            <input type="checkbox" v-model="cropFace" />
            <span>Recortar caras</span>
          </label>

          <div class="settings-panel__divider"></div>

          <label class="check check--block">
            <input type="checkbox" v-model="removeBackground" />
            <span>Eliminar el fondo</span>
          </label>

          <div v-if="removeBackground" class="settings__apikey">
            <input
              v-model="apiKey"
              type="password"
              placeholder="API KEY"
            />
            <div class="settings__apikey-status-slot">
              <p
                v-show="apiKeyStatus === 'valid'"
                class="settings__apikey-status settings__apikey-status--valid"
              >
                API KEY VALIDA
              </p>
              <p
                v-show="apiKeyStatus === 'invalid'"
                class="settings__apikey-status settings__apikey-status--invalid"
              >
                API KEY INVALIDA
              </p>
              <p
                v-show="apiKeyStatus === 'credits'"
                class="settings__apikey-status settings__apikey-status--invalid"
              >
                CREDITOS AGOTADOS
              </p>
            </div>
          </div>

          <div v-if="removeBackground && !apiKey" class="settings-warning">
            Para eliminar el fondo tenes que usar una API Key personal de remove_bg.
            Obtenela gratis <a href="https://www.remove.bg/api" target="_blank" rel="noreferrer">aca</a>
          </div>

          <div class="settings-panel__divider"></div>

          <div v-if="removeBackground" class="settings-panel__group">
            <label class="color color--block">
              <input
                v-model="backgroundColor"
                type="color"
                aria-label="Fondo de la foto"
                :disabled="downloadTransparent"
              />
              <span>Color de Fondo</span>
            </label>

            <label class="check check--block">
              <input v-model="downloadTransparent" type="checkbox" />
              <span>Transparente</span>
            </label>
          </div>

          <div v-if="removeBackground" class="settings-panel__divider"></div>

          <button
            v-if="!isProcessed"
            class="action-button action-button--full"
            :class="{ 'action-button--loading': isProcessing }"
            :disabled="!originalFiles.length || isProcessing"
            @click="handleProcess"
          >
            <span
              v-if="isProcessing"
              class="action-button__progress"
              :style="{ width: `${progress}%` }"
            ></span>
            <span class="action-button__label">{{ processLabel }}</span>
          </button>


          <div class="settings-panel__footer">
            <button class="secondary-button" @click="resetAll">RESET</button>
          </div>
        </div>
      </aside>

      <div class="workspace__preview">
        <div class="preview-panel" :class="{ 'preview-panel--processed': isProcessed }">
          <div class="preview-panel__header">
            <p class="preview-panel__title">{{ batchLabel }}</p>
            <div class="preview-panel__controls">
              <div class="preview-panel__size">
                <span class="preview-panel__size-label">Tamaño de descarga</span>
                <div class="preview-panel__size-row">
                  <input
                    v-model.number="outputSize"
                    type="number"
                    min="1"
                    step="1"
                  />
                  <span>px de ancho</span>
                </div>
              </div>
              <button
                v-if="isProcessed"
                class="download-button download-button--top"
                :disabled="isProcessing"
                @click="downloadAll"
              >
                DESCARGAR FOTOS
                <img class="download-button__icon" :src="downloadIcon" alt="" />
              </button>
            </div>
          </div>
          <div class="preview-panel__content" :class="{ 'preview-panel__content--single': !isProcessed }">
            <TransitionGroup name="thumb" tag="div" class="thumb-grid" appear>
              <article
                v-for="(item, index) in displayItems"
                :key="item.id"
                class="thumb-card"
                :style="{ transitionDelay: `${index * 60}ms` }"
              >
                <div
                  class="thumb-card__image"
                  :class="{ 'thumb-card__image--transparent': showTransparentPreview }"
                  :style="getThumbBackground(item)"
                >
                  <img
                    class="thumb-card__img thumb-card__img--raw"
                    :class="{ 'thumb-card__img--fade': isProcessed && item.crossfade }"
                    :src="item.rawUrl"
                    :alt="item.name"
                  />
                  <div
                    v-if="item.crossfade"
                    class="thumb-card__wash"
                    :class="{ 'thumb-card__wash--on': isProcessed }"
                  ></div>
                  <img
                    v-if="item.processedUrl"
                    class="thumb-card__img thumb-card__img--processed"
                    :class="{ 'thumb-card__img--show': isProcessed && item.crossfade }"
                    :style="processedImageStyle"
                    :src="item.processedUrl"
                    :alt="item.name"
                  />
                </div>
                <div class="thumb-card__meta">
                  <p class="thumb-card__name">{{ item.name }}</p>
                  <p class="thumb-card__size">{{ item.sizeLabel }}</p>
                  <button
                    v-if="isProcessed"
                    class="thumb-card__download"
                    type="button"
                    @click="downloadPortrait(item, index, downloadTransparent)"
                  >
                    <img :src="downloadIcon" alt="" />
                  </button>
                </div>
              </article>
            </TransitionGroup>

            <div v-if="invalidFilesCount" class="upload-warning upload-warning--panel">
              <div class="upload-warning__inner">
                <img :src="warningIcon" alt="" />
                <p>{{ invalidLabel }}</p>
                <span class="upload-warning__hint">Formatos soportados: jpg, png, webp</span>
              </div>
            </div>

            <aside v-if="isProcessed" class="filters-panel">
              <h3 class="filters-panel__title">AJUSTES</h3>

              <label class="filters-panel__option">
                <input v-model="filterBn" type="checkbox" />
                <span>Cara en blanco y negro</span>
              </label>

              <div class="filters-panel__divider"></div>

              <label class="filters-panel__option">
                <input v-model="filterMultiply" type="checkbox" />
                <span>Fundido con el fondo</span>
              </label>

              <div class="filters-panel__divider"></div>

              <div class="filters-panel__slider">
                <span class="filters-panel__label">Exposición</span>
                <input
                  v-model.number="exposure"
                  type="range"
                  min="50"
                  max="150"
                  step="1"
                />
              </div>

              <div class="filters-panel__slider">
                <span class="filters-panel__label">Brillo</span>
                <input
                  v-model.number="brightness"
                  type="range"
                  min="50"
                  max="150"
                  step="1"
                />
              </div>

              <div class="filters-panel__slider">
                <span class="filters-panel__label">Contraste</span>
                <input
                  v-model.number="contrast"
                  type="range"
                  min="50"
                  max="150"
                  step="1"
                />
              </div>

              <div class="filters-panel__slider">
                <span class="filters-panel__label">Luces</span>
                <input
                  v-model.number="highlights"
                  type="range"
                  min="50"
                  max="150"
                  step="1"
                />
              </div>

              <div class="filters-panel__slider">
                <span class="filters-panel__label">Sombras</span>
                <input
                  v-model.number="shadows"
                  type="range"
                  min="50"
                  max="150"
                  step="1"
                />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

    <footer class="site-footer">
      <div class="site-footer__inner">
        <div class="site-footer__column">
          <h3>Acerca</h3>
          <p>
            FaceCut es una herramienta online para recortar rostros y eliminar fondos en segundos.
            Procesa lotes de fotos sin instalar nada.
          </p>
        </div>
        <div class="site-footer__column">
          <h3>Quienes somos</h3>
          <p>
            Somos un equipo que crea microherramientas simples para tareas puntuales.
            Buscamos resultados claros con el menor esfuerzo.
          </p>
        </div>
        <div class="site-footer__column">
          <h3>Faq</h3>
          <p>
            Soporta JPG, PNG y WEBP. Tus fotos se procesan localmente y no se guardan.
            Para eliminar fondo necesitas una API key de remove.bg.
          </p>
        </div>
        <div class="site-footer__column">
          <h3>Casos de uso</h3>
          <p>
            Fotos para CV, perfiles de redes, ecommerce, credenciales, equipos de trabajo
            y catálogos internos.
          </p>
        </div>
      </div>
      <div class="site-footer__bottom">
        <p class="site-footer__credit">
          Este es un proyecto de ONE TASK APP. Copyright {{ currentYear }}.
        </p>
        <button class="site-footer__contact" type="button" @click="showContact = true">
          Contacto
        </button>
      </div>
      <div class="site-footer__legal">
        <button type="button" @click="showPrivacy = true">Privacidad</button>
        <button type="button" @click="showTerms = true">Términos</button>
      </div>
    </footer>
  </div>

  <div v-if="showContact" class="contact-modal">
    <div class="contact-modal__backdrop" @click="showContact = false"></div>
    <div class="contact-modal__card" role="dialog" aria-modal="true" aria-label="Contacto">
      <button class="contact-modal__close" type="button" @click="showContact = false">×</button>
      <h3>Contacto</h3>
      <form class="contact-modal__form" @submit.prevent="sendContact">
        <label>
          Nombre
          <input v-model="contactName" type="text" placeholder="Tu nombre" />
        </label>
        <label>
          Email
          <input v-model="contactEmail" type="email" placeholder="tu@email.com" />
        </label>
        <label>
          Mensaje
          <textarea v-model="contactMessage" rows="4" placeholder="Contanos en qué te ayudamos"></textarea>
        </label>
        <button class="contact-modal__submit" type="submit">Enviar</button>
      </form>
    </div>
  </div>

  <div v-if="showPrivacy" class="contact-modal">
    <div class="contact-modal__backdrop" @click="showPrivacy = false"></div>
    <div class="contact-modal__card" role="dialog" aria-modal="true" aria-label="Privacidad">
      <button class="contact-modal__close" type="button" @click="showPrivacy = false">×</button>
      <h3>Política de Privacidad</h3>
      <div class="contact-modal__body">
        <p>
          FaceCut procesa las imágenes en el navegador del usuario. No almacenamos ni compartimos
          fotos en servidores propios.
        </p>
        <p>
          Si el usuario activa la eliminación de fondo con remove.bg, la imagen se envía a ese
          servicio de terceros para su procesamiento. El tratamiento se rige por la política de
          privacidad de remove.bg.
        </p>
        <p>
          Podemos utilizar cookies y tecnologías similares para mejorar la experiencia y, cuando
          corresponda, para la entrega de anuncios. Podés gestionar tu consentimiento desde el
          banner de cookies.
        </p>
      </div>
    </div>
  </div>

  <div v-if="showTerms" class="contact-modal">
    <div class="contact-modal__backdrop" @click="showTerms = false"></div>
    <div class="contact-modal__card" role="dialog" aria-modal="true" aria-label="Términos">
      <button class="contact-modal__close" type="button" @click="showTerms = false">×</button>
      <h3>Términos y Condiciones</h3>
      <div class="contact-modal__body">
        <p>
          El servicio se ofrece "tal cual", sin garantías de ningún tipo, explícitas o implícitas,
          incluyendo, entre otras, las garantías de disponibilidad, exactitud o idoneidad para un
          propósito particular.
        </p>
        <p>
          El usuario declara contar con los derechos necesarios sobre las imágenes que sube y
          asume plena responsabilidad por su contenido.
        </p>
      </div>
    </div>
  </div>

  <!--
  <div v-if="showCookieBanner" class="cookie-banner">
    <p>
      Usamos cookies para mejorar la experiencia y, si corresponde, mostrar anuncios. Podés aceptar
      o rechazar.
    </p>
    <div class="cookie-banner__actions">
      <button class="cookie-banner__button" type="button" @click="setCookieConsent('accepted')">
        Aceptar
      </button>
      <button class="cookie-banner__button cookie-banner__button--ghost" type="button" @click="setCookieConsent('rejected')">
        Rechazar
      </button>
    </div>
  </div>
  -->
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import PhotoUploader from './components/PhotoUploader.vue';
import explainerOne from './assets/image 1.png';
import explainerTwo from './assets/image 2.png';
import explainerThree from './assets/image 3.png';
import logoHome from './assets/logoOkHome.png';
import logoShort from './assets/LogoOKShort.png';
import downloadIcon from './assets/descargar.svg';
import warningIcon from './assets/warning.svg';
import {
  ensureFaceApiReady,
  detectFaces,
  cropFacesToPortraits,
  removeBackgroundFromFile,
  resizeImageFile,
  validateRemoveBgKey,
  setConfig,
} from './services/FaceService';

const errorMessage = ref('');
const originalFiles = ref([]);
const processedFiles = ref([]);
const isProcessing = ref(false);
const isProcessed = ref(false);
const progress = ref(0);
const apiKeyStatus = ref('idle');
const invalidFilesCount = ref(0);

const backgroundColor = ref('#fff35a');
const cropFace = ref(true);
const removeBackground = ref(false);
const downloadTransparent = ref(false);
const filterBn = ref(false);
const filterMultiply = ref(false);
const exposure = ref(100);
const brightness = ref(100);
const contrast = ref(100);
const highlights = ref(100);
const shadows = ref(100);
const outputSize = ref(Number(import.meta.env.VITE_OUTPUT_SIZE || 700));
const apiKey = ref(import.meta.env.VITE_REMOVEBG_API_KEY || '');
const devMode = ref(import.meta.env.VITE_DEV_MODE === 'true');
const currentYear = new Date().getFullYear();
const showContact = ref(false);
const showPrivacy = ref(false);
const showTerms = ref(false);
// const showCookieBanner = ref(false);
const contactName = ref('');
const contactEmail = ref('');
const contactMessage = ref('');
let processingRunId = 0;
let uploadSessionId = 0;
const debugProcessing = import.meta.env.DEV;

const processLabel = computed(() => {
  if (isProcessing.value) return 'PROCESANDO';
  return 'PROCESAR';
});

const showTransparentPreview = computed(() =>
  Boolean(isProcessed.value && downloadTransparent.value),
);

const batchLabel = computed(() => {
  const count = originalFiles.value.length;
  return `LOTE DE ${count} FOTO${count === 1 ? '' : 'S'}`;
});

const invalidLabel = computed(() => {
  const count = invalidFilesCount.value;
  if (!count) return '';
  return `${count} IMAGEN${count === 1 ? '' : 'ES'} CON FORMATO INVALIDO`;
});

const previewFilter = computed(() => {
  const filters = [];
  if (exposure.value !== 100) filters.push(`brightness(${exposure.value}%)`);
  if (brightness.value !== 100) filters.push(`brightness(${brightness.value}%)`);
  if (contrast.value !== 100) filters.push(`contrast(${contrast.value}%)`);
  if (highlights.value !== 100) filters.push(`brightness(${highlights.value}%)`);
  if (shadows.value !== 100) filters.push(`contrast(${shadows.value}%)`);
  if (filterBn.value) filters.push('grayscale(1)');
  return filters.length ? filters.join(' ') : 'none';
});

const activeMultiply = computed(() => filterMultiply.value && !downloadTransparent.value);

const processedImageStyle = computed(() => ({
  filter: previewFilter.value,
  mixBlendMode: activeMultiply.value ? 'multiply' : 'normal',
}));

const explainerImages = [
  { title: 'Subí', subtitle: 'varias fotos', src: explainerOne, alt: 'Ejemplo de fotos' },
  { title: 'Recortá', subtitle: 'la cara', src: explainerTwo, alt: 'Ejemplo de encuadre' },
  { title: 'Descargá', subtitle: 'sin fondo', src: explainerThree, alt: 'Ejemplo de resultado' },
];

const displayItems = computed(() => {
  const processedBySourceId = new Map();
  processedFiles.value.forEach((item) => {
    const key = item.sourceId || item.id || item.name || 'output';
    if (!processedBySourceId.has(key)) {
      processedBySourceId.set(key, []);
    }
    processedBySourceId.get(key).push(item);
  });

  const baseItems = originalFiles.value.map((item, index) => {
    const bucket = processedBySourceId.get(item.sourceId) || [];
    const primary = bucket.shift();
    if (bucket.length) {
      processedBySourceId.set(item.sourceId, bucket);
    } else {
      processedBySourceId.delete(item.sourceId);
    }

    const rawUrl = item.url;
    let processedUrl = null;
    let url = rawUrl;
    let urlTransparent = rawUrl;
    let hasTransparent = false;
    let crossfade = false;

    if (primary) {
      const mode = primary.mode || 'original';
      const supportsTransparency = mode === 'crop-remove-bg' || mode === 'remove-bg';
      url = primary.url;
      urlTransparent = supportsTransparency
        ? (primary.urlTransparent || primary.url)
        : primary.url;
      processedUrl = supportsTransparency
        ? (primary.urlTransparent || primary.url)
        : primary.url;
      hasTransparent = supportsTransparency;
      crossfade = true;
    }

    return {
      id: item.id || `${item.name}-${index}`,
      name: item.name,
      mode: primary?.mode || 'original',
      sizeLabel: item.sizeLabel,
      url,
      urlTransparent,
      rawUrl,
      processedUrl,
      hasTransparent,
      crossfade,
    };
  });

  const extraItems = [];
  processedBySourceId.forEach((items) => {
    items.forEach((item, index) => {
      const mode = item.mode || 'unknown';
      const supportsTransparency = mode === 'crop-remove-bg' || mode === 'remove-bg';
      const url = item.url;
      const urlTransparent = supportsTransparency
        ? (item.urlTransparent || item.url)
        : item.url;
      const processedUrl = supportsTransparency
        ? (item.urlTransparent || item.url)
        : item.url;
      const hasTransparent = supportsTransparency;
      extraItems.push({
        id: item.id || `${item.sourceId || item.name || 'output'}-extra-${index}`,
        name: item.name,
        mode: item.mode || 'unknown',
        sizeLabel: item.sizeLabel,
        url,
        urlTransparent,
        rawUrl: processedUrl,
        processedUrl,
        hasTransparent,
        crossfade: true,
      });
    });
  });

  return [...baseItems, ...extraItems];
});

watch(displayItems, (items) => {
  logProcessing('display-items', items.map((item) => ({
    id: item.id,
    name: item.name,
    mode: item.mode,
    hasTransparent: item.hasTransparent,
    crossfade: item.crossfade,
    rawUrlPrefix: item.rawUrl?.slice(0, 48),
    processedUrlPrefix: item.processedUrl?.slice(0, 48),
  })));
});

watch([devMode, apiKey, outputSize], ([newMode, newKey, newOutputSize]) => {
  setConfig({
    devMode: newMode,
    apiKey: newKey,
    outputSize: Number(newOutputSize || 1),
  });
  if (newKey) {
    localStorage.setItem('removebg_api_key', newKey);
  } else {
    localStorage.removeItem('removebg_api_key');
  }
  localStorage.setItem('output_size', String(newOutputSize || 1));
}, { immediate: true });

let apiKeyTimer;
watch([apiKey, removeBackground], ([newKey, enabled]) => {
  apiKeyStatus.value = 'idle';
  if (!enabled || !newKey) return;

  clearTimeout(apiKeyTimer);
  apiKeyStatus.value = 'checking';
  apiKeyTimer = setTimeout(async () => {
  const result = await validateRemoveBgKey(newKey);
  if (result === null) {
    apiKeyStatus.value = 'idle';
    return;
  }
  if (result === 'credits') {
    apiKeyStatus.value = 'credits';
    return;
  }
  apiKeyStatus.value = result ? 'valid' : 'invalid';
}, 500);
});

watch(
  [cropFace, removeBackground],
  ([newCrop, newRemove], [oldCrop, oldRemove]) => {
    const modeChanged = newCrop !== oldCrop || newRemove !== oldRemove;
    if (!modeChanged) return;
    logProcessing('mode-changed', {
      from: { cropFace: oldCrop, removeBackground: oldRemove },
      to: { cropFace: newCrop, removeBackground: newRemove },
      isProcessing: isProcessing.value,
      isProcessed: isProcessed.value,
    });
    if (isProcessing.value) {
      cancelProcessingRun();
    }
    if (!isProcessed.value) return;
    isProcessed.value = false;
    processedFiles.value = [];
  },
);

watch(removeBackground, (value) => {
  logProcessing('remove-background-toggle', {
    value,
    downloadTransparent: downloadTransparent.value,
  });
  if (!value) {
    downloadTransparent.value = false;
  }
});

onMounted(async () => {
  const savedApiKey = localStorage.getItem('removebg_api_key');
  if (savedApiKey && !apiKey.value) {
    apiKey.value = savedApiKey;
  }
  const savedOutputSize = localStorage.getItem('output_size');
  if (savedOutputSize) {
    outputSize.value = Number(savedOutputSize);
  }

  try {
    await ensureFaceApiReady();
  } catch (err) {
    errorMessage.value = 'No se pudieron cargar los modelos de face-api.js. Verifica la carpeta /models.';
    console.error(err);
  }

  // const cookieChoice = localStorage.getItem('cookie_consent');
  // if (!cookieChoice) {
  //   showCookieBanner.value = true;
  // }
});

function clearOriginalPreviews() {
  originalFiles.value.forEach((file) => {
    if (file.previewUrl) {
      URL.revokeObjectURL(file.previewUrl);
    }
  });
}

function logProcessing(event, payload = {}) {
  if (!debugProcessing) return;
  console.log(`[GridFaces] ${event}`, payload);
}

function cancelProcessingRun() {
  logProcessing('cancel-run', {
    currentRunId: processingRunId,
    isProcessing: isProcessing.value,
    originalCount: originalFiles.value.length,
    processedCount: processedFiles.value.length,
  });
  processingRunId += 1;
  isProcessing.value = false;
}

function handleFiles(files) {
  cancelProcessingRun();
  errorMessage.value = '';
  isProcessed.value = false;
  processedFiles.value = [];
  progress.value = 0;
  uploadSessionId += 1;

  clearOriginalPreviews();

  const incomingFiles = Array.from(files || []);
  const validImages = incomingFiles.filter((file) => isValidImage(file));
  invalidFilesCount.value = Math.max(0, incomingFiles.length - validImages.length);
  logProcessing('files-selected', {
    incoming: incomingFiles.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    })),
    validCount: validImages.length,
    invalidCount: invalidFilesCount.value,
    currentOptions: {
      cropFace: cropFace.value,
      removeBackground: removeBackground.value,
      backgroundColor: backgroundColor.value,
      outputSize: outputSize.value,
    },
  });

  originalFiles.value = validImages.map((file, index) => {
    const previewUrl = URL.createObjectURL(file);
    const sourceId = `upload-${uploadSessionId}-${index}-${file.name}`;
    return {
      id: sourceId,
      sourceId,
      file,
      name: file.name,
      size: file.size,
      sizeLabel: formatSize(file.size),
      previewUrl,
      url: previewUrl,
    };
  });
}

function isValidImage(file) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.type)) return true;
  const name = (file.name || '').toLowerCase();
  return name.endsWith('.jpg')
    || name.endsWith('.jpeg')
    || name.endsWith('.png')
    || name.endsWith('.webp');
}

async function handleProcess() {
  if (isProcessing.value) return;
  await processImages();
}

async function processImages() {
  if (!originalFiles.value.length) return;
  if (removeBackground.value && !apiKey.value) {
    errorMessage.value = 'Para eliminar el fondo necesitás ingresar la API key de remove_bg.';
    return;
  }
  if (removeBackground.value && apiKeyStatus.value === 'invalid') {
    errorMessage.value = 'La API key de remove_bg no es valida. Verifica el valor ingresado.';
    return;
  }

  const runId = ++processingRunId;
  const processConfig = {
    cropFace: cropFace.value,
    removeBackground: removeBackground.value,
    backgroundColor: backgroundColor.value,
    outputSize: outputSize.value,
  };
  logProcessing('process-start', {
    runId,
    files: originalFiles.value.map((item) => item.name),
    processConfig,
    apiKeyStatus: apiKeyStatus.value,
  });

  isProcessing.value = true;
  progress.value = 0;
  errorMessage.value = '';
  processedFiles.value = [];

  const total = originalFiles.value.length;
  let completed = 0;

  try {
    for (const item of originalFiles.value) {
      const { file, sourceId, name, sizeLabel, url } = item;
      if (runId !== processingRunId) {
        logProcessing('process-abort-before-file', { runId, name, processingRunId });
        return;
      }
      logProcessing('file-start', {
        runId,
        name,
        processConfig,
      });

      if (processConfig.cropFace) {
        const faces = await detectFaces(file);
        if (runId !== processingRunId) {
          logProcessing('process-abort-after-detect', { runId, name, processingRunId });
          return;
        }
        logProcessing('faces-detected', {
          runId,
          name,
          count: faces.length,
          removeBackground: processConfig.removeBackground,
        });
        if (!faces.length) {
          logProcessing('file-result-original', {
            runId,
            name,
            reason: 'no_faces',
          });
          processedFiles.value.push({
            id: `${sourceId}-original-${completed}`,
            sourceId,
            mode: 'original',
            url,
            urlTransparent: null,
            name,
            sizeLabel,
          });
        } else {
          const crops = await cropFacesToPortraits(
            file,
            faces,
            processConfig.backgroundColor,
            { removeBackground: processConfig.removeBackground },
          );
          if (runId !== processingRunId) {
            logProcessing('process-abort-after-crop', { runId, name, processingRunId });
            return;
          }
          logProcessing('file-result-crops', {
            runId,
            name,
            cropCount: crops.length,
            removeBackground: processConfig.removeBackground,
          });
          processedFiles.value.push(
            ...crops.map((crop, index) => ({
              id: `${sourceId}-crop-${index}`,
              sourceId,
              mode: processConfig.removeBackground ? 'crop-remove-bg' : 'crop',
              url: crop.url,
              urlTransparent: processConfig.removeBackground
                ? (crop.urlTransparent || crop.url)
                : null,
              name,
              sizeLabel,
            })),
          );
        }
      } else if (processConfig.removeBackground) {
        const removed = await removeBackgroundFromFile(
          file,
          processConfig.backgroundColor,
          processConfig.outputSize,
        );
        if (runId !== processingRunId) {
          logProcessing('process-abort-after-remove-bg', { runId, name, processingRunId });
          return;
        }
        logProcessing('file-result-remove-bg', {
          runId,
          name,
          outputSize: processConfig.outputSize,
        });
        processedFiles.value.push({
          id: `${sourceId}-remove-bg-${completed}`,
          sourceId,
          mode: 'remove-bg',
          url: removed.url,
          urlTransparent: removed.urlTransparent,
          name,
          sizeLabel,
        });
      } else {
        const resized = await resizeImageFile(file, processConfig.outputSize);
        if (runId !== processingRunId) {
          logProcessing('process-abort-after-resize', { runId, name, processingRunId });
          return;
        }
        logProcessing('file-result-resize', {
          runId,
          name,
          outputSize: processConfig.outputSize,
        });
        processedFiles.value.push({
          id: `${sourceId}-resize-${completed}`,
          sourceId,
          mode: 'resize',
          url: resized,
          urlTransparent: null,
          name,
          sizeLabel,
        });
      }

      completed += 1;
      progress.value = Math.round((completed / total) * 100);
      logProcessing('file-complete', {
        runId,
        name,
        completed,
        total,
        progress: progress.value,
      });
    }

    if (runId !== processingRunId) {
      logProcessing('process-abort-before-finish', { runId, processingRunId });
      return;
    }
    isProcessed.value = true;
    invalidFilesCount.value = 0;
    logProcessing('process-finish', {
      runId,
      processedCount: processedFiles.value.length,
    });
  } catch (err) {
    if (runId !== processingRunId) {
      logProcessing('process-abort-on-error', { runId, processingRunId });
      return;
    }
    logProcessing('process-error', {
      runId,
      message: err?.message,
      code: err?.code,
    });
    console.error(err);
    if (err && err.code === 'CREDITS_EXHAUSTED') {
      apiKeyStatus.value = 'credits';
      errorMessage.value = 'Créditos agotados en remove.bg. Recarga tu cuenta.';
      return;
    }
    errorMessage.value = 'Ocurrió un error procesando las imágenes. Revisa la consola para más detalles.';
  } finally {
    if (runId === processingRunId) {
      isProcessing.value = false;
      logProcessing('process-finally', {
        runId,
        isProcessed: isProcessed.value,
        processedCount: processedFiles.value.length,
      });
    }
  }
}

async function downloadPortrait(portrait, index, transparent = false) {
  const originalName = portrait.name || `retrato-${index + 1}.png`;
  const baseName = originalName.replace(/\.[^.]+$/, '');
  const fileNameBase = `GF-${baseName}`;
  const { url: downloadUrl, revoke } = await buildFilteredDownload(
    portrait,
    transparent,
  );

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = transparent
    ? `${fileNameBase}-transparente.png`
    : `${fileNameBase}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (revoke) {
    URL.revokeObjectURL(downloadUrl);
  }
}

async function downloadAll() {
  const transparent = Boolean(downloadTransparent.value);
  for (let index = 0; index < processedFiles.value.length; index++) {
    await new Promise((resolve) => {
      setTimeout(() => {
        downloadPortrait(processedFiles.value[index], index, transparent).then(resolve);
      }, index * 120);
    });
  }
}

function resetAll() {
  cancelProcessingRun();
  errorMessage.value = '';
  isProcessed.value = false;
  progress.value = 0;
  processedFiles.value = [];
  downloadTransparent.value = false;
  invalidFilesCount.value = 0;
  clearOriginalPreviews();
  originalFiles.value = [];
}

function startEditing() {
  cancelProcessingRun();
  isProcessed.value = false;
  processedFiles.value = [];
}

function getThumbBackground(item) {
  if (!isProcessed.value) return null;
  if (downloadTransparent.value) return null;
  if (item && item.hasTransparent) {
    return { backgroundColor: backgroundColor.value };
  }
  return null;
}

function formatSize(bytes) {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function hasActiveFilters() {
  return filterBn.value
    || activeMultiply.value
    || exposure.value !== 100
    || brightness.value !== 100
    || contrast.value !== 100
    || highlights.value !== 100
    || shadows.value !== 100;
}

function buildCanvasFilter() {
  const filters = [];
  if (exposure.value !== 100) filters.push(`brightness(${exposure.value}%)`);
  if (brightness.value !== 100) filters.push(`brightness(${brightness.value}%)`);
  if (contrast.value !== 100) filters.push(`contrast(${contrast.value}%)`);
  if (highlights.value !== 100) filters.push(`brightness(${highlights.value}%)`);
  if (shadows.value !== 100) filters.push(`contrast(${shadows.value}%)`);
  if (filterBn.value) filters.push('grayscale(1)');
  return filters.length ? filters.join(' ') : 'none';
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    img.src = url;
  });
}

async function buildFilteredDownload(portrait, transparent) {
  const hasTransparent = portrait.hasTransparent != null
    ? portrait.hasTransparent
    : Boolean(portrait.urlTransparent) && portrait.urlTransparent !== portrait.url;
  const baseUrl = transparent
    ? portrait.urlTransparent || portrait.url
    : hasTransparent
      ? portrait.urlTransparent
      : portrait.url;
  const needsBackgroundFill = !transparent && hasTransparent;

  if (!baseUrl) {
    return { url: baseUrl, revoke: false };
  }

  const img = await loadImage(baseUrl);
  const canvas = document.createElement('canvas');
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  const requestedWidth = Number(outputSize.value);
  const targetWidth = Number.isFinite(requestedWidth) && requestedWidth > 0
    ? Math.round(requestedWidth)
    : naturalWidth;
  if (!hasActiveFilters() && !needsBackgroundFill && targetWidth === naturalWidth) {
    return { url: baseUrl, revoke: false };
  }
  const scale = targetWidth / naturalWidth;
  const targetHeight = Math.max(1, Math.round(naturalHeight * scale));
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { url: baseUrl, revoke: false };
  }

  if (needsBackgroundFill) {
    ctx.fillStyle = backgroundColor.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.globalCompositeOperation = activeMultiply.value && !transparent ? 'multiply' : 'source-over';
  ctx.filter = buildCanvasFilter();
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/png', 0.95),
  );
  if (!blob) {
    return { url: baseUrl, revoke: false };
  }

  const url = URL.createObjectURL(blob);
  return { url, revoke: true };
}

onBeforeUnmount(() => {
  if (apiKeyTimer) {
    clearTimeout(apiKeyTimer);
  }
  clearOriginalPreviews();
});

function sendContact() {
  const name = contactName.value.trim();
  const email = contactEmail.value.trim();
  const message = contactMessage.value.trim();
  const subject = 'Contacto FaceCut';
  const bodyLines = [
    `Nombre: ${name || '-'}`,
    `Email: ${email || '-'}`,
    '',
    message || '(Sin mensaje)',
  ];
  const body = bodyLines.join('\n');
  const mailto = `mailto:ploscri@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
  showContact.value = false;
}

// function setCookieConsent(value) {
//   localStorage.setItem('cookie_consent', value);
//   showCookieBanner.value = false;
// }
</script>

<style scoped>

h1 {
  font-family: 'Montserrat', Arial, sans-serif;
  font-size: 16px;
  font-weight: 800;
  display: inline;
  margin: 0;
}
.page {
  min-height: 100vh;
  padding: 32px 24px 0;
  background: #ffffff;
  color: #111111;
  font-family: 'Roboto', Arial, sans-serif;
}

.adsense-wrapper {
  width: 100%;
  background: #fafafa;
  margin-bottom: 40px;
}

.adsense-placeholder {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
}

.adsense-placeholder__label {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: #9a9a9a;
  text-align: center;
  font-family: 'Montserrat', Arial, sans-serif;
}

.adsense-placeholder__card {
  border: 1px solid #e6e6e6;
  background: #ffffff;
  border-radius: 8px;
  display: grid;
  grid-template-columns: 2fr 1.3fr;
  min-height: 180px;
  overflow: hidden;
}

.adsense-placeholder__media {
  background: linear-gradient(135deg, #e9e9e9, #f6f6f6);
}

.adsense-placeholder__copy {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}

.adsense-placeholder__title {
  font-size: 18px;
  font-weight: 700;
  font-family: 'Montserrat', Arial, sans-serif;
}

.adsense-placeholder__text {
  font-size: 13px;
  color: #777777;
  line-height: 1.4;
}

.adsense-placeholder__meta {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666666;
}

.brand-header {
  max-width: 1200px;
  margin: 0 auto 40px;
}

.brand-header__inner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32px;
}

.brand-copy {
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.brand-header--explainer .brand-header__inner {
  align-items: flex-start;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  position: relative;
  margin-bottom: 2px;
  font-family: 'Montserrat Alternates', 'Montserrat', Arial, sans-serif;
  width: fit-content;
}

.brand__link {
  display: inline-flex;
  align-items: center;
}

.brand--sidebar {
  margin-bottom: 24px;
}

.brand--image img {
  display: block;
  width: 350px;
  height: auto;
  margin-bottom: 10px;
}

.brand--sidebar img {
  width: 215px;
}

.brand__logo-home {
  width: 700px;
  max-width: none;
}

.hero__lede {
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
  font-family: 'Montserrat', Arial, sans-serif;
}

.hero__lede--lead {
  font-size: 16px;
  font-weight: 800;
  font-family: 'Montserrat', Arial, sans-serif;
  margin: 0;
  display: inline;
}

.hero__lede__rest {
  font-weight: 400;
}

.hero__steps {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.step__title {
  font-size: 12px;
  font-weight: 400;
  margin: 0;
  min-height: 20px;
  font-family: 'Montserrat', Arial, sans-serif;
}

.step__title strong {
  font-weight: 800;
}

.step__plus {
  align-self: center;
  margin-top: 18px;
}

.step__plus {
  font-size: 16px;
  font-weight: 700;
  color: #000000;
}

.step img {
  width: 160px;
  height: 135px;
  object-fit: contain;
}

.step--small img {
  width: 130px;
  height: 130px;
}

.upload-section {
  width: 100%;
  margin: 0 auto 32px;
  text-align: center;
}

.upload-section--full {
  width: 100%;
  margin: 0 auto 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.upload-area {
  width: 100%;
  position: relative;
}

.upload-frame {
  width: 100%;
  max-width: 1210px;
  margin: 0 auto;
  position: relative;
}

.upload-section__formats {
  margin: 0;
  font-size: 14px;
  margin-top: 20px;
}

.upload-note {
  color: #9a9a9a;
  font-size: 12px;
  margin: 0;
  letter-spacing: 0.08em;
}

.workspace {
  max-width: 1200px;
  margin: 0 auto 32px;
  display: grid;
  grid-template-columns: 215px minmax(0, 1fr);
  gap: 80px;
  align-items: start;
}

.workspace__sidebar {
  position: sticky;
  top: 24px;
  align-self: start;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 140px);
}

.workspace__preview {
  overflow-y: auto;
  /*max-height: calc(100vh - 180px);*/  
  padding-right: 8px;
}

.preview-panel {
  border: 2px dashed #cfcfcf;
  border-radius: 20px;
  padding: 18px 18px 24px;
  height: 100%;
  min-height: calc(100vh - 140px);
  display: flex;
  flex-direction: column;
  position: relative;
}

.preview-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 10px 6px 22px;
  margin-bottom: 28px;
  border-bottom: 1px dashed #cfcfcf;
}

.preview-panel__controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 32px;
  flex-wrap: wrap;
}

.preview-panel__title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin: 0;
  font-family: 'Montserrat', Arial, sans-serif;
}

.preview-panel__size {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  font-family: 'Montserrat', Arial, sans-serif;
}

.preview-panel__size-label {
  font-size: 13px;
  letter-spacing: 0;
  font-weight: 600;
}

.preview-panel__size-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

.preview-panel__size-row input {
  width: 70px;
  padding: 8px 10px;
  border: 1px solid #bdbdbd;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
}

.preview-panel__content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 48px;
  align-items: stretch;
  flex: 1;
  position: relative;
}

.preview-panel__content--single {
  grid-template-columns: 1fr;
  gap: 0;
}

.upload-warning {
  position: absolute;
  inset: 6px;
  background: rgba(255, 255, 255, 0.68);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  pointer-events: none;
  z-index: 2;
  border-radius: 11px;
}

.upload-warning--panel {
  inset: 0;
}

.upload-area .upload-warning {
  background: rgba(244, 216, 216, 0.38);
}

.upload-warning--solid {
  background: #ffffff;
}

.upload-area .upload-warning--solid {
  background: #ffffff;
}

.upload-warning__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #b45a5a;
}

.upload-warning__inner img {
  width: 84px;
  height: 84px;
}

.upload-warning__inner p {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.05em;
  font-family: 'Montserrat', Arial, sans-serif;
}

.upload-warning__hint {
  font-size: 14px;
  font-weight: 600;
  color: #111111;
  font-family: 'Montserrat', Arial, sans-serif;
}

.thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, 200px);
  gap: 40px 30px;
  justify-content: flex-start;
  align-content: start;
}

.thumb-enter-active,
.thumb-leave-active {
  transition: opacity 0.45s ease, transform 0.45s ease;
}

.thumb-enter-from,
.thumb-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.thumb-card {
  text-align: left;
}

.thumb-card__image {
  width: 200px;
  height: 200px;
  border-radius: 18px;
  background: #f3f3f3;
  overflow: hidden;
  position: relative;
  box-shadow: 1px 1px 5px 3px #ebebeb;
}

.thumb-card__image--transparent {
  background-color: #f3f3f3;
  background-image:
    linear-gradient(45deg, #e4e4e4 25%, transparent 25%),
    linear-gradient(-45deg, #e4e4e4 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e4e4e4 75%),
    linear-gradient(-45deg, transparent 75%, #e4e4e4 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}

.thumb-card__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-card__img--raw {
  opacity: 1;
  transition: opacity 0.3s ease;
}

.thumb-card__img--processed {
  opacity: 0;
  transition: opacity 0.35s ease 0.2s;
}

.thumb-card__img--fade {
  opacity: 0;
}

.thumb-card__img--show {
  opacity: 1;
}

.thumb-card__wash {
  position: absolute;
  inset: 0;
  background: #ffffff;
  opacity: 0;
}

.thumb-card__wash--on {
  animation: aiWash 0.6s ease;
}

@keyframes aiWash {
  0% {
    opacity: 0;
  }
  40% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}



.thumb-card__download {
  width: 40px;
  height: 40px;
  border-radius: 5px;
  background: #d46060;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-top: 10px;
}

.thumb-card__download img {
  width: 16px;
  height: 26px;
  display: block;
}

.thumb-card__meta {
  margin-top: 8px;
}

.thumb-card__name {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thumb-card__size {
  margin: 2px 0 0;
  font-size: 12px;
  color: #777777;
}

.filters-panel {
  border-left: 1px dashed #bfbfbf;
  padding-left: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  position: relative;
}

.preview-panel--processed::after {
  display: none;
}

.filters-panel__title {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0.08em;
  font-weight: 700;
  font-family: 'Montserrat', Arial, sans-serif;
}

.filters-panel__option {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-family: 'Montserrat', Arial, sans-serif;
}

.filters-panel__option input {
  width: 22px;
  height: 22px;
  accent-color: #111111;
}

.filters-panel__divider {
  width: 100%;
  border-bottom: 1px dashed #bfbfbf;
}

.filters-panel__slider {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filters-panel__label {
  font-size: 14px;
  font-weight: 600;
  font-family: 'Montserrat', Arial, sans-serif;
}

.filters-panel__label--small {
  font-size: 12px;
  letter-spacing: 0.08em;
}

.filters-panel__slider input[type='range'] {
  width: 100%;
  accent-color: #111111;
}



.settings-panel,
.actions-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-panel {
  flex: 1;
}

.actions-panel__block {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.actions-panel__block--center {
  align-items: center;
}

.actions-panel__divider {
  width: 100%;
  border-bottom: 1px dashed #bfbfbf;
}

.settings-panel__title {
  font-size: 12px;
  letter-spacing: 0.08em;
  font-weight: 700;
  margin: 0 0 4px;
  font-family: 'Montserrat', Arial, sans-serif;
}

.settings-panel__divider {
  width: 100%;
  border-bottom: 1px dashed #bfbfbf;
  margin: 4px 0;
}

.settings-panel__divider--spaced {
  margin-top: 10px;
}

.settings-panel__footer {
  margin-top: auto;
  display: flex;
  justify-content: center;
}
.settings-panel__group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings {
  max-width: 1200px;
  margin: 0 auto 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.sticky-bar {
  position: sticky;
  top: 0;
  background: #ffffff;
  z-index: 10;
  padding: 18px 0 12px;
  border-bottom: 1px dashed #cfcfcf;
}

.settings__row {
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-family: 'Montserrat', Arial, sans-serif;
}

.check--block {
  width: 100%;
  justify-content: flex-start;
}

.check input {
  width: 26px;
  height: 26px;
  accent-color: #d46060;
}

.settings__apikey {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings__apikey input {
  border: 1px solid #bdbdbd;
  padding: 8px 12px;
  font-size: 14px;
}

.settings__apikey-status {
  margin: 0;
  font-size: 13px;
  font-weight: 200;
  font-family: 'Roboto', Arial, sans-serif;
}

.settings__apikey-status-slot {
  min-height: 18px;
  display: flex;
  align-items: center;
}

.settings__apikey-status--valid {
  color: #111111;
}

.settings__apikey-status--invalid {
  color: #d46060;
}

.settings-warning {
  background: #d46060;
  color: #ffffff;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.4;
  font-family: 'Montserrat', Arial, sans-serif;
}

.settings-warning a {
  color: #ffffff;
  text-decoration: underline;
}

.color {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  font-family: 'Montserrat', Arial, sans-serif;
}

.color--block {
  justify-content: flex-start;
  width: 100%;
}

.color input {
  width: 32px;
  height: 32px;
  border: 2px solid #111111;
  padding: 0;
  background: #fff;
}

.actions {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  width: 100%;
  justify-content: space-between;
}

.divider {
  width: 100%;
  border-bottom: 1px dashed #cfcfcf;
}

.action-button {
  position: relative;
  padding: 20px 48px;
  border-radius: 999px;
  border: 2px solid #d46060;
  background: transparent;
  color: #d46060;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  overflow: hidden;
  font-family: 'Roboto', Arial, sans-serif;
}

.action-button--loading {
  color: #d46060;
}

.action-button--full {
  width: 100%;
  justify-content: center;
}

.action-button__progress {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: #e2e2e2;
  z-index: 0;
}

.action-button__label {
  position: relative;
  z-index: 1;
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.size-control {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #d46060;
  font-weight: 700;
  font-family: 'Roboto', Arial, sans-serif;
}

.size-control__label {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: #111111;
  font-family: 'Roboto', Arial, sans-serif;
}

.size-control__row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #d46060;
  font-family: 'Roboto', Arial, sans-serif;
}

.size-control--stacked {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.size-control input {
  width: 70px;
  padding: 6px 10px;
  border: 1px solid #d46060;
  text-align: center;
  font-size: 14px;
}

.download-button {
  border: none;
  background: #d46060;
  color: #ffffff;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  padding: 0 13px;
  border-radius: 6px;
  font-family: 'Roboto', Arial, sans-serif;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 56px;
  min-width: 195px;
  text-align: left;
}

.download-button--panel {
  width: 100%;
  justify-content: center;
  margin-bottom: 10px;
}

.download-button--top {
  border-radius: 999px;
  padding: 0 26px;
  min-width: 210px;
  justify-self: end;
}
.download-button__icon {
  width: 16px;
  height: 26px;
  display: block;
}

.download-button:disabled,
.secondary-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.secondary-button {
  border: 1.5px solid #111111;
  background: transparent;
  color: #111111;
  font-weight: 600;
  letter-spacing: 0.08em;
  cursor: pointer;
  padding: 0 32px;
  border-radius: 999px;
  font-family: 'Roboto', Arial, sans-serif;
  font-size: 13px;
  height: 56px;
  width: 100%;
}

.error-message {
  color: #d46060;
  font-weight: 600;
}

.site-footer {
  border-top: 1px solid #ececec;
  margin-top: 64px;
  padding: 32px 24px 40px;
  background: #ffffff;
}

.site-footer__inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
}

.site-footer__column h3 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  font-family: 'Montserrat', Arial, sans-serif;
}

.site-footer__column p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #666666;
  font-family: 'Montserrat', Arial, sans-serif;
}

.site-footer__credit {
  max-width: 1200px;
  margin: 28px auto 0;
  font-size: 12px;
  color: #9a9a9a;
  letter-spacing: 0.08em;
  font-family: 'Montserrat', Arial, sans-serif;
}

.site-footer__bottom {
  max-width: 1200px;
  margin: 28px auto 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #f3f3f3;
  padding: 20px;
}

.site-footer__bottom .site-footer__credit {
  margin: 0;
}

.site-footer__contact {
  border: none;
  background: transparent;
  color: #d46060;
  font-weight: 600;
  letter-spacing: 0.08em;
  cursor: pointer;
  padding: 0;
  border-radius: 0;
  font-family: 'Roboto', Arial, sans-serif;
  font-size: 12px;
  height: auto;
}

.site-footer__legal {
  max-width: 1200px;
  margin: 12px auto 0;
  display: flex;
  gap: 16px;
}

.site-footer__legal button {
  border: none;
  background: transparent;
  color: #111111;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  padding: 0;
  font-family: 'Roboto', Arial, sans-serif;
  font-size: 12px;
}

.contact-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.contact-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}

.contact-modal__card {
  position: relative;
  z-index: 1;
  width: min(420px, 92vw);
  background: #ffffff;
  border-radius: 18px;
  padding: 28px 26px 24px;
  box-shadow: 0 16px 60px rgba(0, 0, 0, 0.2);
  font-family: 'Montserrat', Arial, sans-serif;
}

.contact-modal__card h3 {
  margin: 0 0 16px;
  font-size: 18px;
}

.contact-modal__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 13px;
  line-height: 1.5;
  color: #444444;
}

.contact-modal__body p {
  margin: 0;
}

.contact-modal__close {
  position: absolute;
  right: 12px;
  top: 12px;
  border: none;
  background: #f3f3f3;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.contact-modal__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 13px;
}

.contact-modal__form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.contact-modal__form input,
.contact-modal__form textarea {
  border: 1px solid #bdbdbd;
  padding: 10px 12px;
  font-size: 14px;
  font-family: 'Roboto', Arial, sans-serif;
  border-radius: 8px;
}

.contact-modal__submit {
  border: none;
  background: #d46060;
  color: #ffffff;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  padding: 12px 18px;
  border-radius: 999px;
  font-family: 'Roboto', Arial, sans-serif;
  font-size: 12px;
  align-self: flex-end;
}

.cookie-banner {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: 16px;
  background: #ffffff;
  border: 1px solid #e6e6e6;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  z-index: 220;
  font-size: 13px;
  font-family: 'Montserrat', Arial, sans-serif;
}

.cookie-banner p {
  margin: 0;
  color: #444444;
}

.cookie-banner__actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.cookie-banner__button {
  border: none;
  background: #d46060;
  color: #ffffff;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 999px;
  font-family: 'Roboto', Arial, sans-serif;
  font-size: 12px;
}

.cookie-banner__button--ghost {
  background: transparent;
  color: #d46060;
  border: 1.5px solid #d46060;
}

@media (max-width: 900px) {
  .brand-header__inner {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero__steps {
    justify-content: flex-start;
  }

  .workspace {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .workspace__sidebar {
    position: static;
    min-height: auto;
    width: 100%;
  }

  .workspace__preview {
    max-height: none;
    overflow: visible;
    width: 100%;
  }

  .preview-panel__content {
    grid-template-columns: 1fr;
  }

  .preview-panel__header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .preview-panel__controls {
    width: 100%;
    justify-content: flex-start;
    gap: 14px;
  }

  .preview-panel__size {
    flex-wrap: wrap;
  }

  .download-button--top {
    width: 100%;
    justify-content: center;
  }

  .filters-panel {
    border-top: 1px dashed #bfbfbf;
    padding-left: 0;
    padding-top: 18px;
  }

  .preview-panel--processed::after {
    display: none;
  }

  .site-footer {
    padding-left: 0;
    padding-right: 0;
  }

  .site-footer__bottom {
    padding: 0 16px;
    flex-direction: column;
    align-items: flex-start;
  }

  .site-footer__legal {
    padding: 0 16px;
    flex-direction: column;
    align-items: flex-start;
  }

  .cookie-banner {
    flex-direction: column;
    align-items: flex-start;
  }

  .adsense-placeholder__card {
    grid-template-columns: 1fr;
  }

  .adsense-placeholder__media {
    min-height: 140px;
  }
   .step {
    align-items: flex-start;
  }
}

@media (max-width: 640px) {
  .adsense-placeholder {
    align-items: center;
  }

  .adsense-placeholder__card {
    width: 320px;
    min-height: 100px;
    grid-template-columns: 1fr;
  }

  .adsense-placeholder__media {
    min-height: 100px;
  }

  .adsense-placeholder__copy {
    display: none;
  }

  .hero__steps {
    flex-wrap: nowrap;
    gap: 14px;
    overflow-x: auto;
    padding-bottom: 6px;
  }
 

  .step__title {
    font-size: 12px;
    min-height: 18px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    gap: 1px;
  }

  .step__title strong {
    display: block;
  }

  .step img {
    width: 101px;
    height: 97px;
  }

  .step--small img {
    width: 79px;
    height: 95px;
  }

  .thumb-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 16px;
  }

  .thumb-card__image {
    width: 100%;
    height: 160px;
  }

  .thumb-card__download {
    width: 34px;
    height: 34px;
  }

  .thumb-card__download img {
    width: 14px;
    height: 22px;
  }
}
</style>
