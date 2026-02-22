// Servicios centralizados para detección de rostros y recorte en formato retrato, removiendo fondo.
// Requiere: face-api.js, @tensorflow-models/body-pix y @tensorflow/tfjs (1.x para compatibilidad con face-api).

import * as faceapi from 'face-api.js';
import * as bodyPix from '@tensorflow-models/body-pix';
import * as tf from '@tensorflow/tfjs';

// Configuración dinámica
let config = {
  // En build de producción preferimos FORZAR devMode=false para que los modelos se carguen desde S3
  devMode: import.meta.env.PROD ? false : import.meta.env.VITE_DEV_MODE === 'true',
  apiKey: import.meta.env.VITE_REMOVEBG_API_KEY || '',
  outputSize: Number(import.meta.env.VITE_OUTPUT_SIZE || 700),
};

/**
 * Actualiza la configuración dinámicamente desde el front
 */
export function setConfig(newConfig) {
  config = { ...config, ...newConfig };
  console.log('⚙️ Configuración actualizada:', config);
}

export async function validateRemoveBgKey(apiKey) {
  if (!apiKey) return null;
  try {
    const response = await fetch('https://api.remove.bg/v1.0/account', {
      headers: {
        'X-Api-Key': apiKey,
      },
    });
    return response.ok;
  } catch (err) {
    console.warn('No se pudo validar la API key de remove.bg:', err);
    return null;
  }
}

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

  // Usar ruta absoluta en producción
  // En producción, SIEMPRE usar la ruta absoluta S3
  let modelBase = import.meta.env.PROD
    ? 'https://especialess3.lanacion.com.ar/Aplicaciones/CropApp7/dist/models/'
    : '/models';
  // Asegurar que termine con slash para que face-api construya bien las URLs internas
  if (!modelBase.endsWith('/')) modelBase += '/';
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(modelBase),
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
    // Usar ruta absoluta en producción
    const modelUrl = config.devMode
      ? undefined
      : 'https://especialess3.lanacion.com.ar/Aplicaciones/CropApp7/dist/models/bodypix/model-stride16.json';
    bodyPixNet = await bodyPix.load(modelUrl ? { modelUrl } : undefined);
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
 * @param {Object} [options]
 * @param {boolean} [options.removeBackground]
 * @returns {Promise<PortraitCrop[]>}
 */
export async function cropFacesToPortraits(file, faces, backgroundColor = '#0f172a', options = {}) {
  if (!faces.length) return [];

  const image = await fileToImageElement(file);
  const shouldRemoveBackground = Boolean(options.removeBackground);

  if (!shouldRemoveBackground) {
    return faces.map((face) => {
      const url = cropPortrait(image, face, backgroundColor);
      return {
        url,
        urlTransparent: url,
        sourceName: file.name,
      };
    });
  }

  console.log('🚀 Eliminando fondo con Remove.bg');
  let removedBgImage = null;
  try {
    console.log('Enviando imagen a Remove.bg...');
    removedBgImage = await removeBackgroundWithRemoveBg(file);
    console.log('Fondo removido exitosamente con Remove.bg');
  } catch (err) {
    if (!config.devMode) {
      throw err;
    }
    console.warn('No se pudo usar Remove.bg. Se usará BodyPix como fallback (solo dev).', err);
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
        urlTransparent: url,
        sourceName: file.name,
      };
    });
  }

  return faces.map((face) => {
    const targetImage = removedBgImage || image;
    const adjustedFace = scaleFaceForImage(face, image, targetImage);
    const urlWithBackground = cropPortrait(targetImage, adjustedFace, backgroundColor);
    let urlTransparent;
    if (removedBgImage) {
      urlTransparent = cropPortraitTransparent(removedBgImage, adjustedFace);
    } else {
      urlTransparent = cropPortraitTransparent(image, adjustedFace);
    }
    return {
      url: urlWithBackground,
      urlTransparent,
      sourceName: file.name,
    };
  });
}

/**
 * Remueve el fondo de una imagen completa (sin encuadrar).
 * @param {File} file
 * @param {string} [backgroundColor]
 * @param {number} [outputWidth]
 * @returns {Promise<{url: string, urlTransparent: string}>}
 */
export async function removeBackgroundFromFile(file, backgroundColor = '#ffffff', outputWidth) {
  const targetWidth = getOutputWidth(outputWidth);
  const removedBgImage = await removeBackgroundWithRemoveBg(file);
  const urlTransparent = renderImageToDataUrl(removedBgImage, {
    transparent: true,
    width: targetWidth,
  });
  const url = renderImageToDataUrl(removedBgImage, {
    backgroundColor,
    width: targetWidth,
  });
  return { url, urlTransparent };
}

/**
 * Redimensiona una imagen completa respetando el ancho elegido.
 * @param {File} file
 * @param {number} [outputWidth]
 * @returns {Promise<string>}
 */
