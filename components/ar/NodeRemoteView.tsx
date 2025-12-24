
import React, { useMemo, useEffect, useState } from 'react';
import { useTactical } from '../../contexts/TacticalContext';
import { useHardware } from '../../contexts/HardwareContext';

export const NodeRemoteView: React.FC = () => {
  const { selectedNodeId, setSelectedNodeId, detections } = useTactical();
  const { videoRef } = useHardware();
  const [traffic, setTraffic] = useState<number[]>([]);

  const node = useMemo(() => 
    detections.find(d => d.id === selectedNodeId), 
  [selectedNodeId, detections]);

  useEffect(() => {
    if (!selectedNodeId) return;
    const interval = setInterval(() => {
      setTraffic(prev => [...prev.slice(-15), Math.random() * 100]);
    }, 500);
    return () => clearInterval(interval);
  }, [selectedNodeId]);

  if (!node) return null;

  const isCamera = node.class.toLowerCase().includes('cam') || node.class === 'person';

  return (
    <div className="fixed top-24 right-4 md:top-auto md:bottom-32 md:right-10 z-[100] w-64 md:w-80 bg-black/80 border border-ghost-primary/30 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-right-10 duration-500 overflow-hidden rounded-lg">
      {/* Header */}
      <div className="flex justify-between items-center bg-ghost-primary/10 px-3 py-2 border-b border-ghost-primary/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-ghost-accent animate-pulse rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-widest text-ghost-primary">
            LIVE_LINK: {node.id.split('-')[0]}
          </span>
        </div>
        <button onClick={() => setSelectedNodeId(null)} className="text-ghost-primary hover:text-white transition-colors p-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Viewport */}
      <div className="relative aspect-video bg-black overflow-hidden border-b border-ghost-primary/10">
        {isCamera ? (
          <video 
            autoPlay playsInline muted 
            className="w-full h-full object-cover opacity-80 grayscale brightness-125 contrast-150"
            onLoadedMetadata={(e) => {
              if (videoRef.current?.srcObject) (e.target as HTMLVideoElement).srcObject = videoRef.current.srcObject;
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-ghost-dim/20">
             <div className="text-center">
                <div className="text-[10px] text-ghost-primary opacity-40 font-mono mb-2 uppercase tracking-tighter">DATA_STREAM_ACTIVE</div>
                <div className="flex gap-1 justify-center items-end h-8">
                  {traffic.map((v, i) => (
                    <div key={i} className="w-1 bg-ghost-primary" style={{ height: `${v}%` }} />
                  ))}
                </div>
             </div>
          </div>
        )}
        
        {/* Scanning Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-ghost-primary/20 animate-scanline" />
          <div className="absolute inset-0 border border-ghost-primary/10" />
        </div>
      </div>

      {/* Info Panel */}
      <div className="p-3 bg-black/40">
        <div className="grid grid-cols-2 gap-2 text-[9px] md:text-[10px] font-mono text-white/60">
          <div>TYPE: <span className="text-ghost-primary">{node.type}</span></div>
          <div>PROTOCOL: <span className="text-ghost-accent">{node.protocol || 'GHOST_NET'}</span></div>
          <div>SIG_STR: <span className="text-ghost-primary">-{Math.floor(Math.random()*40+40)} dBm</span></div>
          <div>LATENCY: <span className="text-ghost-primary">12ms</span></div>
        </div>
        <div className="mt-3 text-[10px] text-ghost-primary/80 uppercase tracking-widest font-bold">
           STATUS: {node.action || 'SYNCHRONIZED'}
        </div>
      </div>

      <style>{`
        @keyframes scanline {
          0% { top: 0; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scanline { animation: scanline 2s linear infinite; }
      `}</style>
    </div>
  );
};
