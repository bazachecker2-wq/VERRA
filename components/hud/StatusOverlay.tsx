
import React, { useEffect, useState, useRef } from 'react';
import { useGhost } from '../../contexts/GhostContext';
import { useTactical } from '../../contexts/TacticalContext';

export const StatusOverlay: React.FC<{ isLeftEye?: boolean; isRightEye?: boolean }> = ({ isLeftEye, isRightEye }) => {
  const { 
    ghostConnectionStatus, 
    liveUserTranscript, 
    liveAiTranscript, 
    chatLog,
    isSpeaking,
    getAnalyserData,
    userVolume 
  } = useGhost();
  // removed situationalLog usage
  
  const [time, setTime] = useState(new Date());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Auto-scroll logic
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, liveUserTranscript, liveAiTranscript]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter messages older than 10 seconds to keep HUD clean
  const visibleChatLog = chatLog.filter(msg => Date.now() - msg.timestamp < 10000);

  // VISUALIZER LOOP
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId: number;
    const bars = 20;
    const barWidth = 3;
    const gap = 2;
    const centerX = canvas.width / 2;
    const totalWidth = bars * (barWidth + gap);
    const startX = centerX - totalWidth / 2;

    const draw = () => {
      let data: Uint8Array | null = null;
      if (getAnalyserData) {
          data = isSpeaking ? getAnalyserData('out') : getAnalyserData('in');
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < bars; i++) {
        const x = startX + i * (barWidth + gap);
        const val = data ? data[i * 2] : 0; 
        const height = Math.max(2, (val / 255) * canvas.height);
        ctx.fillStyle = isSpeaking ? '#FFD700' : '#00FF94';
        ctx.globalAlpha = data ? 0.8 : 0.2;
        const y = (canvas.height - height) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, height, 1);
        ctx.fill();
      }
      rafId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafId);
  }, [isSpeaking, getAnalyserData]);

  const isOffline = ghostConnectionStatus !== 'CONNECTED';

  return (
    <div className={`absolute inset-0 pointer-events-none z-40 flex flex-col justify-between font-mono p-3 md:p-6 select-none ${isLeftEye ? 'pr-2' : isRightEye ? 'pl-2' : ''}`}>
      
      {/* TOP BAR */}
      <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1 md:gap-2">
              <div className="flex gap-2">
                <div className={`px-2 py-1 md:px-3 md:py-1 flex items-center gap-2 backdrop-blur-md rounded-full border transition-all ${isOffline ? 'bg-red-500/20 border-red-500/50' : 'bg-ghost-primary/5 border-ghost-primary/20'}`}>
                    <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-red-500 animate-pulse' : 'bg-ghost-primary shadow-[0_0_8px_#00FF94]'}`} />
                    <span className={`text-[10px] md:text-xs font-bold uppercase tracking-wider ${isOffline ? 'text-red-400' : 'text-ghost-primary'}`}>
                      {isOffline ? 'ОФФЛАЙН' : 'В СЕТИ'}
                    </span>
                </div>
                
                {!isOffline && (
                   <div className="px-2 py-1 md:px-3 md:py-1 flex items-center gap-2 backdrop-blur-md rounded-full border border-white/5 bg-black/20">
                     <span className={`text-[10px] md:text-xs font-bold uppercase tracking-wider ${isSpeaking ? 'text-ghost-accent' : 'text-white/30'}`}>
                        {isSpeaking ? 'ГОЛОС ИИ' : 'МИКРОФОН'}
                     </span>
                     {!isSpeaking && (
                        <div className="w-10 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-ghost-primary transition-all duration-75" style={{ width: `${Math.min(100, (userVolume / 30) * 100)}%` }} />
                        </div>
                     )}
                   </div>
                )}
              </div>
          </div>

          <div className="text-2xl md:text-4xl font-black text-white/80 font-tech">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
      </div>

      {/* BOTTOM AREA (SUBTITLES) */}
      <div className="w-full flex flex-col items-center justify-end pb-12 md:pb-16 gap-3">
          <div className="w-full max-w-2xl flex flex-col items-center gap-2 p-2 relative">
             {/* Dynamic Subtitles Area */}
             <div className="z-10 w-full flex flex-col items-center gap-2">
                {/* Completed phrases (fading out) */}
                {visibleChatLog.map(msg => (
                    <div key={msg.id} className={`flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <div className={`px-4 py-2 rounded-lg backdrop-blur-md border ${
                            msg.role === 'user' ? 'bg-black/40 border-white/10 text-white/90' : 'bg-ghost-primary/10 border-ghost-primary/30 text-ghost-primary'
                        }`}>
                           <span className="text-[10px] font-bold mr-2 opacity-50 uppercase">{msg.role === 'user' ? 'ВЫ' : 'ВЕРА'}</span>
                           <span className="text-sm md:text-base font-medium">{msg.text}</span>
                        </div>
                    </div>
                ))}

                {/* Live Transcript (Streaming) */}
                {liveUserTranscript && (
                    <div className="flex flex-col items-center animate-in slide-in-from-bottom-2 duration-100">
                        <div className="px-4 py-3 rounded-lg backdrop-blur-md border border-white/20 bg-white/10 text-white shadow-lg">
                           <span className="text-sm md:text-base font-bold">{liveUserTranscript}<span className="animate-pulse">_</span></span>
                        </div>
                    </div>
                )}
                
                {liveAiTranscript && (
                    <div className="flex flex-col items-center animate-in slide-in-from-bottom-2 duration-100">
                         <div className="px-4 py-3 rounded-lg backdrop-blur-md border border-ghost-primary/40 bg-black/60 text-ghost-accent shadow-[0_0_15px_rgba(255,215,0,0.2)]">
                           <span className="text-[10px] text-ghost-primary mr-2 uppercase">ВЕРА //</span>
                           <span className="text-sm md:text-base font-bold">{liveAiTranscript}</span>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
             </div>
          </div>
          <canvas ref={canvasRef} width={300} height={40} className="w-[200px] h-[30px] opacity-70" />
      </div>
    </div>
  );
};
