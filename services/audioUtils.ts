
// GHOST_OS: Native Audio Utils (Zero Dependencies)

let sharedCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
let sharedCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

/**
 * Captures a video frame and returns it as a base64 string (no header).
 * Optimized to use OffscreenCanvas if available to reduce main thread blocking.
 */
export const captureFrameBase64 = async (video: HTMLVideoElement, width = 640, height = 480): Promise<string> => {
  if (video.readyState < 2) return "";
  
  if (!sharedCanvas) {
    if (typeof OffscreenCanvas !== 'undefined') {
        sharedCanvas = new OffscreenCanvas(width, height);
        sharedCtx = sharedCanvas.getContext('2d', { alpha: false, desynchronized: true }) as OffscreenCanvasRenderingContext2D;
    } else {
        sharedCanvas = document.createElement('canvas');
        sharedCanvas.width = width;
        sharedCanvas.height = height;
        sharedCtx = sharedCanvas.getContext('2d', { alpha: false, desynchronized: true }) as CanvasRenderingContext2D;
    }
  }
  
  const canvas = sharedCanvas;
  const ctx = sharedCtx;
  if (!ctx) return "";

  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  ctx.drawImage(video, 0, 0, width, height);
  
  if (canvas instanceof OffscreenCanvas) {
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.5 });
      return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(',')[1]);
          };
          reader.readAsDataURL(blob);
      });
  } else {
      // Fallback for older browsers
      const dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/jpeg', 0.5);
      return dataUrl.split(',')[1];
  }
};

/**
 * Converts a Base64 string directly to a Uint8Array.
 * Uses native browser atob for performance.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a Base64 string.
 * Uses native browser btoa.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // Process in chunks to avoid stack overflow
  for (let i = 0; i < len; i += chunkSize) {
    // @ts-ignore - apply works with TypedArrays in modern browsers
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Converts raw PCM16 bytes (from Gemini) to an AudioBuffer for playback.
 * Gemini output usually 24kHz.
 */
export async function pcmToAudioBuffer(
  pcmData: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000
): Promise<AudioBuffer> {
  // Create a 16-bit view of the byte data
  const dataInt16 = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2);
  const frameCount = dataInt16.length;
  
  // Create buffer
  const audioBuffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  // Normalize Int16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  
  return audioBuffer;
}
