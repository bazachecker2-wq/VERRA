
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { TacticalContextType, Detection, SystemStatus, GhostMarker, VisualOverrides, VisionWorkerStatus, TrackedObject, SwarmAgent } from '../types';
import { useHardware } from './HardwareContext';
import { initDB, syncGameState, addTacticalMarker, requestVisorSwap, sendNodeMessage, getMessages, updateSwarmState, checkPendingTasks } from '../services/neonService';
import { loadModel, detectObjects } from '../services/visionService';
import { CLASS_TRANSLATIONS, CONFIDENCE_THRESHOLD, FOCUS_ACQUISITION_MS } from '../constants';
import { captureFrameBase64 } from '../services/audioUtils';

const TacticalContext = createContext<TacticalContextType | any>(undefined);

// Advanced Interpolation
const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

// IOU Calculation for Fusion
function getIoU(box1: number[], box2: number[]) {
    const x1 = Math.max(box1[0], box2[0]);
    const y1 = Math.max(box1[1], box2[1]);
    const x2 = Math.min(box1[0] + box1[2], box2[0] + box2[2]);
    const y2 = Math.min(box1[1] + box1[3], box2[1] + box2[3]);
    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const area1 = box1[2] * box1[3];
    const area2 = box2[2] * box2[3];
    if (area1 + area2 - intersection === 0) return 0;
    return intersection / (area1 + area2 - intersection);
}

