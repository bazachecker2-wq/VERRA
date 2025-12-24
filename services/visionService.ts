
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Detection } from '../types';

let model: cocoSsd.ObjectDetection | null = null;
let isModelLoading = false;

export const loadModel = async (): Promise<boolean> => {
  if (model) return true;
  if (isModelLoading) return false;

  isModelLoading = true;
  try {
    console.log('VISION: Initializing TensorFlow Backend...');
    await tf.ready();
    // Try WebGL for performance, fallback to CPU if needed
    try {
        await tf.setBackend('webgl');
    } catch (e) {
        console.warn('VISION: WebGL failed, falling back to CPU', e);
        await tf.setBackend('cpu');
    }
    
    console.log('VISION: Loading COCO-SSD Model...');
    model = await cocoSsd.load({
      base: 'mobilenet_v2' 
    });
    console.log('VISION: Model Loaded Successfully');
    isModelLoading = false;
    return true;
  } catch (e) {
    console.error("VISION: Model Load Error:", e);
    isModelLoading = false;
    return false;
  }
};

export const detectObjects = async (
  video: HTMLVideoElement,
  threshold: number = 0.5
): Promise<Detection[]> => {
  if (!model || video.readyState < 2) return [];

  try {
      // tf.tidy cleans up intermediate tensors automatically
      const predictions = await model.detect(video, 20, threshold);
      const timestamp = Date.now();

      return predictions.map((pred, index) => ({
        id: `${pred.class}-${index}`, // Simple ID for frame-local tracking
        class: pred.class,
        score: pred.score,
        // Normalized BBox [x, y, w, h] (0-1)
        normalizedBbox: [
            pred.bbox[0] / video.videoWidth,
            pred.bbox[1] / video.videoHeight,
            pred.bbox[2] / video.videoWidth,
            pred.bbox[3] / video.videoHeight
        ],
        timestamp,
        type: 'NEUTRAL',
        distance: 0,
        source: 'LOCAL',
        unitId: 'SELF'
      } as any)); // Cast to any to fit Detection interface temporarily
  } catch (e) {
      console.warn("VISION: Detection skipped frame", e);
      return [];
  }
};
