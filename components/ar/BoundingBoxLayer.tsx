
import React, { useEffect, useRef } from 'react';
import { useHardware } from '../../contexts/HardwareContext';
import { useTactical } from '../../contexts/TacticalContext';
import { GhostMarker } from '../../types';

export const BoundingBoxLayer: React.FC = () => {
  const { videoRef, status } = useHardware();
  const { trackedObjectsRef, ghostMarkers, myUnitId } = useTactical();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || status !== 'ACTIVE') return;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      let rafId: number;
      
      const render = () => {
          if (!videoRef.current) {
              rafId = requestAnimationFrame(render);
              return;
          }
          const v = videoRef.current;
          if (v.readyState < 2 || v.videoWidth === 0 || v.videoHeight === 0) {
               rafId = requestAnimationFrame(render);
               return;
          }
          
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.parentElement?.getBoundingClientRect(); 
          
          if (!rect) return;

          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(dpr, dpr);
          
          const canvasW = rect.width;
          const canvasH = rect.height;
          
          const baseScale = Math.min(canvasW / 400, 1.2);
          
          ctx.clearRect(0, 0, canvasW, canvasH);

          const screenRatio = canvasW / canvasH;
          const videoRatio = v.videoWidth / v.videoHeight;
          
          let renderW, renderH, offsetX, offsetY;
          
          if (screenRatio > videoRatio) {
              renderW = canvasW;
              renderH = canvasW / videoRatio;
              offsetX = 0;
              offsetY = (canvasH - renderH) / 2;
          } else {
              renderH = canvasH;
              renderW = canvasH * videoRatio;
              offsetY = 0;
              offsetX = (canvasW - renderW) / 2;
          }

          const now = Date.now();

          // --- 1. RENDER TRACKED OBJECTS ---
          trackedObjectsRef.current.forEach((obj: any) => {
              const bx = obj.sx * renderW + offsetX;
              const by = obj.sy * renderH + offsetY;
              const bw = obj.sw * renderW;
              const bh = obj.sh * renderH;
              
              if (bx > canvasW || bx + bw < 0 || by > canvasH || by + bh < 0) return;

              const distScale = Math.max(0.6, obj.distanceFactor); 
              const baseOpacity = Math.max(0.4, obj.distanceFactor);
              
              const isScanning = obj.focusProgress > 0 && !obj.isAnalyzed;
              const color = isScanning ? '#FFD700' : (obj.color || '#00FF94');
              const alpha = (Math.max(0.3, 1 - (obj.framesMissing / 10))) * baseOpacity;

              ctx.globalAlpha = alpha;

              // --- 3D VOLUMETRIC BRACKETS CALCULATION ---
              // Determine perspective skew based on position from center (0.5, 0.5)
              const centerX = 0.5;
              const centerY = 0.5;
              const objCx = obj.sx + obj.sw/2;
              const objCy = obj.sy + obj.sh/2;
              
              // Depth offset magnitude
              const depthX = (centerX - objCx) * 30 * baseScale; // Shift based on horizontal position
              const depthY = (centerY - objCy) * 20 * baseScale; // Shift based on vertical position
              
              // Draw Rear Rect (The "Back" of the 3D box)
              ctx.lineWidth = 1;
              ctx.strokeStyle = color;
              ctx.globalAlpha = alpha * 0.3;
              
              const rx = bx + depthX;
              const ry = by + depthY;
              const rw = bw; // Keep width same for simple perspective
              const rh = bh;
              
              // Connecting Lines (Vertices)
              ctx.beginPath();
              ctx.moveTo(bx, by); ctx.lineTo(rx, ry);
              ctx.moveTo(bx + bw, by); ctx.lineTo(rx + rw, ry);
              ctx.moveTo(bx + bw, by + bh); ctx.lineTo(rx + rw, ry + rh);
              ctx.moveTo(bx, by + bh); ctx.lineTo(rx, ry + rh);
              ctx.stroke();
              
              // Rear Box Frame
              ctx.beginPath();
              ctx.rect(rx, ry, rw, rh);
              ctx.stroke();

              // --- FRONT BRACKETS (Main UI) ---
              ctx.globalAlpha = alpha;
              ctx.lineWidth = (isScanning ? 2.5 : 2) * distScale;
              const cornerLen = Math.min(bw, bh) * 0.25 * distScale;
              
              ctx.beginPath();
              ctx.moveTo(bx, by + cornerLen); ctx.lineTo(bx, by); ctx.lineTo(bx + cornerLen, by);
              ctx.moveTo(bx + bw - cornerLen, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cornerLen);
              ctx.moveTo(bx + bw, by + bh - cornerLen); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw - cornerLen, by + bh);
              ctx.moveTo(bx + bw - cornerLen, by + bh); ctx.lineTo(bx, by + bh); ctx.lineTo(bx, by + bh - cornerLen);
              ctx.stroke();

              // --- SEGMENTATION DOTS (Floating inside volume) ---
              if (obj.isAnalyzed && obj.segmentPoints) {
                 ctx.fillStyle = color;
                 obj.segmentPoints.forEach((p: any) => {
                      // Project point between front and back plane based on its 'z' (simulated here)
                      const z = 0.5; 
                      const px = bx + (p.x * bw) + (depthX * z);
                      const py = by + (p.y * bh) + (depthY * z);
                      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI*2); ctx.fill();
                  });
              }

              // --- GLASS UI LABELS ---
              if (obj.distanceFactor > 0.3 || isScanning || obj.isAnalyzed) {
                  const fontSize = Math.max(9 * baseScale, 12 * distScale * baseScale);
                  ctx.font = `bold ${fontSize}px "JetBrains Mono"`;
                  const label = obj.label;
                  const tm = ctx.measureText(label);
                  const pad = 6 * distScale;
                  
                  // Label Background (Glass Effect)
                  ctx.save();
                  ctx.shadowColor = 'rgba(0,0,0,0.5)';
                  ctx.shadowBlur = 10;
                  ctx.fillStyle = 'rgba(0, 20, 10, 0.7)'; // Semi-transparent dark green
                  ctx.strokeStyle = color;
                  ctx.lineWidth = 1;
                  
                  const labelX = bx;
                  const labelY = by - fontSize - pad*2;
                  const labelW = tm.width + pad*2;
                  const labelH = fontSize + pad;
                  
                  ctx.fillRect(labelX, labelY, labelW, labelH);
                  ctx.strokeRect(labelX, labelY, labelW, labelH);
                  ctx.restore();
                  
                  // Text
                  ctx.fillStyle = color;
                  ctx.textBaseline = 'bottom';
                  ctx.shadowColor = color;
                  ctx.shadowBlur = 4;
                  ctx.fillText(label, bx + pad, by - pad);
                  ctx.shadowBlur = 0;

                  // DEPTH METER (Right Side)
                  if (obj.depthMeters) {
                      const depthText = `${obj.depthMeters}m`;
                      ctx.font = `${8 * baseScale}px "Share Tech Mono"`;
                      ctx.fillStyle = color;
                      ctx.fillText(depthText, bx + bw - (ctx.measureText(depthText).width) - 2, by + bh - 2);
                  }

                  // DESCRIPTION BOX (Side projected)
                  if (obj.description) {
                      const descX = bx + bw + 15; // Offset to right
                      const descY = by;
                      const descFontSize = Math.max(8 * baseScale, 10 * distScale * baseScale);
                      
                      // Connector Line
                      ctx.beginPath(); 
                      ctx.moveTo(bx + bw, by); 
                      ctx.lineTo(descX, by); 
                      ctx.lineTo(descX + 5, by + 5); // Little notch
                      ctx.strokeStyle = color; 
                      ctx.lineWidth = 1;
                      ctx.stroke();
                      
                      const fullText = obj.description;
                      const charsToShow = obj.isAnalyzed ? Math.floor((now - (obj.lastAnalysisTime || 0)) / 20) : 0;
                      const text = fullText.substring(0, Math.max(0, charsToShow));
                      
                      // Wrap Logic
                      const maxW = 140 * baseScale;
                      const words = text.split(' ');
                      let lines = [];
                      let line = '';
                      
                      words.forEach((word: string) => {
                          const testLine = line + word + ' ';
                          if (ctx.measureText(testLine).width > maxW) {
                              lines.push(line);
                              line = word + ' ';
                          } else {
                              line = testLine;
                          }
                      });
                      lines.push(line);
                      
                      // Draw Description Box Background
                      const descH = (lines.length * (descFontSize + 4)) + 10;
                      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                      ctx.fillRect(descX, descY, maxW + 10, descH);
                      ctx.strokeRect(descX, descY, maxW + 10, descH);

                      ctx.font = `${descFontSize}px "Share Tech Mono"`;
                      ctx.fillStyle = '#FFFFFF';
                      ctx.textBaseline = 'top';
                      ctx.shadowColor = 'black';
                      ctx.shadowBlur = 4;
                      
                      lines.forEach((l, i) => {
                          ctx.fillText(l, descX + 5, descY + 5 + (i * (descFontSize + 4)));
                      });
                      ctx.shadowBlur = 0;
                  }
              }
              
              // Scanning Circle
              if (isScanning) {
                  const progress = obj.focusProgress / 1000;
                  const cx = bx + bw/2; const cy = by + bh/2; const rad = Math.min(bw, bh) * 0.3;
                  ctx.beginPath(); ctx.arc(cx, cy, rad, -Math.PI/2, (-Math.PI/2) + (Math.PI*2 * progress));
                  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
              }
          });

          // --- 2. GHOST MARKERS ---
          ghostMarkers.forEach(m => {
              const mx = m.x * renderW + offsetX;
              const my = m.y * renderH + offsetY;
              const isMine = m.unitId === myUnitId;
              const markerColor = isMine ? (m.color || '#00FF94') : '#00E5FF';

              ctx.globalAlpha = 1.0;
              ctx.shadowColor = markerColor; ctx.shadowBlur = 10;

              ctx.beginPath();
              ctx.arc(mx, my, isMine ? 6 * baseScale : 4 * baseScale, 0, Math.PI * 2);
              ctx.fillStyle = isMine ? 'rgba(0,0,0,0.5)' : markerColor;
              ctx.fill();
              ctx.lineWidth = 2; ctx.strokeStyle = markerColor; ctx.stroke();

              ctx.beginPath(); ctx.arc(mx, my, 2 * baseScale, 0, Math.PI * 2); ctx.fillStyle = markerColor; ctx.fill();

              if (isMine) {
                  ctx.font = `bold ${10 * baseScale}px "JetBrains Mono"`;
                  ctx.fillStyle = markerColor; ctx.textBaseline = 'bottom'; ctx.textAlign = 'center';
                  ctx.fillText(m.label, mx, my - (10 * baseScale));
              } else {
                  ctx.font = `${8 * baseScale}px "JetBrains Mono"`;
                  ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
                  ctx.fillText(m.unitId, mx, my + (15 * baseScale));
              }
              ctx.shadowBlur = 0;
          });

          rafId = requestAnimationFrame(render);
      };
      
      rafId = requestAnimationFrame(render);
      return () => cancelAnimationFrame(rafId);
  }, [status, videoRef, trackedObjectsRef, ghostMarkers, myUnitId]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-30 pointer-events-none" style={{ mixBlendMode: 'screen' }} />;
};
