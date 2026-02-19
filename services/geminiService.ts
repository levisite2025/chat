
import { GoogleGenAI, Type } from "@google/genai";

// Fix: Initialize GoogleGenAI strictly using process.env.API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getSmartReplies = async (history: { text: string, sender: string }[]): Promise<string[]> => {
  try {
    const chatContext = history.slice(-5).map(m => `${m.sender}: ${m.text}`).join('\n');
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on this chat history, suggest 3 short, natural-sounding Portuguese replies:
      ${chatContext}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replies: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    // Fix: Access .text property and trim before parsing, providing a fallback for undefined
    const text = response.text?.trim() || "{\"replies\": []}";
    const result = JSON.parse(text);
    return result.replies || [];
  } catch (error) {
    console.error("Gemini Error:", error);
    return ["Olá!", "Tudo bem?", "Entendido."];
  }
};

export const translateMessage = async (text: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Translate the following message to English: "${text}"`,
        });
        // Fix: Directly access the .text property as it is a getter, not a method
        return response.text || text;
    } catch (error) {
        return text;
    }
};
