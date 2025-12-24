
/**
 * AudioProcessor - Оптимизированный модуль для захвата звука с минимальной задержкой.
 * Использует формат 16-bit PCM (LPCM), требуемый Gemini Live API.
 */

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048; // Накапливаем немного данных для снижения частоты сетевых пакетов
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const inputChannel = inputs[0][0];

    if (inputChannel && inputChannel.length > 0) {
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex++] = inputChannel[i];
        
        if (this.bufferIndex >= this.bufferSize) {
          const pcm16 = new Int16Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j++) {
            const s = Math.max(-1, Math.min(1, this.buffer[j]));
            pcm16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
          this.bufferIndex = 0;
        }
      }
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
