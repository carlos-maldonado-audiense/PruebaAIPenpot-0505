// src/plugin.ts
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
  try {
    const message = event.data;
    console.log('Mensaje recibido de Penpot:', message);
    
    // Manejar diferentes tipos de mensajes
    switch (message.type) {
      case 'init':
        // Verificar si tenemos los datos necesarios
        const foundations = localStorage.getItem('foundations');
        const apiKey = localStorage.getItem('openai_api_key');
        
        if (!foundations) {
          parent.postMessage({
            type: 'requestFoundations',
            data: 'Por favor, sube el archivo de foundations'
          }, '*');
        } else if (!apiKey) {
          parent.postMessage({
            type: 'requestApiKey',
            data: 'Por favor, ingresa tu API Key de OpenAI'
          }, '*');
        } else {
          parent.postMessage({
            type: 'ready',
            data: 'Plugin listo para usar'
          }, '*');
        }
        break;
        
      case 'saveFoundations':
        try {
          const foundations = JSON.parse(message.data);
          localStorage.setItem('foundations', JSON.stringify(foundations));
          parent.postMessage({
            type: 'foundationsSaved',
            data: 'Foundations guardados correctamente'
          }, '*');
        } catch (error) {
          parent.postMessage({
            type: 'error',
            data: 'Error al guardar foundations: ' + error.message
          }, '*');
        }
        break;

      case 'saveApiKey':
        localStorage.setItem('openai_api_key', message.data);
        parent.postMessage({
          type: 'apiKeySaved',
          data: 'API Key guardada correctamente'
        }, '*');
        break;
        
      case 'generateUI':
        // Procesar la generación de UI
        const foundationsData = localStorage.getItem('foundations');
        const apiKeyData = localStorage.getItem('openai_api_key');
        
        if (!foundationsData || !apiKeyData) {
          parent.postMessage({
            type: 'error',
            data: 'Faltan datos necesarios (foundations o API Key)'
          }, '*');
          break;
        }

        const response = await generateUI({
          apiKey: apiKeyData,
          text: message.data.text,
          foundations: JSON.parse(foundationsData)
        });

        parent.postMessage({
          type: 'uiGenerated',
          data: response
        }, '*');
        break;

      case 'error':
        console.error('Error recibido de Penpot:', message.data);
        break;
    }
  } catch (err) {
    console.error('Error en el plugin:', err);
    parent.postMessage({
      type: 'error',
      data: err.message
    }, '*');
  }
});

// Función para generar UI
async function generateUI(params: GenerateUIParams): Promise<OpenAIResponse> {
  try {
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
      throw new Error('Sin contenido en la respuesta');
    }

    return JSON.parse(content) as OpenAIResponse;
  } catch (error) {
    console.error('Error generando UI:', error);
    throw error;
  }
}