// Servicios centralizados para detección de rostros y recorte en formato retrato, removiendo fondo.
// Requiere: face-api.js, @tensorflow-models/body-pix y @tensorflow/tfjs (1.x para compatibilidad con face-api).

import * as faceapi from 'face-api.js';
import * as bodyPix from '@tensorflow-models/body-pix';
import * as tf from '@tensorflow/tfjs';

/**
 * @typedef {Object} OriginalImage
 * @property {string} name
 * @property {number} width
 * @property {number} height
 * @property {File} file
 */

/**
 * @typedef {Object} DetectedFace
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} [score]
 */

/**
 * @typedef {Object} PortraitCrop
 * @property {string} dataUrl
 * @property {DetectedFace} face
 * @property {string} [sourceName]
 */

let modelsLoaded = false;
let bodyPixNet = null;

/**
 * Carga los modelos de face-api.js una sola vez.
 * Alojando los modelos en /public/models (TinyFaceDetector) funciona bien para front-end.
 */
export async function ensureFaceApiReady() {
  if (modelsLoaded) return;

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    // Se podrían cargar más modelos (landmarks, expresiones) si se necesitan.
  ]);

  modelsLoaded = true;
}

/**
 * Carga el modelo de segmentación de BodyPix (MobileNet) una sola vez.
 */
async function ensureBodyPixReady() {
  if (bodyPixNet) return bodyPixNet;
  await tf.ready();
  console.log('Cargando modelo BodyPix...');
  try {
    bodyPixNet = await bodyPix.load();
    console.log('BodyPix cargado exitosamente');
  } catch (err) {
    console.error('Error al cargar BodyPix:', err);
    throw err;
  }
  return bodyPixNet;
}

/**
 * Detecta rostros en un archivo de imagen usando TinyFaceDetector.
 * @param {File} file
 * @returns {Promise<DetectedFace[]>}
 */
export async function detectFaces(file) {
  await ensureFaceApiReady();
  const image = await fileToImageElement(file);

  const detections = await faceapi.detectAllFaces(
    image,
    new faceapi.TinyFaceDetectorOptions(),
  );

  return detections.map((det) => ({
    x: det.box.x,
    y: det.box.y,
    width: det.box.width,
    height: det.box.height,
    score: det.score,
  }));
}

/**
 * Genera recortes en formato retrato para cada rostro detectado.
 * @param {File} file
 * @param {DetectedFace[]} faces
 * @param {string} [backgroundColor]
 * @returns {Promise<PortraitCrop[]>}
 */
export async function cropFacesToPortraits(file, faces, backgroundColor = '#0f172a') {
  if (!faces.length) return [];

  const image = await fileToImageElement(file);
  
  // En modo desarrollo, usa BodyPix (sin requests)
  const devMode = import.meta.env.VITE_DEV_MODE === 'true';
  
  if (devMode) {
    console.log('🔧 MODO DESARROLLO: Usando BodyPix (sin requests)');
    let segmentation = null;
    try {
      const net = await ensureBodyPixReady();
      console.log('BodyPix cargado, procesando segmentación...');
      segmentation = await net.estimatePersonSegmentation(image);
      console.log('Segmentación completada con BodyPix');
    } catch (err) {
      console.warn('Error con BodyPix:', err);
    }

    return faces.map((face) => {
      const url = cropPortraitWithSegmentation(image, face, backgroundColor, segmentation);
      return {
        url,
        sourceName: file.name,
      };
    });
  }

  // En producción, usa Remove.bg
  console.log('🚀 MODO PRODUCCIÓN: Usando Remove.bg API');
  let removedBgImage = null;
  try {
    console.log('Enviando imagen a Remove.bg...');
    removedBgImage = await removeBackgroundWithRemoveBg(file);
    console.log('Fondo removido exitosamente con Remove.bg');
  } catch (err) {
    console.warn('No se pudo usar Remove.bg. Se usará BodyPix como fallback.', err);
    // Fallback a BodyPix
    let segmentation = null;
    try {
      const net = await ensureBodyPixReady();
      segmentation = await net.estimatePersonSegmentation(image);
    } catch (err2) {
      console.warn('Error con BodyPix fallback:', err2);
    }
    
    return faces.map((face) => {
      const url = cropPortraitWithSegmentation(image, face, backgroundColor, segmentation);
      return {
        url,
        sourceName: file.name,
      };
    });
  }

  return faces.map((face) => {
    const url = cropPortrait(removedBgImage || image, face, backgroundColor);
    return {
      url,
      sourceName: file.name,
    };
  });
}

/**
 * Remueve el fondo usando la API de Remove.bg
 * Necesita API key en variable de entorno VITE_REMOVEBG_API_KEY
 */
async function removeBackgroundWithRemoveBg(file) {
  const apiKey = import.meta.env.VITE_REMOVEBG_API_KEY;
  
  if (!apiKey) {
    throw new Error('API key de Remove.bg no configurada. Añade VITE_REMOVEBG_API_KEY al archivo .env');
  }

  const formData = new FormData();
  formData.append('image_file', file);
  formData.append('format', 'auto');
  formData.append('type', 'auto');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Remove.bg API error: ${response.statusText}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Error al cargar imagen de Remove.bg'));
    };
    img.src = url;
  });
}

/**
 * Punto de extensión para optimizaciones futuras con IA.
 * Aquí se podría enviar el retrato a una API externa que mejore contraste, nitidez,
 * balance de blancos, etc. Actualmente devuelve la imagen sin cambios.
 * @param {string} portraitDataUrl
 * @returns {Promise<string>}
 */
export async function optimizePortrait(portraitDataUrl) {
  // Ejemplo de integración futura:
  // const response = await fetch('/api/optimize', { method: 'POST', body: JSON.stringify({ image: portraitDataUrl }) });
  // const { enhancedImage } = await response.json();
  // return enhancedImage;
  return portraitDataUrl;
}

