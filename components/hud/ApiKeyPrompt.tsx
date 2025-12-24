
import React from 'react';
import { useGhost } from '../../contexts/GhostContext';

export const ApiKeyPrompt: React.FC = () => {
  const { handleOpenApiKeySelection, ghostError, ghostConnectionStatus } = useGhost();

  // Only show if explicitly prompted by the GhostContext due to key issues
  if (ghostConnectionStatus !== 'AWAITING_API_KEY') {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4 md:p-8 font-mono text-ghost-primary">
      <div className="hud-box p-6 md:p-8 max-w-lg w-full text-center border-ghost-accent relative rounded">
        <h2 className="text-xl md:text-2xl font-bold text-ghost-accent mb-4 uppercase text-glow-alert">
          AI UPLINK ERROR
        </h2>
        <p className="text-sm md:text-base text-white/80 mb-6">
          {ghostError || "API Key required for Gemini Live. Please select a paid API key to continue."}
        </p>
        <button
          onClick={handleOpenApiKeySelection}
          className="border border-ghost-primary px-6 py-3 hover:bg-ghost-primary hover:text-black transition-colors uppercase text-lg md:text-xl font-bold mb-4 w-full md:w-auto rounded"
        >
          [ SELECT API KEY ]
        </button>
        <p className="text-[10px] md:text-xs text-white/60">
          Ensure you use a key from a project with billing enabled.
          <br/>
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ghost-accent hover:underline ml-1"
          >
            Learn more
          </a>.
        </p>
      </div>
      {/* Small, subtle error text if available, outside the main box */}
      {ghostError && ghostError.includes("Failed") && (
        <div className="absolute bottom-8 text-red-500 text-xs animate-pulse">
            {ghostError}
        </div>
      )}
    </div>
  );
};
