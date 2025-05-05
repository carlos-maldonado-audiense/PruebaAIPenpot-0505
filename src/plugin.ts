import type { Penpot } from '@penpot/plugin-types';

declare const penpot: Penpot;

// Configuración de OpenAI
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4';

type Foundations = Record<string, any>;
type OpenAIResponse = {
  nodes: Array<{
    type: string;
    position: { x: number; y: number };
    size?: { width: number; height: number };
    style: any;
    content?: string;
  }>;
};

type GenerateUIParams = {
  apiKey: string;
  text: string;
  foundations: Foundations;
};

// Abrir la interfaz del plugin
penpot.ui.open("AI Plugin", "", {
  width: 285,
  height: 540
});

// Configurar el listener para mensajes de Penpot
window.addEventListener("message", async (event) => {
  const message = event.data;
  
  switch (message.type) {
    case 'init':
      const foundations = localStorage.getItem('foundations');
      const apiKey = localStorage.getItem('openai_api_key');
      
      if (!foundations) {
        parent.postMessage({ type: 'requestFoundations' }, '*');
      } else if (!apiKey) {
        parent.postMessage({ type: 'requestApiKey' }, '*');
      } else {
        parent.postMessage({ type: 'ready' }, '*');
      }
      break;
      
    case 'saveFoundations':
      try {
        const foundations = JSON.parse(message.data);
        localStorage.setItem('foundations', JSON.stringify(foundations));
        parent.postMessage({ type: 'foundationsSaved' }, '*');
      } catch {
        parent.postMessage({ type: 'foundationsError' }, '*');
      }
      break;

    case 'saveApiKey':
      localStorage.setItem('openai_api_key', message.data);
      parent.postMessage({ type: 'apiKeySaved' }, '*');
      break;
      
    case 'generateUI':
      const foundationsData = localStorage.getItem('foundations');
      const apiKeyData = localStorage.getItem('openai_api_key');
      
      if (!foundationsData || !apiKeyData) {
        parent.postMessage({ type: 'missingData' }, '*');
        break;
      }

      try {
        const response = await generateUI({
          apiKey: apiKeyData,
          text: message.data.text,
          foundations: JSON.parse(foundationsData)
        });

        parent.postMessage({
          type: 'uiGenerated',
          data: response
        }, '*');
      } catch {
        parent.postMessage({ type: 'generationError' }, '*');
      }
      break;
  }
});

// Función para generar UI
async function generateUI(params: GenerateUIParams): Promise<OpenAIResponse> {
  const systemMessage = `Eres un asistente que genera un array JSON de nodos UI usando estos foundations:\n${JSON.stringify(params.foundations)}`;
  
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: params.text }
      ],
      temperature: 0.7
    })
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error();
  }

  return JSON.parse(content) as OpenAIResponse;
}
