# Modelos de face-api.js

Coloca aquí los pesos del modelo TinyFaceDetector para que la detección funcione en el navegador.

Archivos necesarios (dos archivos):
1. `tiny_face_detector_model-weights_manifest.json`
2. `tiny_face_detector_model-shard1` (binario)

Dónde obtenerlos:
- Descarga desde el repo de face-api.js: https://github.com/justadudewhohacks/face-api.js/tree/master/weights
- O bien desde una instalación existente: `node_modules/face-api.js/weights/` (si tu paquete los trae).

Ubicación final esperada:
```
public/models/tiny_face_detector_model-weights_manifest.json
public/models/tiny_face_detector_model-shard1
public/models/bodypix/model-stride16.json
public/models/bodypix/group1-shard1of2.bin
public/models/bodypix/group1-shard2of2.bin
```

Sin estos archivos, la carga de modelos fallará y la app mostrará "Error al cargar modelos".
