
import React from 'react';

export type DetectionType = 'OBJECT' | 'HAZARD' | 'PERSON' | 'TEXT' | 'NEUTRAL' | 'THREAT' | 'FRIENDLY' | 'HARDWARE_NODE';
export type AIEngine = 'GEMINI_LIVE' | 'LOCAL_VISION';
export type VisionMode = 'NORMAL' | 'NIGHT' | 'THERMAL' | 'HACKER';
export type ConnectionStatus = 'UNSECURED' | 'BREACHING' | 'SECURED' | 'MAPPED' | 'ENCRYPTED';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  text: string;
  timestamp: number;
}

export interface Memory {
  id: string;
  content: string;
  type: 'PERSON' | 'LOCATION' | 'FACT';
  timestamp: number;
  tags: string[];
}

export interface SwarmAgent {
  id: string;
  isRemoteUser: boolean; 
  unitId: string;
  // Polar coordinates for orbiting behavior
  azimuth: number; // Angle around user (0-360)
  elevation: number; // Height angle
  distance: number; // Virtual distance from user center
  
  // Screen space projection (calculated)
  x: number; 
  y: number; 
  
  status: 'IDLE' | 'LOCKED' | 'SCANNING';
  battery: number;
  lastSync: number;
  
  // Real Feed Data
  lastFrameBase64?: string | null;
  feedOffset: { x: number, y: number, scale: number, skew: number };
}

export interface GhostMarker {
  id: string;
  unitId: string;
  x: number;
  y: number;
  label: string;
  description?: string;
  color: string;
  attachedToObjectId?: string | null;
}

export interface SurveillanceNode {
  id: string;
  ip: string;
  port: number;
  type: 'CAMERA' | 'SERVER' | 'IOT' | 'UNKNOWN';
  label: string;
  status: 'ONLINE' | 'OFFLINE' | 'LOCKED' | 'OPEN';
  streamUrl?: string;
  signalStrength: number;
  isSecured: boolean;
  protocol?: 'RTSP' | 'HTTP' | 'ONVIF' | 'MJPEG';
}

export interface VisualOverrides {
  isolatedObjectId: string | null;
  targetZoom: number;
  isBackgroundRemoved: boolean;
  activeFilters: string[];
}

export interface TrackedObject {
  id: string; 
  class: string;
  score: number;
  
  // Raw Target Coordinates (Updated at 10Hz)
  x: number; 
  y: number;
  w: number;
  h: number;

  // Smoothed Display Coordinates (Updated at 60Hz via Lerp)
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  
  // Velocity for prediction (Kalman-lite)
  vx: number;
  vy: number;
  
  lastUpdate: number;
  framesMissing: number; 
  
  label: string; 
  color: string;
  description?: string; 
  isAiAttached: boolean;
  
  focusProgress: number; 
  isAnalyzed: boolean;
  isAnalysisPending?: boolean; // New flag for pre-emptive loading
  lastAnalysisTime?: number;
  
  // Visuals
  distanceFactor: number; // 0 (far) to 1 (close)
  depthMeters: number; // Estimated meters
  segmentPoints: {x: number, y: number, active: boolean, vX: number, vY: number}[]; // Dynamic segmentation
  
  source?: 'LOCAL' | 'NETWORK';
  detectedBy?: string; 
  subObjects?: string[];
}

export interface Detection {
  id: string; 
  class: string;
  score: number;
  timestamp: number;
  type: DetectionType;
  distance: number; 
  source: 'LOCAL' | 'NETWORK' | 'HARDWARE_SCAN';
  unitId?: string;
  unitColor?: string;
  normalizedBbox?: [number, number, number, number];
  focusProgress: number; 
  isDeepScanning: boolean;
  detailedDescription?: string;
  identifiedName?: string;
  action?: string;
  isRealHardware?: boolean;
  signalStrength?: number; 
  protocol?: 'WIFI' | 'BLUETOOTH' | 'NFC' | 'USB' | 'WPS';
  macAddress?: string;
  connectionStatus?: ConnectionStatus;
  deviceInfo?: any;
  opacity?: number;
  isGhost?: boolean;
  spatialInfo?: string;
}

export enum SystemStatus {
  BOOTING = 'BOOTING',
  CAMERA_INIT = 'CAMERA_INIT',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR',
  STANDBY = 'STANDBY'
}

export type GhostConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'ERROR' | 'AWAITING_API_KEY';
export type VisionWorkerStatus = 'INITIALIZING' | 'LOADING_MODEL' | 'ACTIVE' | 'ERROR';

export interface GhostContextType {
  isConnected: boolean;
  ghostConnectionStatus: GhostConnectionStatus;
  ghostError: string | null;
  isSpeaking: boolean;
  connect: () => void;
  activeEngine: AIEngine;
  liveUserTranscript: string;
  liveAiTranscript: string;
  chatLog: ChatMessage[];
  userVolume: number;
  audioFrequencies: Uint8Array; 
  getAnalyserData?: (target: 'in' | 'out') => Uint8Array | null; 
  updateSceneContext: (base64Image: string) => void;
  showApiKeySelectionPrompt: boolean;
  handleOpenApiKeySelection: () => Promise<void>;
  myUnitId: string;
  askGhost: (prompt: string) => void;
  analyzeTarget: (target: TrackedObject) => Promise<string>; 
}

export interface TacticalContextType {
  detections: Detection[]; 
  trackedObjectsRef: React.MutableRefObject<Map<string, TrackedObject>>;
  swarmAgentsRef: React.MutableRefObject<SwarmAgent[]>;
  ghostMarkers: GhostMarker[];
  visualOverrides: VisualOverrides;
  addGhostMarker: (marker: GhostMarker) => void;
  removeGhostMarker: (id: string) => void;
  setVisualOverride: (overrides: Partial<VisualOverrides>) => void;
  resetVisuals: () => void;
  isHackerVision: boolean;
  setHackerVision: (active: boolean) => void;
  myUnitId: string;
  visionWorkerStatus: VisionWorkerStatus;
  assignTaskToObject: (objectId: string, task: string) => void;
  startHardwareScan: () => Promise<void>;
  isScanningHardware: boolean;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  onlineUsers: any[];
  messages: any[];
  sendMessage: (to: string, text: string) => void;
  requestSwap: (to: string) => void;
  activeSwap: any;
  myLocation: [number, number];
  situationalLog: string;
  setSituationalLog: (log: string) => void;
  markAsHazard: (objectId: string) => void;
  addToMemory: (objectId: string) => void;
  inspectObject: (objectId: string) => void;
  setExplorationMode: (enabled: boolean) => void;
  isExplorationMode: boolean;
  attachAiLabel: (targetClass: string, label: string, color: string) => void;
  toggleSwarm: () => void;
  isSwarmActive: boolean;
  setAnalyzeTarget: (fn: (target: any) => Promise<string>) => void;
  
  triangulateMarker: () => void;
}

export interface HardwareContextType {
  status: SystemStatus;
  videoRef: React.RefObject<HTMLVideoElement>;
  initializeSystem: () => Promise<void>;
  visionMode: VisionMode;
  setVisionMode: (mode: VisionMode) => void;
  isStereoMode: boolean;
  toggleStereoMode: () => void;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  isAutoFocusEnabled: boolean;
  toggleAutoFocus: () => void;
  error: string | null;
  sensors: any;
}
