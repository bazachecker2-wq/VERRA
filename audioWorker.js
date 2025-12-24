
/**
 * GHOST_OS: Audio Processing Worker
 * Handles Float32 to Int16 PCM conversion and volume calculation.
 */

self.onmessage = (e) => {
  const { type, audioData, sampleRate } = e.data;

  if (type === 'PROCESS_AUDIO') {
    const pcm16 = floatTo16BitPCM(audioData);
    const volume = calculateVolume(audioData);
    
    // Возвращаем данные обратно в основной поток
    self.postMessage({
      type: 'AUDIO_PROCESSED',
      pcmData: pcm16.buffer,
      volume: volume
    }, [pcm16.buffer]);
  }
};

function floatTo16BitPCM(float32Array) {
  const buffer = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    // Ограничиваем значения диапазоном [-1, 1]
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    // Конвертируем в 16-bit PCM (Little Endian)
    buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return buffer;
}

function calculateVolume(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  // Возвращаем RMS громкость
  return Math.sqrt(sum / data.length);
}
