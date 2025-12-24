
// GHOST_OS: Neural Vision Worker (Optimized for OOM protection)
import * as tf from 'https://esm.sh/@tensorflow/tfjs@4.10.0';
import * as cocoSsd from 'https://esm.sh/@tensorflow-models/coco-ssd@2.2.3';

let model = null;
let isBusy = false;

const init = async () => {
  try {
    await tf.setBackend('webgl');
    await tf.ready();
    model = await cocoSsd.load({ base: 'mobilenet_v2' });
    postMessage({ type: 'STATUS', status: 'ACTIVE' });
  } catch (e) {
    postMessage({ type: 'STATUS', status: 'ERROR', error: e.message });
  }
};

init();

self.onmessage = async (e) => {
  const { type, imageBitmap, width, height, confidenceThreshold } = e.data;

  if (type === 'DETECT') {
    if (!model || isBusy) {
      if (imageBitmap) imageBitmap.close(); // Обязательно освобождаем память
      return;
    }

    isBusy = true;
    try {
      // Прямая детекция из ImageBitmap
      const predictions = await model.detect(imageBitmap, 6, confidenceThreshold || 0.4);
      
      const results = predictions.map((pred, idx) => ({
        class: pred.class,
        score: pred.score,
        normalizedBbox: [
          pred.bbox[0] / width,
          pred.bbox[1] / height,
          pred.bbox[2] / width,
          pred.bbox[3] / height
        ]
      }));

      postMessage({ type: 'DETECTION_COMPLETE', results });
    } catch (err) {
      console.error("VISION_ERROR:", err);
    } finally {
      if (imageBitmap) imageBitmap.close(); // Важнейший шаг для мобильных устройств
      isBusy = false;
    }
  }
};
