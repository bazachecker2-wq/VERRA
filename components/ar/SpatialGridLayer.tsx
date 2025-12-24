
import React, { useMemo } from 'react';
import { useHardware } from '../../contexts/HardwareContext';

export const SpatialGridLayer: React.FC = () => {
  const { status, sensors } = useHardware();
  
  if (status !== 'ACTIVE') return null;

  const gridStyle = useMemo(() => {
    const tiltX = (sensors.beta || 0) * 0.15;
    const tiltY = (sensors.gamma || 0) * 0.15;
    return {
      transform: `perspective(1200px) rotateX(${80 + tiltX}deg) rotateZ(${tiltY}deg)`,
    };
  }, [sensors.beta, sensors.gamma]);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
      {/* 1. Глобальный цикл сканирования */}
      <div className="absolute inset-0 opacity-15 animate-laser bg-gradient-to-b from-transparent via-ghost-primary/40 to-transparent" />

      {/* 2. Meta Quest Style Floor Grid */}
      <div 
        className="absolute bottom-[-30%] left-1/2 -translate-x-1/2 w-[400%] h-[150%] origin-bottom transition-transform duration-500 ease-out"
        style={{
          ...gridStyle,
          background: `
            radial-gradient(circle at center, rgba(0, 255, 148, 0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 148, 0.1) 1px, transparent 1px),
            linear-gradient(0deg, rgba(0, 255, 148, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse at bottom, black 30%, transparent 85%)'
        }}
      >
        {/* Пульсирующие точки пересечения (как в Layout) */}
        <div className="absolute inset-0 opacity-40 animate-pulse" 
             style={{ 
               backgroundImage: 'radial-gradient(circle, #00FF94 1px, transparent 1px)',
               backgroundSize: '60px 60px'
             }} 
        />
      </div>

      {/* 3. Вертикальные лазерные лучи (Ограничители пространства) */}
      <div className="absolute inset-0 flex justify-between px-[10%] opacity-10">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-full w-[1px] bg-ghost-primary animate-scan-beam" 
               style={{ animationDelay: `${i * 0.3}s` }} />
        ))}
      </div>

      {/* 4. Виньетка погружения */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)]" />
    </div>
  );
};