async function fileToImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error(`No se pudo cargar la imagen: ${err?.message || ''}`));
    };
    img.src = url;
  });
}

// Recorta el rostro a un canvas manteniendo un aspecto de retrato vertical.
// La imagen ya tiene el fondo removido por Remove.bg
function cropPortrait(image, face, backgroundColor) {
  const PORTRAIT_RATIO = 3 / 4; // ancho / alto para un encuadre vertical.
  const EXPANSION = 1.35; // expande el recuadro alrededor del rostro para incluir hombros.

  const centerX = face.x + face.width / 2;
  const centerY = face.y + face.height / 2;

  let cropWidth = face.width * EXPANSION;
  let cropHeight = cropWidth / PORTRAIT_RATIO;

  let x = centerX - cropWidth / 2;
  let y = centerY - cropHeight / 2;

  ({ x, y, cropWidth, cropHeight } = clampToImageBounds({
    x,
    y,
    width: cropWidth,
    height: cropHeight,
    image,
  }));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cropWidth);
  canvas.height = Math.round(cropHeight);
  const ctx = canvas.getContext('2d');

  // 1) Rellena con color de fondo base
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2) Dibuja la imagen (que ya tiene fondo removido)
  ctx.drawImage(image, Math.round(x), Math.round(y), Math.round(cropWidth), Math.round(cropHeight), 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/png');
}

// Recorta el rostro usando segmentación BodyPix (para modo desarrollo)
function cropPortraitWithSegmentation(image, face, backgroundColor, segmentation) {
  const PORTRAIT_RATIO = 3 / 4;
  const EXPANSION = 1.35;

  const centerX = face.x + face.width / 2;
  const centerY = face.y + face.height / 2;

  let cropWidth = face.width * EXPANSION;
  let cropHeight = cropWidth / PORTRAIT_RATIO;

  let x = centerX - cropWidth / 2;
  let y = centerY - cropHeight / 2;

  ({ x, y, cropWidth, cropHeight } = clampToImageBounds({
    x,
    y,
    width: cropWidth,
    height: cropHeight,
    image,
  }));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cropWidth);
  canvas.height = Math.round(cropHeight);
  const ctx = canvas.getContext('2d');

  // 1) Rellena con color de fondo base
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2) Si hay segmentación, aplicamos máscara
  let sourceCanvas = null;
  if (segmentation && segmentation.data) {
    try {
      // Crea un canvas temporal del tamaño de la imagen original
      sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = image.width;
      sourceCanvas.height = image.height;
      const sourceCtx = sourceCanvas.getContext('2d');
      
      // Dibuja la imagen original
      sourceCtx.drawImage(image, 0, 0);
      
      // Obtén los datos de imagen
      const imageData = sourceCtx.getImageData(0, 0, image.width, image.height);
      const imgData = imageData.data;
      
      // Datos de segmentación
      const segData = segmentation.data;
      const segWidth = segmentation.width;
      const segHeight = segmentation.height;
      const scaleX = image.width / segWidth;
      const scaleY = image.height / segHeight;
      
      // Aplica la máscara pixel por pixel
      for (let i = 0; i < imgData.length; i += 4) {
        const pixelIdx = i / 4;
        const imgX = pixelIdx % image.width;
        const imgY = Math.floor(pixelIdx / image.width);
        
        const segX = Math.floor(imgX / scaleX);
        const segY = Math.floor(imgY / scaleY);
        const segIdx = Math.min(segY * segWidth + segX, segData.length - 1);
        
        const personConfidence = segData[segIdx];
        imgData[i + 3] = Math.round(personConfidence * 255);
      }
      
      sourceCtx.putImageData(imageData, 0, 0);
    } catch (err) {
      console.warn('Error aplicando máscara:', err);
      sourceCanvas = null;
    }
  }
  
  // 3) Dibuja el canvas fuente al retrato final
  if (sourceCanvas) {
    ctx.drawImage(sourceCanvas, Math.round(x), Math.round(y), Math.round(cropWidth), Math.round(cropHeight), 0, 0, canvas.width, canvas.height);
  } else {
    ctx.drawImage(image, Math.round(x), Math.round(y), Math.round(cropWidth), Math.round(cropHeight), 0, 0, canvas.width, canvas.height);
  }

  return canvas.toDataURL('image/png');
}

// Helper para convertir ImageData a un formato que drawImage pueda usar
function createImageBitmapFromImageData(imageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Asegura que el recorte no salga de los límites de la imagen.
function clampToImageBounds({ x, y, width, height, image }) {
  const maxX = image.width - width;
  const maxY = image.height - height;

  const clampedX = Math.max(0, Math.min(x, maxX));
  const clampedY = Math.max(0, Math.min(y, maxY));

  // Si el recorte excede la imagen, ajustamos ancho/alto para no salirnos.
  const adjustedWidth = Math.min(width, image.width - clampedX);
  const adjustedHeight = Math.min(height, image.height - clampedY);

  return {
    x: clampedX,
    y: clampedY,
    cropWidth: adjustedWidth,
    cropHeight: adjustedHeight,
  };
}

// Convierte la segmentación de BodyPix en un canvas de máscara (blanco = sujeto, transparente = fondo).
function buildMaskCanvas(segmentation) {
  const mask = bodyPix.toMask(
    segmentation,
    { r: 255, g: 255, b: 255, a: 255 },
    { r: 0, g: 0, b: 0, a: 0 },
  );

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = mask.width;
  maskCanvas.height = mask.height;
  const maskCtx = maskCanvas.getContext('2d');
  maskCtx.putImageData(mask, 0, 0);
  return maskCanvas;
}
