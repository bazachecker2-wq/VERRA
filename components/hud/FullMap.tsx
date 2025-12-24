
import React, { useEffect, useRef } from 'react';
import { useTactical } from '../../contexts/TacticalContext';

export const FullMap: React.FC<{ onClose: () => void; onChat: (id: string) => void }> = ({ onClose, onChat }) => {
  const { myLocation, onlineUsers, ghostMarkers, myUnitId } = useTactical();
  const mapRef = useRef<HTMLDivElement>(null);
  const yMap = useRef<any>(null);

  useEffect(() => {
    // FIX: Using type assertion for window.ymaps to resolve TS errors
    if (!(window as any).ymaps || !mapRef.current) return;
    (window as any).ymaps.ready(() => {
      yMap.current = new (window as any).ymaps.Map(mapRef.current, {
        center: myLocation,
        zoom: 14,
        controls: ['zoomControl']
      });

      // Добавление пользователей на карту
      onlineUsers.forEach(user => {
        const isMe = user.unit_id === myUnitId;
        const placemark = new (window as any).ymaps.Placemark([user.lat, user.lng], {
          hintContent: user.unit_id,
          balloonContent: isMe ? "ВЫ" : `УЗЕЛ: ${user.unit_id}`
        }, {
          preset: isMe ? 'islands#redCircleDotIcon' : 'islands#blueCircleDotIcon',
          iconColor: isMe ? '#ff0000' : '#00ff94'
        });

        placemark.events.add('click', () => {
          if (!isMe) onChat(user.unit_id);
        });

        yMap.current.geoObjects.add(placemark);
      });
    });

    return () => {
      if (yMap.current) yMap.current.destroy();
    };
  }, [onlineUsers, myLocation, myUnitId, onChat]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl p-6 md:p-10 flex flex-col animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <div>
          <h2 className="text-ghost-primary font-black text-xl md:text-3xl tracking-tighter uppercase italic">Global_Tactical_Overlook</h2>
          <p className="text-white/40 text-[10px] tracking-widest uppercase mt-1">Satellite_Uplink: ESTABLISHED // Node_Count: {onlineUsers.length}</p>
        </div>
        <button 
          onClick={onClose}
          className="bg-ghost-primary text-black px-6 py-3 md:px-8 md:py-2 text-sm md:text-base font-black uppercase hover:bg-white transition-all shadow-[0_0_20px_rgba(0,255,148,0.5)] rounded"
        >
          [ Close_Visor ]
        </button>
      </div>
      
      <div className="flex-1 relative border-2 border-ghost-primary/30 overflow-hidden rounded">
        <div ref={mapRef} className="w-full h-full opacity-90" />
        
        {/* HUD Elements */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
          <div className="bg-black/80 border-l-4 border-ghost-primary px-4 py-2 rounded-r">
            <div className="text-[10px] md:text-xs text-ghost-primary font-black uppercase tracking-tighter">Coordinates</div>
            <div className="text-[10px] md:text-xs text-white font-mono">{myLocation[0].toFixed(6)} N, {myLocation[1].toFixed(6)} E</div>
          </div>
        </div>
        
        <div className="absolute bottom-4 right-4 bg-black/80 border border-ghost-primary/20 p-4 w-48 pointer-events-none rounded">
          <div className="text-[10px] text-white/50 mb-2 font-bold uppercase tracking-widest">Active_Markers</div>
          {ghostMarkers.map(m => (
            <div key={m.id} className="text-[10px] md:text-xs text-ghost-primary truncate">• {m.label}</div>
          ))}
        </div>
      </div>
    </div>
  );
};
