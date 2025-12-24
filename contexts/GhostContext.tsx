
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { GhostContextType, SystemStatus, GhostConnectionStatus, ChatMessage, TrackedObject } from '../types';
import { useHardware } from './HardwareContext';
import { useTactical } from './TacticalContext';
import { base64ToUint8Array, uint8ArrayToBase64, pcmToAudioBuffer, captureFrameBase64 } from '../services/audioUtils';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from "@google/genai";
import { saveMemory, getMemories, findRelevantMemories, getSkills, learnSkill, scheduleTask } from '../services/neonService';
import { analyzeImageMultimodal } from '../services/aiService';

const GhostContext = createContext<GhostContextType | undefined>(undefined);

const AUDIO_MODELS = [
  'gemini-2.5-flash-native-audio-preview-09-2025', 
  'gemini-2.0-flash-exp'
];

const performVisualAnalysis = async (apiKey: string, base64Image: string, prompt: string): Promise<string> => {
    const result = await analyzeImageMultimodal(base64Image, prompt);
    return result.text;
};

const AUDIO_WORKLET_SRC = `
class RecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.bufferSize = 2048; 
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIdx = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input.length) return true;
    const channelData = input[0];
    for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bufferIdx++] = channelData[i];
        if (this.bufferIdx >= this.bufferSize) {
            this.flush();
        }
    }
    return true;
  }
  flush() {
    const buffer = new ArrayBuffer(this.bufferIdx * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < this.bufferIdx; i++) {
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      const pcm = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(i * 2, pcm, true);
    }
    this.port.postMessage(buffer, [buffer]);
    this.bufferIdx = 0;
  }
}
registerProcessor('recorder-processor', RecorderProcessor);
`;

const tools: FunctionDeclaration[] = [
  {
    name: 'update_object_description',
    parameters: {
      type: Type.OBJECT,
      description: 'Обновить метку и описание человека или объекта, которого ты видишь. ПИШИ ТОЛЬКО НА РУССКОМ.',
      properties: {
        label: { type: Type.STRING, description: 'Краткий класс/имя (например: "ОФИЦЕР", "ОБЪЕКТ").' },
        details: { type: Type.STRING, description: 'Короткое тактическое описание (цвет, действие, статус).' },
        color: { type: Type.STRING, description: 'HEX цвет (RED, ORANGE, GREEN, CYAN, WHITE).' }
      },
      required: ['label', 'details']
    }
  },
  {
    name: 'place_world_marker',
    parameters: {
      type: Type.OBJECT,
      description: 'Поставить 3D метку (waypoint) в пространстве на координатах.',
      properties: {
        label: { type: Type.STRING },
        x: { type: Type.NUMBER, description: '0-1 (screen space)' },
        y: { type: Type.NUMBER, description: '0-1 (screen space)' },
      },
      required: ['label', 'x', 'y']
    }
  },
  {
    name: 'save_memory',
    parameters: {
      type: Type.OBJECT,
      description: 'Запомнить важную информацию, имя человека или факт на будущее (Долгосрочная память).',
      properties: {
        content: { type: Type.STRING, description: 'Что именно запомнить (например: "Этого человека зовут Алексей, он медик").' },
        type: { type: Type.STRING, description: 'Тип: PERSON, LOCATION, или FACT.' },
        tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Ключевые слова для поиска (например: ["FACE", "IVAN"]).' }
      },
      required: ['content', 'type']
    }
  },
  {
    name: 'schedule_task',
    parameters: {
      type: Type.OBJECT,
      description: 'Запланировать задачу на будущее (напоминание, проверка).',
      properties: {
        seconds: { type: Type.NUMBER, description: 'Через сколько секунд выполнить.' },
        taskType: { type: Type.STRING, description: 'Тип задачи: REMINDER или CHECK.' },
        payload: { type: Type.STRING, description: 'Текст напоминания или инструкции.' }
      },
      required: ['seconds', 'taskType', 'payload']
    }
  },
  {
    name: 'learn_skill',
    parameters: {
      type: Type.OBJECT,
      description: 'Обучиться новому навыку или протоколу поведения (сохранить в базу знаний).',
      properties: {
        name: { type: Type.STRING, description: 'Название навыка (например: "Протокол Осмотра").' },
        instruction: { type: Type.STRING, description: 'Текст инструкции, как себя вести.' }
      },
      required: ['name', 'instruction']
    }
  }
];

