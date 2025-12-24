
import React, { useState, useEffect, useRef } from 'react';
import { SurveillanceNode } from '../../types';

export const SurveillanceSystem: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('rtsp://admin:12345@192.168.1.10:554/h264');
  const [isScanning, setIsScanning] = useState(false);
  const [autoConnect, setAutoConnect] = useState(true);
  const [scanProgress, setScanProgress] = useState(0);
  const [foundNodes, setFoundNodes] = useState<SurveillanceNode[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentScanIP, setCurrentScanIP] = useState('192.168.1.1');

  const videoRef = useRef<HTMLVideoElement>(null);

  // Intelligent Search Simulation
  const startIntelligentScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    setFoundNodes([]);
    setLogs([
        'INIT_RTSP_DISCOVERY...',
        'LOADING SUBNET MASKS...',
        'STARTING PORT SWEEP (554, 80, 8080)...'
    ]);

    let ipCounter = 1;
    
    const interval = setInterval(() => {
      // Advance IP simulation
      ipCounter += Math.floor(Math.random() * 5) + 1;
      if (ipCounter > 254) ipCounter = 254;
      setCurrentScanIP(`192.168.1.${ipCounter}`);

      setScanProgress(prev => {
        const next = prev + 1.5; // Slower, more realistic scan speed
        
        if (next >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          setLogs(l => [...l, 'SCAN COMPLETE. INDEXING TARGETS...']);
          
          // Auto-connect logic
          if (autoConnect) {
              const bestTarget = foundNodes.find(n => n.status === 'OPEN' && n.signalStrength > 60) || foundNodes[0];
              if (bestTarget && bestTarget.status === 'OPEN') {
                  setLogs(l => [...l, `AUTO-CONNECTING TO: ${bestTarget.label}`]);
                  handleConnect(bestTarget.streamUrl || `http://${bestTarget.ip}/video`, bestTarget.protocol);
              }
          }
          return 100;
        }
        
        // Simulate finding devices
        if (Math.random() > 0.95) {
            const id = Math.floor(Math.random() * 9999);
            const isRTSP = Math.random() > 0.4;
            const protocol = isRTSP ? 'RTSP' : 'MJPEG';
            const port = isRTSP ? 554 : 80;
            const ip = `192.168.1.${ipCounter}`;
            
            const newNode: SurveillanceNode = {
                id: `CAM-${id}`,
                ip: ip,
                port: port,
                type: 'CAMERA',
                label: `CAM_${protocol}_${id.toString().slice(-3)}`,
                status: Math.random() > 0.3 ? 'OPEN' : 'LOCKED',
                signalStrength: Math.floor(Math.random() * 40 + 60),
                isSecured: Math.random() > 0.5,
                protocol: protocol as any,
                streamUrl: isRTSP ? `rtsp://${ip}:${port}/stream` : `http://${ip}/mjpeg`
            };

            setFoundNodes(prevN => [...prevN, newNode]);
            setLogs(l => [...l, `[+] DEVICE FOUND: ${newNode.ip} (${newNode.protocol})`]);
        }
        return next;
      });
    }, 50);
  };

  const handleConnect = (url: string, protocol?: string) => {
    // Check for RTSP protocol
    const isRTSP = url.startsWith('rtsp://') || protocol === 'RTSP';
    
    setLogs(l => [...l, `INIT_HANDSHAKE: ${url}...`]);
    
    if (isRTSP) {
        setLogs(l => [...l, `WARN: RTSP PROTOCOL REQUIRES TRANSCODING`, `ATTEMPTING WEBRTC BRIDGE...`]);
        setActiveStream(url);
    } else {
        setLogs(l => [...l, `PROTOCOL: HTTP/MJPEG ACCEPTED`]);
        setActiveStream(url);
    }
  };

  const loadDemoStream = () => {
      setManualInput('http://209.123.167.228/mjpg/video.mjpg'); // Public demo cam
      handleConnect('http://209.123.167.228/mjpg/video.mjpg', 'MJPEG');
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 text-ghost-primary font-mono flex flex-col md:flex-row animate-in zoom-in-95 duration-300 h-[100dvh]">
      
      {/* LEFT PANEL: CONTROLS & LIST (Bottom on Mobile) */}
      <div className="w-full h-[50%] md:w-1/3 md:h-full border-t md:border-t-0 md:border-r border-ghost-primary/30 p-4 md:p-6 flex flex-col gap-3 md:gap-6 bg-black/50 backdrop-blur-md relative order-2 md:order-1 overflow-hidden">
        {/* Decorative Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(0,255,148,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,148,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />
        
        {/* Header */}
        <div className="z-10 flex justify-between items-center md:block pt-1 md:pt-0">
           <h2 className="text-base md:text-2xl font-black italic tracking-tighter text-white uppercase flex items-center gap-2">
             <span className="w-3 h-3 md:w-4 md:h-4 bg-ghost-primary rounded-sm animate-pulse" />
             RTSP_SCANNER
           </h2>
           <div className="text-[10px] text-white/40 font-mono">PORT 554/80</div>
        </div>

        {/* Manual Input Area */}
        <div className="bg-ghost-primary/5 p-2 md:p-4 border border-ghost-primary/20 rounded-lg z-10 relative group">
           <div className="flex justify-between items-center mb-1 md:mb-2">
                <label className="text-[10px] font-bold uppercase opacity-70">Stream Injection</label>
                <button onClick={loadDemoStream} className="text-[10px] text-ghost-accent hover:underline px-2 py-1">[ DEMO ]</button>
           </div>
           
           <div className="flex gap-2">
              <input 
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                className="w-full bg-black border border-ghost-primary/30 text-[10px] md:text-xs p-2 text-white focus:border-ghost-primary outline-none font-mono tracking-tighter rounded"
                placeholder="rtsp://..."
              />
              <button 
                onClick={() => handleConnect(manualInput)}
                className="bg-ghost-primary text-black font-bold px-3 py-1 text-[10px] md:text-xs hover:bg-white transition-colors rounded"
              >
                GO
              </button>
           </div>
        </div>

        {/* Scanner Controls */}
        <div className="flex-1 flex flex-col gap-2 z-10 min-h-0">
            <div className="flex justify-between items-center mb-1 bg-white/5 p-2 rounded">
                <div className="flex items-center gap-2">
                    <span className="text-xs md:text-sm font-bold uppercase">
                        {isScanning ? 'DISCOVERING...' : 'LOCAL SUBNET'}
                    </span>
                </div>
                
                <div className="flex items-center gap-2">
                     <label className="flex items-center gap-2 cursor-pointer p-1">
                        <input type="checkbox" checked={autoConnect} onChange={e => setAutoConnect(e.target.checked)} className="accent-ghost-primary w-4 h-4" />
                        <span className="text-[10px] font-bold text-white/70">AUTO</span>
                     </label>
                </div>
            </div>
            
            {/* Start Button */}
            <button 
                onClick={isScanning ? undefined : startIntelligentScan}
                disabled={isScanning}
                className={`w-full py-3 md:py-3 font-black uppercase text-xs md:text-sm border border-ghost-primary tracking-widest transition-all rounded ${isScanning ? 'bg-ghost-primary/10 text-ghost-primary cursor-wait' : 'bg-ghost-primary text-black hover:scale-[1.02] shadow-[0_0_15px_rgba(0,255,148,0.4)]'}`}
            >
                {isScanning ? `SCANNING... (${Math.floor(scanProgress)}%)` : 'SEARCH'}
            </button>
            
            {/* Progress Bar */}
            <div className="h-1 bg-gray-900 w-full overflow-hidden mb-2 mt-1 rounded-full">
                <div className={`h-full ${isScanning ? 'bg-ghost-accent w-full animate-scan-beam' : 'bg-ghost-primary transition-all duration-300'}`} style={{ width: isScanning ? '100%' : `${scanProgress}%` }} />
            </div>

            {/* Results List */}
            <div className="flex-1 border border-ghost-primary/20 overflow-y-auto bg-black/40 p-1 md:p-2 scrollbar-thin scrollbar-thumb-ghost-primary/30 min-h-[50px] rounded">
                {foundNodes.length === 0 && !isScanning && (
                    <div className="text-center text-white/20 text-xs mt-10 flex flex-col items-center">
                        AWAITING DISCOVERY
                    </div>
                )}
                {foundNodes.map(node => (
                    <div key={node.id} className="mb-2 p-2 md:p-2 border border-white/5 hover:border-ghost-primary/50 transition-colors cursor-pointer bg-black/60 group relative overflow-hidden rounded"
                         onClick={() => node.status === 'OPEN' && handleConnect(node.streamUrl || `http://${node.ip}/video`, node.protocol)}>
                        <div className="absolute inset-0 bg-ghost-primary/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300" />
                        
                        <div className="relative flex justify-between items-start">
                             <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${node.status === 'OPEN' ? 'bg-ghost-primary shadow-[0_0_5px_#00FF94]' : 'bg-red-500'}`} />
                                <span className="font-bold text-[10px] md:text-xs text-white">{node.label}</span>
                             </div>
                             <span className="text-[9px] text-ghost-accent font-mono border border-ghost-accent/30 px-1.5 rounded">{node.protocol}</span>
                        </div>
                        <div className="relative flex justify-between items-end mt-1">
                            <span className="text-[10px] text-white/40 font-mono">{node.ip}</span>
                            <div className="flex items-end gap-[1px] h-3">
                                {[20, 40, 60, 80, 100].map(th => (
                                    <div key={th} className={`w-1 ${node.signalStrength >= th ? 'bg-ghost-primary' : 'bg-white/10'}`} style={{ height: `${th}%` }} />
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Logs */}
        <div className="h-16 md:h-32 bg-black border border-ghost-primary/20 p-2 overflow-hidden text-[9px] md:text-[10px] font-mono text-white/50 leading-tight z-10 font-tech rounded">
             {logs.slice(-4).map((l, i) => (
                 <div key={i} className="animate-in fade-in slide-in-from-left-2 duration-300 border-l border-ghost-primary/20 pl-1 mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                   <span className="text-ghost-primary opacity-50">{'>'}</span> {l}
                 </div>
             ))}
        </div>

      </div>

      {/* RIGHT PANEL: VIDEO FEED (Top on Mobile) */}
      <div className="w-full h-[50%] md:w-2/3 md:h-full relative flex flex-col bg-black order-1 md:order-2">
          <div className="absolute top-4 right-4 z-50">
             <button onClick={onClose} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500 px-4 py-2 uppercase font-bold text-xs transition-all tracking-widest rounded">
                [X] EXIT
             </button>
          </div>

          <div className="flex-1 relative overflow-hidden flex items-center justify-center">
             {/* Background Grid */}
             <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
             <div className="absolute inset-0 bg-radial-gradient(circle at center, transparent 30%, black 90%)" />
             
             {activeStream ? (
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                    <video 
                        ref={videoRef}
                        src={activeStream}
                        autoPlay
                        loop
                        controls
                        className="max-w-full max-h-full border border-ghost-primary/20 shadow-[0_0_50px_rgba(0,255,148,0.1)]"
                        onError={(e) => {
                            const isRTSP = activeStream.startsWith('rtsp');
                            if (isRTSP) {
                                setLogs(l => [...l, `ERR: RTSP RENDER FAIL`]);
                            } else {
                                setLogs(l => [...l, `ERR: TIMEOUT`]);
                            }
                        }}
                    />
                    
                    {/* Error Overlay for RTSP (Simulated) */}
                    {activeStream.startsWith('rtsp') && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 p-4 text-center">
                            <div className="text-red-500 font-bold text-lg md:text-2xl animate-pulse mb-2">PROTOCOL MISMATCH</div>
                            <div className="text-white/60 text-xs font-mono max-w-md">
                                Raw RTSP requires WebRTC gateway.<br/>
                            </div>
                            <button onClick={() => setActiveStream(null)} className="mt-4 border border-white/20 px-4 py-2 text-xs text-white hover:bg-white/10 rounded">RESET</button>
                        </div>
                    )}

                    {/* Stream Overlays */}
                    <div className="absolute top-4 left-4 flex gap-2 z-10">
                        <div className="bg-red-600 text-white px-2 py-1 text-[10px] font-bold animate-pulse rounded">REC</div>
                        <div className="bg-ghost-primary/20 text-ghost-primary px-2 py-1 text-[10px] font-bold rounded">LIVE</div>
                    </div>
                </div>
             ) : (
                 <div className="text-center opacity-40 flex flex-col items-center p-4">
                     <div className="w-20 h-20 md:w-32 md:h-32 border border-ghost-primary/30 rounded-full flex items-center justify-center mb-4 relative">
                        <div className="absolute inset-0 rounded-full border-t-2 border-ghost-primary animate-spin" />
                        <div className="w-16 h-16 md:w-24 md:h-24 bg-ghost-primary/5 rounded-full" />
                     </div>
                     <div className="text-lg md:text-2xl font-black tracking-widest text-ghost-primary mb-1">NO FEED</div>
                     <div className="text-xs md:text-sm font-mono text-white/50 max-w-xs">
                         Select a target from the list
                     </div>
                 </div>
             )}
          </div>
      </div>

    </div>
  );
};
