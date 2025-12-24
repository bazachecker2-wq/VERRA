
import React, { useEffect, useRef } from 'react';
import { useTactical } from '../../contexts/TacticalContext';

export const MiniMap: React.FC<{ onExpand: () => void }> = ({ onExpand }) => {
  const { myLocation, onlineUsers, myUnitId } = useTactical();
  const mapRef = useRef<HTMLDivElement>(null);
  const yMap = useRef<any>(null);
  const placemarksRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (!(window as any).ymaps || !mapRef.current) return;
    (window as any).ymaps.ready(() => {
      if (!yMap.current) {
        yMap.current = new (window as any).ymaps.Map(mapRef.current, {
          center: myLocation,
          zoom: 16,
          controls: []
        });
      } else {
        yMap.current.setCenter(myLocation, 16, { duration: 500 });
      }

      // Sync placemarks for users
      onlineUsers.forEach((u: any) => {
          if (!yMap.current) return;
          
          if (!placemarksRef.current.has(u.unit_id)) {
              // Create new placemark
              const isMe = u.unit_id === myUnitId;
              const placemark = new (window as any).ymaps.Placemark([u.lat, u.lng], {
                  hintContent: u.unit_id
              }, {
                  preset: isMe ? 'islands#redCircleDotIcon' : 'islands#blueCircleDotIcon',
                  iconColor: isMe ? '#ff0000' : '#00ff94'
              });
              yMap.current.geoObjects.add(placemark);
              placemarksRef.current.set(u.unit_id, placemark);
          } else {
              // Update position
              const pm = placemarksRef.current.get(u.unit_id);
              pm.geometry.setCoordinates([u.lat, u.lng]);
          }
      });

      // Remove stale placemarks
      const activeIds = new Set(onlineUsers.map((u:any) => u.unit_id));
      placemarksRef.current.forEach((pm, id) => {
          if (!activeIds.has(id)) {
              yMap.current.geoObjects.remove(pm);
              placemarksRef.current.delete(id);
          }
      });
    });
  }, [myLocation, onlineUsers, myUnitId]);

  return (
    <div 
      onClick={onExpand}
      className="fixed bottom-6 left-4 md:bottom-10 md:left-10 w-28 h-28 md:w-48 md:h-48 rounded-full border-2 md:border-4 border-ghost-primary/30 bg-black overflow-hidden z-50 shadow-[0_0_20px_rgba(0,255,148,0.2)] cursor-pointer hover:border-ghost-primary transition-all group"
    >
      <div ref={mapRef} className="w-full h-full opacity-60 grayscale scale-150" />
      
      {/* HUD Radar Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 border border-ghost-primary/20 rounded-full" />
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-ghost-primary/20" />
        <div className="absolute left-1/2 top-0 w-[1px] h-full bg-ghost-primary/20" />
        
        {/* Scanning Sweep */}
        <div className="absolute inset-0 bg-gradient-to-tr from-ghost-primary/30 to-transparent origin-center animate-spin duration-[4000ms]" style={{ clipPath: 'polygon(50% 50%, 100% 0, 100% 100%)' }} />
      </div>
      
      <div className="absolute bottom-2 w-full text-center text-[8px] md:text-[10px] font-black text-ghost-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
        SCAN
      </div>
    </div>
  );
};
