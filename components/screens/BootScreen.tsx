
import React, { useState, useEffect } from 'react';
import { useHardware } from '../../contexts/HardwareContext';
import { useTactical } from '../../contexts/TacticalContext';
import { useGhost } from '../../contexts/GhostContext';
import { SystemStatus } from '../../types';

export const BootScreen: React.FC = () => {
  const { initializeSystem, status } = useHardware();
  const { performDiagnostics: checkVision, visionWorkerStatus } = useTactical();
  const { performDiagnostics: checkAudio, userVolume } = useGhost();

  const [steps, setSteps] = useState([
    { id: 'cam', label: 'ОПТИЧЕСКИЕ СЕНСОРЫ', status: 'ОЖИДАНИЕ' },
    { id: 'vis', label: 'НЕЙРОННОЕ ЗРЕНИЕ', status: 'ОЖИДАНИЕ' },
    { id: 'aud', label: 'АУДИО КАНАЛ', status: 'ОЖИДАНИЕ' },
    { id: 'net', label: 'СЕТЬ GHOST', status: 'ОЖИДАНИЕ' },
  ]);
  
  const [isBooting, setIsBooting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const runDiagnostics = async () => {
    setIsBooting(true);

    // 1. Camera Check
    setSteps(s => s.map(i => i.id === 'cam' ? {...i, status: 'ЗАПУСК'} : i));
    try {
        await initializeSystem();
        setSteps(s => s.map(i => i.id === 'cam' ? {...i, status: 'НОРМА'} : i));
    } catch {
        setSteps(s => s.map(i => i.id === 'cam' ? {...i, status: 'ОШИБКА'} : i));
        return; 
    }

    // 2. Vision Check
    setSteps(s => s.map(i => i.id === 'vis' ? {...i, status: 'ЗАПУСК'} : i));
    const visionOk = await checkVision();
    setSteps(s => s.map(i => i.id === 'vis' ? {...i, status: visionOk ? 'НОРМА' : 'ПРЕДУПР'} : i));

    // 3. Audio Check
    setSteps(s => s.map(i => i.id === 'aud' ? {...i, status: 'ЗАПУСК'} : i));
    const audioOk = await checkAudio();
    setSteps(s => s.map(i => i.id === 'aud' ? {...i, status: audioOk ? 'НОРМА' : 'ОШИБКА'} : i));

    // 4. Finalize
    setSteps(s => s.map(i => i.id === 'net' ? {...i, status: 'НОРМА'} : i));
    
    setTimeout(() => setIsComplete(true), 1000);
  };

  if (isComplete && status === SystemStatus.ACTIVE) return null;

  return (
    <div className="fixed inset-0 bg-black z-[100] font-mono text-ghost-primary flex flex-col justify-center items-center p-8">
      <div className="w-full max-w-md border border-ghost-primary/30 p-8 bg-black/50 backdrop-blur-md relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-1 bg-ghost-primary/20" />
         
         <div className="flex justify-between items-end mb-8">
            <h1 className="text-4xl font-black italic tracking-tighter">GHOST_OS</h1>
            <span className="text-xs opacity-50">V.4.0.2 RUS</span>
         </div>

         <div className="flex flex-col gap-4 mb-8">
            {steps.map(step => (
                <div key={step.id} className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-sm font-bold tracking-widest">{step.label}</span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded ${
                        step.status === 'ОЖИДАНИЕ' ? 'text-white/30' :
                        step.status === 'ЗАПУСК' ? 'text-ghost-accent animate-pulse' :
                        step.status === 'НОРМА' ? 'bg-ghost-primary text-black' :
                        step.status === 'ПРЕДУПР' ? 'bg-orange-500 text-black' :
                        'bg-red-500 text-white'
                    }`}>
                        {step.status}
                    </span>
                </div>
            ))}
         </div>

         {!isBooting ? (
             <button 
                onClick={runDiagnostics}
                className="w-full py-4 bg-ghost-primary text-black font-black text-xl uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_20px_#00FF94]"
             >
                ИНИЦИАЛИЗАЦИЯ
             </button>
         ) : (
             <div className="text-center text-xs opacity-50 animate-pulse">
                ВЫПОЛНЯЕТСЯ ДИАГНОСТИКА... ОЖИДАЙТЕ
             </div>
         )}
      </div>
      
      <div className="absolute bottom-8 text-center text-[10px] opacity-30">
        ТАКТИЧЕСКИЙ ИНТЕРФЕЙС ДОПОЛНЕННОЙ РЕАЛЬНОСТИ<br/>
        НЕ ИСПОЛЬЗУЙТЕ ПРИ УПРАВЛЕНИИ ТЯЖЕЛОЙ ТЕХНИКОЙ
      </div>
    </div>
  );
};
