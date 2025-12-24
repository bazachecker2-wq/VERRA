
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { SystemStatus, HardwareContextType, VisionMode } from '../types';

interface SensorData {
  alpha: number; 
  beta: number;  
  gamma: number; 
  coords?: GeolocationCoordinates;
  heading?: number;
}

// Extend context to include refs for direct access
interface HardwareContextExtended extends HardwareContextType {
  sensors: SensorData;
  sensorRef: React.MutableRefObject<SensorData>;
}

const HardwareContext = createContext<HardwareContextExtended | undefined>(undefined);

export const HardwareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SystemStatus>(SystemStatus.BOOTING);
  const [error, setError] = useState<string | null>(null);
  const [visionMode, setVisionMode] = useState<VisionMode>('NORMAL');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isStereoMode, setIsStereoMode] = useState(false);
  const [isAutoFocusEnabled, setIsAutoFocusEnabled] = useState(true);
  const [sensors, setSensors] = useState<SensorData>({ alpha: 0, beta: 0, gamma: 0 });
  
  // Ref for high-frequency polling (60fps loop access)
  const sensorRef = useRef<SensorData>({ alpha: 0, beta: 0, gamma: 0 });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const initSensors = useCallback(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const newData = {
        alpha: e.alpha || 0,
        beta: e.beta || 0,
        gamma: e.gamma || 0,
        heading: (e as any).webkitCompassHeading || 0
      };
      // Update Ref immediately
      sensorRef.current = newData;
      
      // Update State less frequently to save renders (throttle if needed, but keeping sync for now)
      setSensors(prev => ({ ...prev, ...newData }));
    };

    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => {
             const coords = pos.coords;
             setSensors(prev => ({ ...prev, coords }));
             sensorRef.current.coords = coords;
        },
        () => console.warn("GPS: СИГНАЛ ПОТЕРЯН"),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission().catch(() => {});
    }
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  const startCamera = useCallback(async (): Promise<void> => {
    setStatus(SystemStatus.CAMERA_INIT);
    
    const profiles = [
      { width: { ideal: 1920 }, height: { ideal: 1080 } },
      { width: { ideal: 1280 }, height: { ideal: 720 } },
      { width: { ideal: 640 }, height: { ideal: 480 } }
    ];

    let lastErr = "";

    for (const profile of profiles) {
      try {
        const constraints = { 
          video: { 
            facingMode: 'environment', 
            ...profile,
            frameRate: { ideal: 60 } // Try higher framerate for smoother tracking
          },
          audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        
        initSensors();
        setStatus(SystemStatus.ACTIVE);
        return; 
      } catch (err: any) {
        lastErr = err.message;
        console.warn(`Камера: Профиль ${profile.width.ideal} не поддерживается, пробую следующий...`);
      }
    }

    setError(`ОШИБКА ВИЗУАЛИЗАЦИИ: ${lastErr}. Проверьте разрешения в настройках шлема/браузера.`);
    setStatus(SystemStatus.ERROR);
  }, [initSensors]);

  return (
    <HardwareContext.Provider value={{ 
      status, videoRef, error, sensors, sensorRef,
      initializeSystem: startCamera,
      isStereoMode, toggleStereoMode: () => setIsStereoMode(p => !p),
      visionMode, setVisionMode, zoomLevel, setZoomLevel,
      isAutoFocusEnabled, toggleAutoFocus: () => setIsAutoFocusEnabled(p => !p)
    }}>
      {children}
    </HardwareContext.Provider>
  );
};

export const useHardware = () => useContext(HardwareContext)!;