export const GhostProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, videoRef } = useHardware();
  const { addGhostMarker, attachAiLabel, setAnalyzeTarget, myUnitId } = useTactical();
  
  const [ghostConnectionStatus, setGhostConnectionStatus] = useState<GhostConnectionStatus>('DISCONNECTED');
  const [ghostError, setGhostError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userVolume, setUserVolume] = useState(0);
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [liveAiTranscript, setLiveAiTranscript] = useState('');
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const isSessionActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const activeModelIndexRef = useRef(0);
  
  const retryCountRef = useRef(0);
  const reconnectTimerRef = useRef<any>(null);
  
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  useEffect(() => {
    let animId: number;
    const updateVolume = () => {
        if (inputAnalyserRef.current) {
            const data = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
            inputAnalyserRef.current.getByteFrequencyData(data);
            let sum = 0;
            for(let i=0; i<data.length; i++) sum += data[i];
            setUserVolume(sum / data.length);
        }
        animId = requestAnimationFrame(updateVolume);
    };
    updateVolume();
    return () => cancelAnimationFrame(animId);
  }, []);

  // --- VISUAL HEARTBEAT (1 FPS) ---
  useEffect(() => {
    if (ghostConnectionStatus !== 'CONNECTED' || !videoRef.current) return;
    const visualLoop = setInterval(async () => {
        if (!isSessionActiveRef.current || !videoRef.current || videoRef.current.paused) return;
        try {
            const base64 = await captureFrameBase64(videoRef.current, 640, 480);
            sessionPromiseRef.current?.then(session => {
                session.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64 } });
            });
        } catch (e) { console.debug("Visual heartbeat skipped", e); }
    }, 1000);
    return () => clearInterval(visualLoop);
  }, [ghostConnectionStatus, videoRef]);

  // --- DEEP ANALYSIS WITH MEMORY RECALL ---
  const analyzeTarget = useCallback(async (target: TrackedObject): Promise<string> => {
      if (!videoRef.current) return "";
      try {
          const base64 = await captureFrameBase64(videoRef.current, 320, 240);
          
          // 1. Context Lookup: Check DB for memories related to this object class
          // Mapping generic COCO classes to search tags
          let searchTags = [target.class.toUpperCase()];
          if (target.class === 'person') searchTags.push('FACE', 'NAME');
          
          const relevantMemories = await findRelevantMemories(searchTags);
          const memoryContext = relevantMemories.length > 0 
            ? `\nНАЙДЕНЫ ЗАПИСИ В ПАМЯТИ:\n${relevantMemories.map(m => `- ${m.content} [${m.type}]`).join('\n')}\nЕСЛИ ОБЪЕКТ ПОХОЖ, ИСПОЛЬЗУЙ ЭТИ ДАННЫЕ.`
            : "";

          const boxPrompt = `
          Проанализируй объект в рамке [${target.y.toFixed(2)}, ${target.x.toFixed(2)}, ${(target.y+target.h).toFixed(2)}, ${(target.x+target.w).toFixed(2)}].
          Возможный класс: ${target.class}.
          ${memoryContext}
          
          ЗАДАЧА: Переименуй метку на что-то конкретное (например, 'МУЖЧИНА' -> 'СОЛДАТ', 'МАШИНА' -> 'БТР-80') и добавь 3 слова визуального описания.
          ЕСЛИ УЗНАЛ ИЗ ПАМЯТИ - НАПИШИ ИМЯ.
          ВСЁ ДОЛЖНО БЫТЬ СТРОГО НА РУССКОМ ЯЗЫКЕ.
          
          ФОРМАТ ОТВЕТА СТРОГО:
          МЕТКА | ОПИСАНИЕ
          `;
          
          const description = await performVisualAnalysis("", base64, boxPrompt);
          return description.trim();
      } catch (e) {
          console.error(e);
          return "ОШИБКА | ПОВТОР";
      }
  }, [videoRef]);

  useEffect(() => {
    setAnalyzeTarget(analyzeTarget);
    return () => setAnalyzeTarget(null);
  }, [setAnalyzeTarget, analyzeTarget]);

  const performDiagnostics = useCallback(async (): Promise<boolean> => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        return true;
    } catch (e) { return false; }
  }, []);

  const cleanupAudioResources = useCallback(() => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
      activeSourcesRef.current.clear();
      nextStartTimeRef.current = 0;
      setIsSpeaking(false);
      if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
      if (inputCtxRef.current) { inputCtxRef.current.close(); inputCtxRef.current = null; }
      if (outputCtxRef.current) { outputCtxRef.current.close(); outputCtxRef.current = null; }
      isSessionActiveRef.current = false;
  }, []);

  const attemptReconnect = useCallback((switchModel = false) => {
      cleanupAudioResources();
      setGhostConnectionStatus('RECONNECTING');
      if (switchModel) {
          activeModelIndexRef.current = (activeModelIndexRef.current + 1) % AUDIO_MODELS.length;
          retryCountRef.current = 0; 
      }
      const delay = Math.min(1000 * Math.pow(2, Math.min(retryCountRef.current, 5)), 5000);
      retryCountRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => { connect(true); }, delay);
  }, [cleanupAudioResources]);

  const connect = useCallback(async (isRetry = false) => {
    if ((ghostConnectionStatus === 'CONNECTED' || ghostConnectionStatus === 'CONNECTING') && !isRetry) return;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    
    setGhostConnectionStatus(isRetry ? 'RECONNECTING' : 'CONNECTING');
    if (isRetry) { cleanupAudioResources(); await new Promise(r => setTimeout(r, 500)); }
    
    try {
      // Load context
      const memories = await getMemories(5);
      const skills = await getSkills();
      
      const memoryContext = memories.map(m => `[ПАМЯТЬ: ${m.type}] ${m.content}`).join('\n');
      const skillContext = skills.length > 0 ? `\n[ВЫУЧЕННЫЕ НАВЫКИ]:\n${skills.join('\n')}` : "";

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, echoCancellation: true, noiseSuppression: true }});
      mediaStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inCtx = new AudioContextClass({ sampleRate: 16000 });
      inputCtxRef.current = inCtx;
      await inCtx.resume();
      
      const inAnalyser = inCtx.createAnalyser();
      inputAnalyserRef.current = inAnalyser;
      
      const blob = new Blob([AUDIO_WORKLET_SRC], { type: 'application/javascript' });
      await inCtx.audioWorklet.addModule(URL.createObjectURL(blob));
      const source = inCtx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(inCtx, 'recorder-processor');
      workletNodeRef.current = worklet;
      source.connect(inAnalyser);
      inAnalyser.connect(worklet);

      const outCtx = new AudioContextClass({ sampleRate: 24000 });
      outputCtxRef.current = outCtx;
      const outAnalyser = outCtx.createAnalyser();
      outAnalyser.connect(outCtx.destination);
      outputAnalyserRef.current = outAnalyser;

      const currentModel = AUDIO_MODELS[activeModelIndexRef.current];
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: currentModel,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          inputAudioTranscription: {}, 
          tools: [{ functionDeclarations: tools }],
          systemInstruction: `
          ТЫ: Тактический ИИ ВЕРА.
          Язык общения: ТОЛЬКО РУССКИЙ.
          КОНТЕКСТ ПАМЯТИ: ${memoryContext}
          ${skillContext}
          ПРОТОКОЛ:
          1. Отвечай кратко, четко, в военном стиле.
          2. Анализируй визуальные данные, которые поступают.
          3. Если видишь что-то важное, используй инструмент 'update_object_description' (все параметры на русском).
          4. Если тебя просят что-то напомнить или сделать позже, используй 'schedule_task'.
          5. Если тебя просят запомнить новое правило или навык, используй 'learn_skill'.
          `,
        },
        callbacks: {
          onopen: () => {
            setGhostConnectionStatus('CONNECTED'); setGhostError(null); isSessionActiveRef.current = true; retryCountRef.current = 0;
            worklet.port.onmessage = (e) => {
              if (isSessionActiveRef.current) {
                 const int16Data = new Int16Array(e.data);
                 let sum = 0; for(let i=0; i<int16Data.length; i+=10) sum += Math.abs(int16Data[i]);
                 if ((sum / (int16Data.length / 10)) > (isSpeakingRef.current ? 600 : 20)) {
                    sessionPromiseRef.current?.then(s => s.sendRealtimeInput({ media: { mimeType: 'audio/pcm;rate=16000', data: uint8ArrayToBase64(new Uint8Array(e.data)) }}));
                 }
              }
            };
          },
          onmessage: async (msg: LiveServerMessage) => {
             const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (audioData) {
                 const ctx = outputCtxRef.current!; if (ctx.state === 'suspended') await ctx.resume();
                 const buffer = await pcmToAudioBuffer(base64ToUint8Array(audioData), ctx);
                 const now = ctx.currentTime;
                 if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.15;
                 const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(outputAnalyserRef.current!);
                 source.start(nextStartTimeRef.current); nextStartTimeRef.current += buffer.duration;
                 setIsSpeaking(true); activeSourcesRef.current.add(source);
                 source.onended = () => { activeSourcesRef.current.delete(source); if (activeSourcesRef.current.size === 0) setIsSpeaking(false); };
             }
             if (msg.serverContent?.inputTranscription) setLiveUserTranscript(p => p + msg.serverContent.inputTranscription.text);
             if (msg.serverContent?.outputTranscription) setLiveAiTranscript(p => p + msg.serverContent.outputTranscription.text);
             if (msg.serverContent?.turnComplete) {
                 setLiveUserTranscript(''); setLiveAiTranscript('');
             }
             if (msg.toolCall) {
                for (const fc of msg.toolCall.functionCalls) {
                    let result = "OK";
                    if (fc.name === 'place_world_marker') {
                        addGhostMarker({ id: `NOTE-${Date.now()}`, label: fc.args['label'] as string, color: '#FFFFFF', x: fc.args['x'] as number, y: fc.args['y'] as number, unitId: 'AI' });
                    } else if (fc.name === 'update_object_description') {
                        attachAiLabel('any', fc.args['label'] as string, fc.args['color'] as string || '#FFF', fc.args['details'] as string);
                    } else if (fc.name === 'save_memory') {
                        await saveMemory(fc.args['content'] as string, fc.args['type'] as string, fc.args['tags'] as string[]);
                        result = "MEMORY_SAVED";
                    } else if (fc.name === 'schedule_task') {
                        await scheduleTask(myUnitId, fc.args['seconds'] as number, fc.args['taskType'] as string, fc.args['payload'] as string);
                        result = "TASK_SCHEDULED";
                    } else if (fc.name === 'learn_skill') {
                        await learnSkill(fc.args['name'] as string, fc.args['instruction'] as string);
                        result = "SKILL_LEARNED";
                    }
                    sessionPromiseRef.current?.then(s => s.sendToolResponse({ functionResponses: { response: { result }, id: fc.id, name: fc.name } }));
                }
             }
          },
          onclose: () => attemptReconnect(false),
          onerror: (e) => attemptReconnect(true)
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (e) { attemptReconnect(true); }
  }, [ghostConnectionStatus, attemptReconnect, myUnitId]);

  useEffect(() => { if (status === SystemStatus.ACTIVE && ghostConnectionStatus === 'DISCONNECTED' && !ghostError) connect(); }, [status, ghostConnectionStatus, ghostError, connect]);

  const getAnalyserData = useCallback((target: 'in' | 'out') => {
      const analyser = target === 'in' ? inputAnalyserRef.current : outputAnalyserRef.current;
      if (!analyser) return new Uint8Array(0);
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      return data;
  }, []);

  return (
    <GhostContext.Provider value={{
      isConnected: ghostConnectionStatus === 'CONNECTED', ghostConnectionStatus, ghostError, isSpeaking, connect: () => connect(true), 
      activeEngine: 'GEMINI_LIVE', liveUserTranscript, liveAiTranscript, chatLog, userVolume, audioFrequencies: new Uint8Array(0), getAnalyserData,
      updateSceneContext: () => {}, showApiKeySelectionPrompt: false, handleOpenApiKeySelection: async () => {}, myUnitId: 'USER', 
      askGhost: () => {}, performDiagnostics, analyzeTarget
    }}>
      {children}
    </GhostContext.Provider>
  );
};
export const useGhost = () => useContext(GhostContext)!;
