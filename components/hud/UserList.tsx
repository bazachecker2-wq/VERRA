
import React, { useState, useEffect } from 'react';
import { useTactical } from '../../contexts/TacticalContext';

export const UserList: React.FC<{ initialTargetId?: string | null }> = ({ initialTargetId }) => {
  const { onlineUsers, myUnitId, requestSwap, sendMessage, messages, activeSwap } = useTactical();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default

  useEffect(() => {
    if (initialTargetId) {
        setTargetId(initialTargetId);
        setIsExpanded(true);
    }
  }, [initialTargetId]);

  const targetMessages = messages.filter(m => 
    (m.sender_id === targetId && m.receiver_id === myUnitId) ||
    (m.sender_id === myUnitId && m.receiver_id === targetId)
  );

  return (
    <div className="fixed top-20 left-4 md:top-24 md:left-10 z-50 flex flex-col gap-2 pointer-events-auto transition-all duration-300">
      
      {/* Active Nodes List */}
      <div 
        className={`bg-black/40 border backdrop-blur-xl shadow-xl rounded-lg transition-all duration-300 overflow-hidden ${isExpanded ? 'w-64 md:w-80 p-3 md:p-4 border-ghost-primary/10' : 'w-10 h-10 md:w-12 md:h-12 p-0 border-ghost-primary/30 hover:bg-ghost-primary/20 cursor-pointer flex items-center justify-center'}`}
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        {isExpanded ? (
          <>
            <div className="text-[10px] md:text-xs font-black text-ghost-primary mb-2 uppercase tracking-widest border-b border-ghost-primary/20 pb-2 flex justify-between items-center">
              <span>NODES</span>
              <div className="flex items-center gap-3">
                 <span className="animate-pulse text-ghost-primary">● {onlineUsers.length}</span>
                 <button 
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} 
                    className="text-white/50 hover:text-white px-2 py-1"
                 >
                    –
                 </button>
              </div>
            </div>
            <div className="flex flex-col gap-1 md:gap-1.5 max-h-32 md:max-h-48 overflow-y-auto no-scrollbar">
              {onlineUsers.map(user => (
                <div 
                  key={user.unit_id}
                  onClick={() => user.unit_id !== myUnitId && setTargetId(user.unit_id)}
                  className={`flex justify-between items-center px-2 py-1 text-[10px] md:text-xs font-mono cursor-pointer transition-colors rounded ${user.unit_id === myUnitId ? 'text-white/30' : 'hover:bg-ghost-primary/10 text-ghost-primary/80'}`}
                >
                  <span className="truncate max-w-[80%]">{user.unit_id === myUnitId ? `${user.unit_id}` : user.unit_id}</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${user.unit_id === myUnitId ? 'bg-white/30' : 'bg-ghost-primary'}`} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center" title="Show Nodes">
             <div className="w-2 h-2 bg-ghost-primary rounded-full animate-pulse shadow-[0_0_5px_#00FF94]" />
             {onlineUsers.length > 1 && (
                <div className="absolute -top-1 -right-1 bg-ghost-primary text-black text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-black">
                    {onlineUsers.length}
                </div>
             )}
          </div>
        )}
      </div>

      {targetId && isExpanded && (
        <div className="bg-black/95 border border-ghost-primary p-3 md:p-4 w-64 md:w-80 shadow-[0_0_50px_rgba(0,255,148,0.2)] animate-in slide-in-from-left-4 duration-300 rounded-lg">
           <div className="flex justify-between items-center mb-2 border-b border-ghost-primary/30 pb-2">
              <span className="text-[10px] md:text-xs font-bold text-ghost-primary tracking-tighter truncate max-w-[180px]">{targetId}</span>
              <button onClick={() => setTargetId(null)} className="text-ghost-primary hover:text-white px-2 py-1 text-xs">✕</button>
           </div>
           <div className="flex gap-2 mb-2">
              <button onClick={() => requestSwap(targetId)} className="flex-1 bg-ghost-primary/10 border border-ghost-primary/40 py-1.5 text-[9px] md:text-[10px] font-black text-ghost-primary hover:bg-ghost-primary hover:text-black transition-all rounded">
                LINK_VISOR
              </button>
           </div>
           <div className="h-32 md:h-40 overflow-y-auto mb-2 flex flex-col gap-1.5 p-1.5 bg-black/50 border border-white/5 font-mono rounded">
              {targetMessages.slice().reverse().map((m, i) => (
                <div key={i} className={`text-[10px] p-1.5 rounded ${m.sender_id === myUnitId ? 'text-white/60 text-right bg-white/5' : 'text-ghost-primary bg-ghost-primary/5'}`}>
                   {m.content}
                </div>
              ))}
           </div>
           <div className="flex gap-1.5">
              <input 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    sendMessage(myUnitId, targetId, chatInput);
                    setChatInput('');
                  }
                }}
                placeholder="Message..."
                className="flex-1 bg-transparent border border-ghost-primary/30 px-2 py-1.5 text-[10px] md:text-xs text-ghost-primary focus:outline-none focus:border-ghost-primary rounded"
              />
              <button 
                onClick={() => {
                  sendMessage(myUnitId, targetId, chatInput);
                  setChatInput('');
                }}
                className="bg-ghost-primary px-3 py-1.5 text-black font-black text-[10px] rounded"
              >
                {'>'}
              </button>
           </div>
        </div>
      )}

      {activeSwap && (
        <div className="bg-ghost-accent/20 border border-ghost-accent p-3 md:p-4 w-48 md:w-64 animate-pulse rounded">
           <div className="text-[9px] md:text-[10px] font-black text-ghost-accent mb-1 uppercase">VISOR_LINKED</div>
           <div className="text-[10px] md:text-xs font-mono text-white flex justify-between">
              <span className="truncate max-w-[70%]">{activeSwap.unit_id === myUnitId ? activeSwap.visor_target : activeSwap.unit_id}</span>
              <span>{Math.max(0, Math.floor((activeSwap.visor_expires - Date.now())/1000))}s</span>
           </div>
        </div>
      )}
    </div>
  );
};