export const TacticalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { videoRef, status } = useHardware(); 
  
  const [ghostMarkers, setGhostMarkers] = useState<GhostMarker[]>([]);
  const [visionWorkerStatus, setVisionWorkerStatus] = useState<VisionWorkerStatus>('INITIALIZING');
  
  const [visualOverrides, setVisualOverrides] = useState<VisualOverrides>({
    isolatedObjectId: null, 
    targetZoom: 1.0, 
    isBackgroundRemoved: false, 
    activeFilters: []
  });
  
  const [detections, setDetections] = useState<Detection[]>([]);
  const [myLocation, setMyLocation] = useState<[number, number]>([55.751244, 37.618423]); 
  
  const [isSwarmActive, setIsSwarmActive] = useState(false);
  const swarmAgentsRef = useRef<SwarmAgent[]>([]);
  
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeSwap, setActiveSwap] = useState<{ unit_id: string, visor_target: string, visor_expires: number } | null>(null);

  const trackedObjectsRef = useRef<Map<string, TrackedObject>>(new Map());
  const myUnitId = useRef(`UNIT-${Math.floor(Math.random() * 9000) + 1000}`).current;

  // Analysis State
  const analyzeTargetRef = useRef<((target: any) => Promise<string>) | null>(null);

  const setAnalyzeTarget = useCallback((fn: (target: any) => Promise<string>) => {
      analyzeTargetRef.current = fn;
  }, []);

  const addGhostMarker = useCallback((marker: GhostMarker) => {
    setGhostMarkers(prev => [...prev, marker]);
    addTacticalMarker(marker);
  }, []);

  // --- DB SYNC LOOP (1Hz) + Swarm Video Downlink ---
  useEffect(() => {
    initDB().then(ok => console.log(ok ? "DB: АКТИВНА" : "DB: АВТОНОМНЫЙ РЕЖИМ"));

    const interval = setInterval(async () => {
        const state = await syncGameState(myUnitId, myLocation[0], myLocation[1]);
        
        setOnlineUsers(state.users);
        setGhostMarkers(state.markers);

        if (state.swap) {
            setActiveSwap({
                unit_id: myUnitId,
                visor_target: state.swap.target,
                visor_expires: state.swap.expires
            });
        } else {
            setActiveSwap(null);
        }

        const msgs = await getMessages(myUnitId);
        setMessages(msgs);

        // Check Pending Tasks (Async Execution)
        const pending = await checkPendingTasks(myUnitId);
        if (pending.length > 0) {
            pending.forEach(task => {
                if (task.task_type === 'REMINDER') {
                    // Create visual alert marker
                    const markerId = `TASK-${Date.now()}`;
                    addGhostMarker({
                        id: markerId, unitId: 'AI_SYSTEM', x: 0.5, y: 0.5, 
                        label: 'НАПОМИНАНИЕ', description: task.payload, color: '#FFD700'
                    });
                    // Also sending as message
                    sendNodeMessage('AI', myUnitId, `НАПОМИНАНИЕ: ${task.payload}`);
                }
            });
        }

        // Update Swarm Agents with Real Remote Frames
        if (state.users.length > 0 && isSwarmActive) {
            const peers = state.users.filter((u: any) => u.unit_id !== myUnitId).slice(0, 3);
            
            // Map peers to existing swarm slots or create new ones
            const newAgents: SwarmAgent[] = swarmAgentsRef.current.map(agent => ({...agent}));
            
            peers.forEach((peer: any, idx: number) => {
                if (idx < newAgents.length) {
                    newAgents[idx].unitId = peer.unit_id;
                    newAgents[idx].lastFrameBase64 = peer.remote_frame; // THE VIDEO FEED
                    newAgents[idx].status = peer.remote_frame ? 'SCANNING' : 'IDLE';
                }
            });
            swarmAgentsRef.current = newAgents;
        }

    }, 1000);

    return () => clearInterval(interval);
  }, [myUnitId, myLocation, isSwarmActive, addGhostMarker]);

  // --- SWARM VIDEO UPLINK (Broadcast my view) ---
  useEffect(() => {
    if (!isSwarmActive || status !== SystemStatus.ACTIVE || !videoRef.current) return;
    
    // Broadcast low-res frame every 200ms (5 FPS) to save DB load
    const uplinkInterval = setInterval(async () => {
        if (!videoRef.current) return;
        try {
            const frame = await captureFrameBase64(videoRef.current, 240, 180); // Low res for swarm
            updateSwarmState(myUnitId, myLocation[0], myLocation[1], frame);
        } catch(e) { console.warn("Uplink fail", e); }
    }, 200);

    return () => clearInterval(uplinkInterval);
  }, [isSwarmActive, status, myUnitId, myLocation]);

  const removeGhostMarker = useCallback((id: string) => {
    setGhostMarkers(prev => prev.filter(m => m.id !== id));
  }, []);

  const sendMessage = useCallback((from: string, to: string, text: string) => {
      sendNodeMessage(from, to, text);
      setMessages(prev => [{ sender_id: from, receiver_id: to, content: text, timestamp: Date.now() }, ...prev]);
  }, []);

  const requestSwap = useCallback((targetId: string) => {
      requestVisorSwap(myUnitId, targetId);
      setActiveSwap({ unit_id: myUnitId, visor_target: targetId, visor_expires: Date.now() + 60000 });
  }, [myUnitId]);

  const toggleSwarm = useCallback(() => {
    setIsSwarmActive(prev => !prev);
    // Init placeholders if empty
    if (swarmAgentsRef.current.length === 0) {
        swarmAgentsRef.current = [
            { 
                id: 'ДРОН-АЛЬФА', unitId: 'ПОИСК...', isRemoteUser: true, 
                azimuth: 45, elevation: 20, distance: 1.0, x: 0.8, y: 0.2, 
                status: 'IDLE', battery: 89, lastSync: Date.now(),
                feedOffset: { x: 10, y: 5, scale: 1.2, skew: 15 } 
            },
            { 
                id: 'ДРОН-БЕТА', unitId: 'ПОИСК...', isRemoteUser: true, 
                azimuth: 315, elevation: 10, distance: 1.0, x: 0.2, y: 0.2, 
                status: 'IDLE', battery: 94, lastSync: Date.now(),
                feedOffset: { x: -10, y: 5, scale: 1.2, skew: -15 }
            },
             { 
                id: 'ДРОН-ГАММА', unitId: 'ПОИСК...', isRemoteUser: true, 
                azimuth: 180, elevation: 0, distance: 1.0, x: 0.5, y: 0.8, 
                status: 'IDLE', battery: 72, lastSync: Date.now(),
                feedOffset: { x: 0, y: 15, scale: 1.1, skew: 0 }
            }
        ];
    }
  }, []);
  
  useEffect(() => {
      if (!isSwarmActive) return;
      let rafId: number;
      const loop = () => {
          const t = Date.now() / 2000;
          swarmAgentsRef.current.forEach((agent, i) => {
              // Orbit logic
              if (agent.status === 'IDLE' || agent.status === 'SCANNING') {
                  agent.azimuth += 0.2; 
              }
              const rad = (agent.azimuth * Math.PI) / 180;
              agent.x = 0.5 + Math.cos(rad) * 0.4;
              agent.y = 0.5 + Math.sin(rad) * (0.2 + Math.sin(t * 0.5) * 0.1);
          });
          rafId = requestAnimationFrame(loop);
      };
      loop();
      return () => cancelAnimationFrame(rafId);
  }, [isSwarmActive]);

  const triangulateMarker = useCallback(() => {
     if (!isSwarmActive) return;
     swarmAgentsRef.current.forEach(a => a.status = 'LOCKED');
     setTimeout(() => {
         const markerId = `TRI-${Date.now()}`;
         addGhostMarker({
             id: markerId, unitId: myUnitId, x: 0.5, y: 0.5, label: 'ЦЕЛЬ_ТРИАНГУЛЯЦИИ', color: '#00E5FF', description: 'ПОДТВЕРЖДЕНО СЕТЬЮ РОЯ'
         });
         setTimeout(() => { swarmAgentsRef.current.forEach(a => a.status = 'SCANNING'); }, 1000);
     }, 800);
  }, [isSwarmActive, addGhostMarker, myUnitId]);

  // --- 60Hz SMOOTHING & DEPTH CALC ---
  useEffect(() => {
      if (status !== SystemStatus.ACTIVE) return;
      let rafId: number;
      let lastTime = performance.now();
      
      const logicLoop = () => {
          const now = performance.now();
          const dt = (now - lastTime) / 1000; // Seconds
          lastTime = now;

          const trackedMap = trackedObjectsRef.current;
          
          trackedMap.forEach(obj => {
              // Kalman-lite prediction: Add velocity to smooth position
              const predX = obj.sx + obj.vx * dt;
              const predY = obj.sy + obj.vy * dt;

              // Lerp towards Raw Target (Correction)
              const smoothness = 0.15; 
              obj.sx = lerp(predX, obj.x, smoothness);
              obj.sy = lerp(predY, obj.y, smoothness);
              obj.sw = lerp(obj.sw, obj.w, smoothness);
              obj.sh = lerp(obj.sh, obj.h, smoothness);

              // Depth Estimation
              const area = obj.sw * obj.sh;
              const yFactor = obj.sy + obj.sh; 
              obj.distanceFactor = Math.min(1.0, Math.max(0.1, (Math.sqrt(area) * 0.7) + (yFactor * 0.3)));
              obj.depthMeters = Math.max(0.5, parseFloat(((1 / obj.distanceFactor) * 2).toFixed(1)));

              // Animate Segmentation Points
              if (obj.isAnalyzed && obj.segmentPoints) {
                  obj.segmentPoints.forEach(p => {
                      p.x += p.vX * 0.01;
                      p.y += p.vY * 0.01;
                      if(p.x < 0 || p.x > 1) p.vX *= -1;
                      if(p.y < 0 || p.y > 1) p.vY *= -1;
                  });
              }

              // Focus Logic with Pre-emptive Analysis
              const cx = obj.sx + obj.sw/2;
              const cy = obj.sy + obj.sh/2;
              const distFromCenter = Math.sqrt(Math.pow(cx - 0.5, 2) + Math.pow(cy - 0.5, 2));
              
              if (distFromCenter < 0.12) {
                  obj.focusProgress = Math.min(FOCUS_ACQUISITION_MS, obj.focusProgress + (dt * 1000));
                  
                  // PRE-EMPTIVE ANALYSIS TRIGGER (At 60% of focus time)
                  // This masks latency by starting the request before the user visually "locks" the target
                  if (obj.focusProgress > (FOCUS_ACQUISITION_MS * 0.6) && !obj.isAnalyzed && !obj.isAnalysisPending) {
                      triggerDeepAnalysis(obj);
                  }

                  // VISUAL LOCK (At 100%)
                  if (obj.focusProgress >= FOCUS_ACQUISITION_MS && !obj.isAnalyzed) {
                      // Mark as visually analyzed. If data isn't ready, it will show "DECRYPTING" based on description state.
                      obj.isAnalyzed = true;
                      if (!obj.description) {
                          obj.description = "ДЕШИФРОВКА...";
                          obj.color = '#FFD700'; 
                      }
                  }

              } else {
                  obj.focusProgress = Math.max(0, obj.focusProgress - (dt * 2000)); 
                  // Reset analysis if focus breaks significantly before completion? 
                  // For now, let's keep cached results but allow re-trigger if focus drops to 0.
                  if (obj.focusProgress === 0) {
                      // Optional: Reset pending status if needed, but risky if network returns late.
                      // Leaving it allows caching.
                  }
              }
          });
          
          rafId = requestAnimationFrame(logicLoop);
      };
      
      logicLoop();
      return () => cancelAnimationFrame(rafId);
  }, [status]);

  const triggerDeepAnalysis = (obj: TrackedObject) => {
      // Mark as pending to prevent double-firing
      obj.isAnalysisPending = true;
      
      // Initialize dynamic visual points early
      obj.segmentPoints = [
          { x: 0.5, y: 0.5, active: true, vX: Math.random()-0.5, vY: Math.random()-0.5 },
          { x: 0.3, y: 0.4, active: true, vX: Math.random()-0.5, vY: Math.random()-0.5 },
          { x: 0.7, y: 0.6, active: true, vX: Math.random()-0.5, vY: Math.random()-0.5 },
          { x: 0.5, y: 0.8, active: true, vX: Math.random()-0.5, vY: Math.random()-0.5 }
      ];

      if (!analyzeTargetRef.current) {
          obj.isAnalysisPending = false;
          return;
      }

      // Fire and forget (the promise callback updates the object ref directly)
      analyzeTargetRef.current(obj).then((rawText) => {
           obj.lastAnalysisTime = Date.now();
           
           if (rawText.includes('|')) {
               const [newLabel, newDesc] = rawText.split('|');
               obj.label = newLabel.trim().toUpperCase();
               obj.description = newDesc.trim();
           } else {
               obj.description = rawText.substring(0, 40);
           }
           obj.color = '#FFFFFF'; 
           obj.isAnalysisPending = false;
      }).catch(() => {
          obj.description = "СБОЙ ДАННЫХ";
          obj.isAnalysisPending = false;
      });
  };

  // --- 10Hz VISION LOOP ---
  useEffect(() => {
      let isRunning = true;
      let lastDetectTime = 0;
      const DETECT_INTERVAL = 100; 

      const visionLoop = async () => {
          if (!isRunning) return;

          if (visionWorkerStatus === 'INITIALIZING') {
              setVisionWorkerStatus('LOADING_MODEL');
              const loaded = await loadModel();
              setVisionWorkerStatus(loaded ? 'ACTIVE' : 'ERROR');
          }

          if (visionWorkerStatus === 'ACTIVE' && status === SystemStatus.ACTIVE && videoRef.current && !videoRef.current.paused) {
              const now = Date.now();
              if (now - lastDetectTime > DETECT_INTERVAL) {
                  const results = await detectObjects(videoRef.current, CONFIDENCE_THRESHOLD);
                  handleDetectionResults(results);
                  lastDetectTime = now;
              }
          }
          requestAnimationFrame(visionLoop);
      };
      visionLoop();
      return () => { isRunning = false; };
  }, [visionWorkerStatus, status, videoRef]);

  // --- FUSION ALGORITHM (Fastest Update Wins + Inertia) ---
  const handleDetectionResults = useCallback((results: any[]) => {
      const now = Date.now();
      const trackedMap = trackedObjectsRef.current;
      const dt = 0.1; // 100ms approx
      
      trackedMap.forEach(obj => { if (obj.source !== 'NETWORK') obj.framesMissing++; });
      const usedTrackIds = new Set<string>();

      results.forEach((res) => {
          let bestIoU = 0; 
          let bestTrackId: string | null = null;
          
          // Match existing objects
          trackedMap.forEach((obj, key) => {
              if (usedTrackIds.has(key) || obj.source === 'NETWORK') return;
              // Relax class check if AI attached (model might flicker between 'person' and 'man')
              if (res.class !== obj.class && !obj.isAiAttached) return;
              
              const iou = getIoU([obj.x, obj.y, obj.w, obj.h], res.normalizedBbox);
              if (iou > 0.3 && iou > bestIoU) { bestIoU = iou; bestTrackId = key; }
          });

          if (bestTrackId) {
              // UPDATE EXISTING (Sensor Fusion)
              const obj = trackedMap.get(bestTrackId)!;
              
              // Calculate velocity based on change
              const newVx = (res.normalizedBbox[0] - obj.x) / dt;
              const newVy = (res.normalizedBbox[1] - obj.y) / dt;
              
              // Blend velocity (Smooth movement)
              obj.vx = obj.vx * 0.5 + newVx * 0.5;
              obj.vy = obj.vy * 0.5 + newVy * 0.5;

              // Update Target (Alpha blending for stability)
              const confidence = res.score; // Trust higher score more
              const alpha = 0.6 + (confidence * 0.4); 

              obj.x = lerp(obj.x, res.normalizedBbox[0], alpha);
              obj.y = lerp(obj.y, res.normalizedBbox[1], alpha);
              obj.w = lerp(obj.w, res.normalizedBbox[2], alpha);
              obj.h = lerp(obj.h, res.normalizedBbox[3], alpha);
              
              obj.framesMissing = 0; 
              obj.lastUpdate = now; 
              obj.score = res.score; 
              usedTrackIds.add(bestTrackId);
          } else {
              // NEW TRACK
              const id = `OBJ-${Date.now().toString().slice(-4)}-${Math.floor(Math.random()*1000)}`;
              let niceLabel = CLASS_TRANSLATIONS[res.class] || res.class;
              niceLabel = niceLabel.toUpperCase();
              
              trackedMap.set(id, {
                  id, class: res.class, score: res.score,
                  x: res.normalizedBbox[0], y: res.normalizedBbox[1], w: res.normalizedBbox[2], h: res.normalizedBbox[3],
                  sx: res.normalizedBbox[0], sy: res.normalizedBbox[1], sw: res.normalizedBbox[2], sh: res.normalizedBbox[3],
                  vx: 0, vy: 0,
                  lastUpdate: now, framesMissing: 0,
                  label: niceLabel, 
                  color: '#00FF94',
                  isAiAttached: false, focusProgress: 0, isAnalyzed: false, isAnalysisPending: false, source: 'LOCAL', 
                  distanceFactor: 0.5, depthMeters: 5.0, segmentPoints: []
              } as TrackedObject);
          }
      });
      
      // Cleanup
      trackedMap.forEach((obj, key) => {
          if (obj.framesMissing > 10 && !obj.isAiAttached) trackedMap.delete(key);
      });

      setDetections(results);
  }, []);

  const attachAiLabel = useCallback((targetClass: string, label: string, color: string, description?: string) => {
      const trackedMap = trackedObjectsRef.current;
      let bestDist = 1.0; let bestId = null;
      trackedMap.forEach((obj, key) => {
          if (targetClass !== 'any' && !obj.class.includes(targetClass)) return;
          const cx = obj.sx + obj.sw / 2; const cy = obj.sy + obj.sh / 2;
          const dist = Math.sqrt(Math.pow(cx - 0.5, 2) + Math.pow(cy - 0.5, 2));
          if (dist < bestDist) { bestDist = dist; bestId = key; }
      });
      if (bestId) {
          const obj = trackedMap.get(bestId);
          if (obj) {
              obj.label = label; obj.color = color;
              if (description) obj.description = description;
              obj.isAiAttached = true; obj.lastUpdate = Date.now() + 30000; 
              obj.focusProgress = 100; obj.isAnalyzed = true;
          }
      }
  }, []);

  const performDiagnostics = useCallback(async (): Promise<boolean> => { return visionWorkerStatus === 'ACTIVE'; }, [visionWorkerStatus]);

  return (
    <TacticalContext.Provider value={{ 
      detections, trackedObjectsRef, swarmAgentsRef, ghostMarkers, visualOverrides, visionWorkerStatus,
      addGhostMarker, removeGhostMarker,
      setVisualOverride: (ov: any) => setVisualOverrides(v => ({...v, ...ov})), 
      myUnitId, onlineUsers, messages, sendMessage, requestSwap, activeSwap, myLocation, situationalLog: '', setSituationalLog: () => {},
      setExplorationMode: () => {}, isExplorationMode: false, markAsHazard: () => {}, addToMemory: () => {}, inspectObject: () => {},
      performDiagnostics, attachAiLabel, toggleSwarm, isSwarmActive, setAnalyzeTarget, triangulateMarker
    }}>
      {children}
    </TacticalContext.Provider>
  );
};
export const useTactical = () => useContext(TacticalContext)!;