export async function resizeImageFile(file, outputWidth) {
  const image = await fileToImageElement(file);
  const targetWidth = getOutputWidth(outputWidth);
  return renderImageToDataUrl(image, { width: targetWidth });
}

/**
 * Remueve el fondo usando la API de Remove.bg
 * Usa el API key configurado dinámicamente
 */
async function removeBackgroundWithRemoveBg(file) {
  const apiKey = config.apiKey;
  
  if (!apiKey) {
    throw new Error('API key de Remove.bg no configurada. Ingresa tu API key en la sección de Configuración.');
  }

  const formData = new FormData();
  formData.append('image_file', file);
  formData.append('format', 'png');
  formData.append('type', 'auto');
  formData.append('size', 'auto');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Remove.bg API error details:', errorData);
    if (response.status === 401) {
      throw new Error('API key inválida o expirada. Verifica tu API Key de Remove.bg');
    } else if (response.status === 402) {
      throw new Error('Créditos agotados en Remove.bg. Recarga tu cuenta.');
    } else {
      throw new Error(`Remove.bg API error: ${response.statusText} (${response.status})`);
    }
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
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      
      // Timeout para evitar que se quede esperando indefinidamente
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(url);
        reject(new Error('Timeout al cargar la imagen (>10s)'));
      }, 10000);
      
      img.onload = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        resolve(img);
      };
      
      img.onerror = (err) => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        console.error('Error al cargar imagen:', err, 'Archivo:', file.name, 'Tipo:', file.type);
        reject(new Error(`No se pudo cargar la imagen: ${file.name}`));
      };
      
      img.src = url;
    } catch (err) {
      reject(new Error(`Error creando objeto URL: ${err?.message || ''}`));
    }
  });
}


/**
 * Recorta el retrato con fondo sólido
 */
function cropPortrait(image, face, backgroundColor) {
  const EXPANSION_WIDTH = 1.5;
  const EXPANSION_HEIGHT = 1.8;
  const Y_OFFSET = -0.2;

  const centerX = face.x + face.width / 2;
  const faceTop = face.y;
  const faceBottom = face.y + face.height;
  const faceCenterY = faceTop + (faceBottom - faceTop) * (0.5 + Y_OFFSET);

  let cropWidth = face.width * EXPANSION_WIDTH;
  let cropHeight = face.height * EXPANSION_HEIGHT;

  let squareSize = Math.min(cropWidth, cropHeight);

  let x = centerX - squareSize / 2;
  let y = faceCenterY - squareSize / 2;

  ({ x, y, cropWidth: squareSize, cropHeight: squareSize } = clampToImageBounds({
    x,
    y,
    width: squareSize,
    height: squareSize,
    image,
  }));

  const canvas = document.createElement('canvas');
  const outputSize = getOutputSize(squareSize);
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');

  // Rellena con color de fondo base
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Dibuja la imagen cuadrada
  ctx.globalCompositeOperation = 'over';
  ctx.drawImage(
    image, 
    Math.round(x), 
    Math.round(y), 
    Math.round(squareSize), 
    Math.round(squareSize), 
    0, 0, 
    outputSize, 
    outputSize
  );

  return canvas.toDataURL('image/png');
}

/**
 * Recorta el retrato PRESERVANDO TRANSPARENCIA (sin fondo sólido)
 */
