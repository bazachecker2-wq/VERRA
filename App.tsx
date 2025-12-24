
import React, { useEffect, useState, useMemo } from 'react';
import { HardwareProvider, useHardware } from './contexts/HardwareContext';
import { TacticalProvider, useTactical } from './contexts/TacticalContext';
import { GhostProvider } from './contexts/GhostContext';
import { BootScreen } from './components/screens/BootScreen';
import { BoundingBoxLayer } from './components/ar/BoundingBoxLayer';
import { SpatialGridLayer } from './components/ar/SpatialGridLayer';
import { SwarmLayer } from './components/ar/SwarmLayer';
import { StatusOverlay } from './components/hud/StatusOverlay';
import { ApiKeyPrompt } from './components/hud/ApiKeyPrompt';
import { NodeRemoteView } from './components/ar/NodeRemoteView';
import { UserList } from './components/hud/UserList';
import { MiniMap } from './components/hud/MiniMap';
import { FullMap } from './components/hud/FullMap';
import { SurveillanceSystem } from './components/hud/SurveillanceSystem';
import { SystemStatus } from './types';

const MainUI: React.FC = () => {
  const { 
    status, videoRef, visionMode, isStereoMode, zoomLevel
  } = useHardware();
  const { detections, activeSwap, myUnitId, visualOverrides, ghostMarkers, toggleSwarm, isSwarmActive, trackedObjectsRef } = useTactical();
  
  const [showFullMap, setShowFullMap] = useState(false);
  const [showSurveillance, setShowSurveillance] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [smoothedZoom, setSmoothedZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Клавиши управления
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'm') setShowFullMap(prev => !prev);
      if (e.key.toLowerCase() === 'n') setShowSurveillance(prev => !prev);
      if (e.key.toLowerCase() === 'b') toggleSwarm();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleSwarm]);

  // Isolation Style
  const isolationStyle = useMemo(() => {
    if (!visualOverrides.isBackgroundRemoved || !visualOverrides.isolatedObjectId) return {};
    const target = detections.find(d => d.id === visualOverrides.isolatedObjectId);
    if (!target || !target.normalizedBbox) return {};
    const [x, y, w, h] = target.normalizedBbox;
    return {
      clipPath: `inset(${y * 100}% ${(1 - (x + w)) * 100}% ${(1 - (y + h)) * 100}% ${x * 100}%)`,
      willChange: 'clip-path'
    };
  }, [visualOverrides, detections]);

  // Smooth Zoom & Pan
  useEffect(() => {
    if (status !== SystemStatus.ACTIVE) return;
    
    let targetX = 0;
    let targetY = 0;
    
    if (visualOverrides.isolatedObjectId && trackedObjectsRef.current) {
        const obj = trackedObjectsRef.current.get(visualOverrides.isolatedObjectId);
        if (obj) {
            const cx = obj.x + obj.w / 2;
            const cy = obj.y + obj.h / 2;
            targetX = (0.5 - cx) * 100; 
            targetY = (0.5 - cy) * 100;
        }
    }

    const interval = setInterval(() => {
      const targetZ = Math.max(zoomLevel, visualOverrides.targetZoom);
      setSmoothedZoom(prev => prev + (targetZ - prev) * 0.1);
      setPanX(prev => prev + (targetX - prev) * 0.1);
      setPanY(prev => prev + (targetY - prev) * 0.1);
    }, 16); 

    return () => clearInterval(interval);
  }, [zoomLevel, status, visualOverrides, trackedObjectsRef]);

  const filterClass = useMemo(() => {
    if (activeSwap) return 'contrast-150 saturate-0 brightness-125 sepia'; // Remote Feed Effect
    if (visionMode === 'NORMAL') return '';
    if (visionMode === 'NIGHT') return 'brightness-125 contrast-125 hue-rotate-90 saturate-150';
    if (visionMode === 'THERMAL') return 'invert hue-rotate-180 saturate-200';
    return 'grayscale contrast-200 brightness-75';
  }, [visionMode, activeSwap]);

  if (status === SystemStatus.BOOTING || status === SystemStatus.STANDBY) return <BootScreen />;

  const RenderViewport = (isLeft = false, isRight = false) => (
    <div className={`relative ${isStereoMode ? 'w-1/2' : 'w-full'} h-full overflow-hidden`}>
      <div 
        className="absolute inset-0 w-full h-full origin-center" 
        style={{ 
            transform: `scale(${smoothedZoom}) translate(${panX}%, ${panY}%)`, 
            willChange: 'transform' 
        }}
      >
        <video
          ref={isLeft || !isStereoMode ? videoRef : null}
          autoPlay playsInline muted
          className={`absolute inset-0 w-full h-full object-cover ${filterClass}`}
          style={{ willChange: 'filter' }}
        />
        
        {/* Active Swap Overlay (Simulation of receiving remote feed) */}
        {activeSwap && (
            <div className="absolute inset-0 z-20 pointer-events-none mix-blend-overlay">
                <div className="absolute inset-0 bg-blue-900/20" />
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }} />
                <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-black/80 border border-ghost-peer px-4 py-1">
                    <span className="text-ghost-peer text-xs font-black animate-pulse">
                        ВХОДЯЩИЙ ПОТОК: {activeSwap.visor_target} ({Math.max(0, Math.floor((activeSwap.visor_expires - Date.now())/1000))}с)
                    </span>
                </div>
            </div>
        )}

        {visualOverrides.isBackgroundRemoved && videoRef.current && (
           <video autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover z-10" style={isolationStyle}
             onLoadedMetadata={(e) => { if (videoRef.current?.srcObject) (e.target as HTMLVideoElement).srcObject = videoRef.current.srcObject; }}
           />
        )}
        
        <SpatialGridLayer />
        <SwarmLayer />
        <BoundingBoxLayer />

        {/* Local Markers (DOM fallback) */}
        {ghostMarkers.filter(m => m.unitId === myUnitId).map(m => {
          return (
            <div 
              key={m.id} 
              className="absolute z-30 flex flex-col items-center transition-transform duration-300 ease-out" 
              style={{ 
                left: `${m.x*100}%`, 
                top: `${m.y*100}%`, 
                transform: 'translate(-50%, -50%)',
                willChange: 'transform' 
              }}
            >
              <div 
                className="w-6 h-6 md:w-10 md:h-10 border md:border-2 rounded-full flex items-center justify-center bg-black/60 shadow-[0_0_15px_rgba(0,0,255,0.4)] relative"
                style={{ borderColor: m.color, color: m.color }}
              >
                 <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-current" />
                 <span className="text-[6px] md:text-[8px] font-black tracking-tighter">Я</span>
              </div>
            </div>
          );
        })}
      </div>
      
      <StatusOverlay isLeftEye={isLeft} isRightEye={isRight} />
      <NodeRemoteView />
      <UserList initialTargetId={activeChatId} />
      <MiniMap onExpand={() => setShowFullMap(true)} />

      <div className="fixed bottom-6 right-4 md:bottom-10 md:right-10 z-50 flex flex-col gap-3 md:gap-4">
         <div className="text-[10px] md:text-[12px] font-black uppercase text-ghost-primary/50 text-right tracking-widest mb-[-2px] md:mb-[-5px]">МОДУЛИ</div>
         <div className="flex gap-3 md:gap-4">
            <button onClick={toggleSwarm} className={`backdrop-blur-md border w-12 h-12 md:w-16 md:h-16 flex flex-col items-center justify-center rounded-xl transition-all ${isSwarmActive ? 'bg-ghost-peer text-black border-ghost-peer' : 'bg-black/60 border-ghost-peer text-ghost-peer'}`}>
              <div className="text-lg md:text-2xl mb-0.5 md:mb-1">❖</div>
            </button>
            <button onClick={() => setShowSurveillance(true)} className="bg-black/60 backdrop-blur-md border border-ghost-primary text-ghost-primary w-12 h-12 md:w-16 md:h-16 flex flex-col items-center justify-center rounded-xl">
              <div className="text-lg md:text-2xl mb-0.5 md:mb-1">👁</div>
            </button>
            <button onClick={() => setShowFullMap(true)} className="bg-black/60 backdrop-blur-md border border-ghost-primary text-ghost-primary w-12 h-12 md:w-16 md:h-16 flex flex-col items-center justify-center rounded-xl">
               <div className="text-lg md:text-2xl mb-0.5 md:mb-1">🗺</div>
            </button>
         </div>
      </div>
    </div>
  );

  return (
    // FIXED: Use 'fixed' and 'h-[100dvh]' to prevent browser chrome from shifting layout
    <div className="fixed inset-0 w-full h-[100dvh] bg-black overflow-hidden font-mono text-white">
      <div className={`flex w-full h-full ${isStereoMode ? 'flex-row' : ''}`}>
        {!isStereoMode ? RenderViewport() : ( <> {RenderViewport(true, false)} {RenderViewport(false, true)} </> )}
      </div>
      {showFullMap && <FullMap onClose={() => setShowFullMap(false)} onChat={(id) => { setActiveChatId(id); setShowFullMap(false); }} />}
      {showSurveillance && <SurveillanceSystem onClose={() => setShowSurveillance(false)} />}
      <ApiKeyPrompt />
      <div className="hud-scanline opacity-5 md:opacity-10 pointer-events-none" />
    </div>
  );
};

const App: React.FC = () => (
  <HardwareProvider>
    <TacticalProvider>
      <GhostProvider>
        <MainUI />
      </GhostProvider>
    </TacticalProvider>
  </HardwareProvider>
);
export default App;
