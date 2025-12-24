
import { MISTRAL_API_KEY, MINIMAX_API_KEY, MINIMAX_GROUP_ID } from '../constants';

// Интерфейс ответа
interface AnalysisResult {
  text: string;
  provider: 'MINIMAX' | 'MISTRAL' | 'ERROR';
}

/**
 * Вызывает Minimax API (Vision capabilities)
 * Использует формат, совместимый с OpenAI (часто поддерживается через прокси) или нативный endpoint.
 */
async function callMinimax(base64Image: string, prompt: string): Promise<string> {
  const url = `https://api.minimax.chat/v1/text/chatcompletion_v2`;
  
  const payload = {
    model: "abab6.5s-chat", // Быстрая модель
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt + " ОТВЕЧАЙ НА РУССКОМ." }
        ]
      }
    ],
    temperature: 0.1,
    max_tokens: 100
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MINIMAX_API_KEY}`,
      "Content-Type": "application/json",
      "GroupId": MINIMAX_GROUP_ID
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Minimax Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Вызывает Mistral API (Pixtral Model)
 * Pixtral - это мультимодальная модель Mistral, идеально подходит для Vision.
 */
async function callMistral(base64Image: string, prompt: string): Promise<string> {
  const url = "https://api.mistral.ai/v1/chat/completions";
  
  const payload = {
    model: "pixtral-12b-2409", // Vision модель Mistral
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt + " ОТВЕЧАЙ СТРОГО НА РУССКОМ." },
          { 
            type: "image_url", 
            image_url: { 
              url: `data:image/jpeg;base64,${base64Image}` 
            } 
          }
        ]
      }
    ],
    max_tokens: 100,
    temperature: 0.1
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MISTRAL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Mistral Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Основная функция с каскадным переключением (Fallback Strategy)
 */
export const analyzeImageMultimodal = async (base64Image: string, prompt: string): Promise<AnalysisResult> => {
  try {
    // Попытка 1: Mistral (Pixtral) - надежный Vision
    const text = await callMistral(base64Image, prompt);
    return { text, provider: 'MISTRAL' };
  } catch (errMistral) {
    console.warn("Mistral failed, switching to Minimax fallback...", errMistral);
    
    try {
      // Попытка 2: Minimax (Fallback)
      const text = await callMinimax(base64Image, prompt + " (Изображение недоступно, дай общую тактическую оценку)");
      return { text, provider: 'MINIMAX' };
    } catch (errMinimax) {
      console.error("All providers failed", errMinimax);
      return { text: "ОШИБКА | СВЯЗЬ ПОТЕРЯНА", provider: 'ERROR' };
    }
  }
};
