// Servicios centralizados para detección de rostros y recorte en formato retrato, removiendo fondo.
// Requiere: face-api.js, @tensorflow-models/body-pix y @tensorflow/tfjs (1.x para compatibilidad con face-api).

import * as faceapi from 'face-api.js';
import * as bodyPix from '@tensorflow-models/body-pix';
import * as tf from '@tensorflow/tfjs';

// Configuración dinámica
let config = {
  devMode: import.meta.env.VITE_DEV_MODE === 'true',
  apiKey: import.meta.env.VITE_REMOVEBG_API_KEY || '',
};

/**
 * Actualiza la configuración dinámicamente desde el front
 */
export function setConfig(newConfig) {
  config = { ...config, ...newConfig };
  console.log('⚙️ Configuración actualizada:', config);
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
  if (config.devMode) {
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
        urlTransparent: url,
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
        urlTransparent: url,
        sourceName: file.name,
      };
    });
  }

  return faces.map((face) => {
    // Generar AMBAS versiones: con fondo y transparente
    const urlWithBackground = cropPortrait(removedBgImage || image, face, backgroundColor);
    const urlTransparent = cropPortraitTransparent(removedBgImage || image, face);
    return {
      url: urlWithBackground,
      urlTransparent: urlTransparent,
      sourceName: file.name,
    };
  });
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
  const OUTPUT_SIZE = 700;
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
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
    OUTPUT_SIZE, 
    OUTPUT_SIZE
  );

  return canvas.toDataURL('image/png');
}

/**
 * Recorta el retrato PRESERVANDO TRANSPARENCIA (sin fondo sólido)
 */
function cropPortraitTransparent(image, face) {
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
  const OUTPUT_SIZE = 700;
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');

  // NO rellenar - canvas permanece transparente
  // Dibuja la imagen cuadrada directamente
  ctx.drawImage(
    image, 
    Math.round(x), 
    Math.round(y), 
    Math.round(squareSize), 
    Math.round(squareSize), 
    0, 0, 
    OUTPUT_SIZE, 
    OUTPUT_SIZE
  );

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
  canvas.width = Math.round(squareSize);
  canvas.height = Math.round(squareSize);
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
    ctx.drawImage(sourceCanvas, Math.round(x), Math.round(y), Math.round(squareSize), Math.round(squareSize), 0, 0, canvas.width, canvas.height);
  } else {
    ctx.drawImage(image, Math.round(x), Math.round(y), Math.round(squareSize), Math.round(squareSize), 0, 0, canvas.width, canvas.height);
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
