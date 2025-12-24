
import React, { useEffect, useRef, useState } from 'react';
import { useTactical } from '../../contexts/TacticalContext';
import { useHardware } from '../../contexts/HardwareContext';

export const SwarmLayer: React.FC = () => {
  const { swarmAgentsRef, isSwarmActive, triangulateMarker } = useTactical();
  const { videoRef } = useHardware();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Force re-render loop
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isSwarmActive) return;
    const interval = setInterval(() => setTick(t => t + 1), 100); 
    return () => clearInterval(interval);
  }, [isSwarmActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isSwarmActive) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;
    const render = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // 1. Center Reticle (Triangulation Point)
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // 2. Drone Lasers & Links
        swarmAgentsRef.current.forEach(agent => {
            const ax = agent.x * canvas.width;
            const ay = agent.y * canvas.height;
            
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(centerX, centerY);
            
            const grad = ctx.createLinearGradient(ax, ay, centerX, centerY);
            grad.addColorStop(0, agent.status === 'LOCKED' ? '#00E5FF' : '#FFD700');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            
            ctx.strokeStyle = grad;
            ctx.lineWidth = agent.status === 'LOCKED' ? 2 : 0.5;
            ctx.stroke();
            
            // Text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '9px "JetBrains Mono"';
            ctx.fillText(agent.unitId, ax + 10, ay);
        });

        rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [isSwarmActive, swarmAgentsRef]);

  if (!isSwarmActive) return null;

  return (
    <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {swarmAgentsRef.current.map((agent, i) => (
         <div 
            key={agent.id}
            className="absolute transition-all duration-300 ease-out pointer-events-auto"
            style={{ 
                left: i === 0 ? '5%' : i === 1 ? 'auto' : '50%',
                right: i === 1 ? '5%' : 'auto',
                top: i === 2 ? '15%' : '50%', 
                bottom: i === 2 ? 'auto' : 'auto',
                transform: i === 2 ? 'translateX(-50%)' : 'translateY(-50%)',
            }}
         >
            <div className="w-24 h-16 md:w-48 md:h-32 bg-black/90 border border-ghost-peer relative overflow-hidden shadow-[0_0_15px_rgba(0,229,255,0.3)] group">
                
                {/* VIDEO FEED RENDERER */}
                <div className="absolute inset-0 overflow-hidden opacity-90">
                     {agent.lastFrameBase64 ? (
                        <img 
                            src={`data:image/jpeg;base64,${agent.lastFrameBase64}`} 
                            className="w-full h-full object-cover"
                            alt="Remote Feed"
                            style={{ filter: 'contrast(1.2) sepia(0.5) hue-rotate(180deg)' }}
                        />
                     ) : (
                         // Fallback to local video distorted if no remote
                         videoRef.current && (
                            <video 
                                srcObject={videoRef.current.srcObject} 
                                autoPlay muted 
                                className="w-full h-full object-cover opacity-20"
                                style={{ transform: 'scale(2)' }}
                            />
                         )
                     )}
                     
                     {/* HUD Overlay inside drone view */}
                     <div className="absolute inset-0 border-[0.5px] border-ghost-peer/20 m-1" />
                     <div className="absolute top-1/2 left-1/2 w-2 h-2 border border-ghost-peer/50 -translate-x-1/2 -translate-y-1/2" />
                </div>
                
                {/* Info */}
                <div className="absolute inset-0 p-1 flex flex-col justify-between z-10">
                    <div className="flex justify-between items-center text-[8px] font-mono text-ghost-peer bg-black/60 px-1 backdrop-blur-sm">
                        <span>{agent.unitId}</span>
                        <span className={agent.battery < 30 ? 'text-red-500 blink' : 'text-ghost-peer'}>BAT: {agent.battery}%</span>
                    </div>
                    
                    <div className="text-[6px] font-mono text-white/70 bg-black/40 self-start px-1">
                        {agent.lastFrameBase64 ? 'LIVE FEED' : 'SEARCHING...'}
                    </div>
                </div>

                {/* Glitch Overlay */}
                {!agent.lastFrameBase64 && (
                    <div className="absolute inset-0 bg-ghost-peer/5 animate-pulse pointer-events-none mix-blend-overlay" />
                )}
            </div>
            
            <div className="absolute top-full left-1/2 w-[1px] h-4 bg-gradient-to-b from-ghost-peer/50 to-transparent" />
         </div>
      ))}

      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-auto">
         <button 
            onClick={triangulateMarker}
            className="bg-black/80 border border-ghost-peer text-ghost-peer px-8 py-2 font-black uppercase tracking-[0.2em] hover:bg-ghost-peer hover:text-black transition-all shadow-[0_0_20px_rgba(0,229,255,0.4)] clip-path-polygon"
            style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
         >
            СЛИЯНИЕ ДАННЫХ
         </button>
      </div>
    </div>
  );
};