// Recorta el retrato PRESERVANDO TRANSPARENCIA usando segmentación BodyPix
function cropPortraitTransparent(image, face, segmentation) {
  const EXPANSION_WIDTH = 1.5;
  const EXPANSION_HEIGHT = 1.8;
  const Y_OFFSET = -0.2;

  const centerX = face.x + face.width / 2;
  const faceTop = face.y;
  const faceBottom = face.y + face.height;
  const faceCenterY = faceTop + (faceBottom - faceTop) * (0.5 + Y_OFFSET);

  let cropWidth = face.width * EXPANSION_WIDTH;
  let cropHeight = face.height * EXPANSION_HEIGHT;

  let squareSize = Math.min(cropWidth, cropHeight);

  let x = centerX - squareSize / 2;
  let y = faceCenterY - squareSize / 2;

  ({ x, y, cropWidth: squareSize, cropHeight: squareSize } = clampToImageBounds({
    x,
    y,
    width: squareSize,
    height: squareSize,
    image,
  }));

  const canvas = document.createElement('canvas');
  const outputSize = getOutputSize(squareSize);
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');

  // Dibuja la imagen recortada
  ctx.drawImage(
    image,
    Math.round(x),
    Math.round(y),
    Math.round(squareSize),
    Math.round(squareSize),
    0, 0,
    outputSize,
    outputSize
  );

  // Aplica la máscara de segmentación para transparencia
  if (segmentation && segmentation.data) {
    const imageData = ctx.getImageData(0, 0, outputSize, outputSize);
    const data = imageData.data;
    const segData = segmentation.data;
    const segWidth = segmentation.width;
    const segHeight = segmentation.height;
    // Relación de escalado entre segmentación y canvas
    const scaleX = outputSize / segWidth;
    const scaleY = outputSize / segHeight;
    for (let y = 0; y < outputSize; y++) {
      for (let x = 0; x < outputSize; x++) {
        const segX = Math.floor(x / scaleX);
        const segY = Math.floor(y / scaleY);
        const segIdx = segY * segWidth + segX;
        const personConfidence = segData[segIdx];
        const idx = (y * outputSize + x) * 4;
        // Si la confianza es baja, hacer el píxel transparente
        if (personConfidence < 0.5) {
          data[idx + 3] = 0;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Genera PNG transparente (sin fondo)
 * Mantiene la transparencia que Remove.bg ya generó
 */
export function createTransparentPNG(canvasDataUrl, backgroundColor) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const OUTPUT_SIZE = 700;
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      
      // Hacer canvas transparente (no rellenar con color)
      ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      
      // Dibujar imagen original directamente sin procesar
      // La transparencia de Remove.bg se mantiene como está
      ctx.drawImage(img, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = canvasDataUrl;
  });
}

/**
 * Convierte un color hexadecimal a RGB
 */
function parseHexColor(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 15, g: 23, b: 42 }; // Color por defecto
}

function getOutputWidth(outputWidth) {
  const fallback = Number.isFinite(config.outputSize) ? config.outputSize : 700;
  const requested = Number.isFinite(outputWidth) ? outputWidth : fallback;
  return Math.max(1, Math.round(requested || fallback));
}

function renderImageToDataUrl(image, { width, backgroundColor, transparent } = {}) {
  const targetWidth = width || image.width;
  const scale = targetWidth / image.width;
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!transparent) {
    ctx.fillStyle = backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

// Recorta el rostro usando segmentación BodyPix (para modo desarrollo) - encuadre cuadrado 1:1
function cropPortraitWithSegmentation(image, face, backgroundColor, segmentation) {
  const EXPANSION_WIDTH = 1.5; // expande más el ancho para incluir orejas y costados
  const EXPANSION_HEIGHT = 1.8; // expande más el alto para incluir toda la cabeza
  const Y_OFFSET = -0.2; // Desplaza el encuadre hacia arriba

  const centerX = face.x + face.width / 2;
  const faceTop = face.y;
  const faceBottom = face.y + face.height;
  
  // Centra verticalmente pero con offset hacia arriba para incluir toda la cabeza
  const faceCenterY = faceTop + (faceBottom - faceTop) * (0.5 + Y_OFFSET);

  let cropWidth = face.width * EXPANSION_WIDTH;
  let cropHeight = face.height * EXPANSION_HEIGHT;

  // Para encuadre CUADRADO sin deformación:
  // El lado del cuadrado es el mínimo entre ancho y alto disponible
  let squareSize = Math.min(cropWidth, cropHeight);

  let x = centerX - squareSize / 2;
  let y = faceCenterY - squareSize / 2;

  // Asegurar que el recorte cuadrado esté dentro de los límites de la imagen
  ({ x, y, cropWidth: squareSize, cropHeight: squareSize } = clampToImageBounds({
    x,
    y,
    width: squareSize,
    height: squareSize,
    image,
  }));

  const canvas = document.createElement('canvas');
  const outputSize = getOutputSize(squareSize);
  canvas.width = outputSize;
  canvas.height = outputSize;
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
  
  // 3) Dibuja el canvas fuente al retrato final (cuadrado sin deformación)
  if (sourceCanvas) {
    ctx.drawImage(sourceCanvas, Math.round(x), Math.round(y), Math.round(squareSize), Math.round(squareSize), 0, 0, outputSize, outputSize);
  } else {
    ctx.drawImage(image, Math.round(x), Math.round(y), Math.round(squareSize), Math.round(squareSize), 0, 0, outputSize, outputSize);
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

// Ajusta las coordenadas del rostro si la imagen objetivo tiene otra escala
function scaleFaceForImage(face, sourceImage, targetImage) {
  if (!targetImage || !sourceImage) return face;
  if (sourceImage.width === targetImage.width && sourceImage.height === targetImage.height) {
    return face;
  }
  const scaleX = targetImage.width / sourceImage.width;
  const scaleY = targetImage.height / sourceImage.height;
  return {
    ...face,
    x: face.x * scaleX,
    y: face.y * scaleY,
    width: face.width * scaleX,
    height: face.height * scaleY,
  };
}

function getOutputSize(size) {
  const rawSize = Math.max(1, Math.round(size));
  const outputSize = Number.isFinite(config.outputSize) ? config.outputSize : 700;
  const normalizedSize = Math.max(1, Math.round(outputSize));
  return normalizedSize || rawSize;
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
