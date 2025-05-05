// src/plugin.ts
var penpot = globalThis.penpot;
var OPENAI_URL = "https://api.openai.com/v1/chat/completions";
var OPENAI_MODEL = "gpt-4";
async function main() {
  try {
    const foundations = await penpot.storage.getItem("foundations");
    if (!foundations) {
      return requestFoundationsUpload();
    }
    const apiKey = await penpot.storage.getItem("openai_api_key");
    if (!apiKey) {
      return requestApiKeyInput();
    }
    await penpot.ui.showToast("\u{1F389} Plugin listo. Ingresa un prompt para generar UI.");
    await requestPromptInput();
  } catch (err) {
    console.error("main error:", err);
  }
}
async function requestFoundationsUpload() {
  const html = `
<div style="padding:16px;font-family:sans-serif;">
  <h2>Importa JSON de Foundations</h2>
  <input id="file" type="file" accept="application/json" />
  <button id="load" disabled>Cargar Foundations</button>
</div>
`;
  await penpot.ui.showUI({ width: 300, height: 200 }, html);
  penpot.ui.on("message", async (msg) => {
    const payload = msg.pluginMessage;
    if (payload?.type === "foundations-json") {
      try {
        const data = JSON.parse(payload.data);
        await penpot.storage.setItem("foundations", data);
        await penpot.ui.showToast("\u2705 Foundations importados");
        penpot.ui.close();
        main();
      } catch (error) {
        console.error("JSON parsing error:", error);
        await penpot.ui.showToast("\u274C Error al parsear JSON");
      }
    }
  });
  penpot.ui.postMessage({
    type: "inject-script",
    script: `
(function() {
  const input = document.getElementById('file');
  const btn = document.getElementById('load');
  input.addEventListener('change', () => { btn.disabled = !input.files.length; });
  btn.addEventListener('click', () => {
    const reader = new FileReader();
    reader.onload = () => parent.postMessage({ pluginMessage: { type: 'foundations-json', data: reader.result } }, '*');
    reader.readAsText(input.files[0]);
  });
})();`
  });
}
async function requestApiKeyInput() {
  const html = `
<div style="padding:16px;font-family:sans-serif;">
  <h2>Ingresa tu API Key de OpenAI</h2>
  <input id="key" type="password" style="width:100%;" />
  <button id="save" disabled>Guardar</button>
</div>
`;
  await penpot.ui.showUI({ width: 300, height: 180 }, html);
  penpot.ui.on("message", async (msg) => {
    const payload = msg.pluginMessage;
    if (payload?.type === "api-key") {
      await penpot.storage.setItem("openai_api_key", payload.data);
      await penpot.ui.showToast("\u{1F511} API Key guardada");
      penpot.ui.close();
      main();
    }
  });
  penpot.ui.postMessage({
    type: "inject-script",
    script: `
(function() {
  const input = document.getElementById('key');
  const btn = document.getElementById('save');
  input.addEventListener('input', () => { btn.disabled = !input.value.trim(); });
  btn.addEventListener('click', () => {
    parent.postMessage({ pluginMessage: { type: 'api-key', data: input.value.trim() } }, '*');
  });
})();`
  });
}
async function requestPromptInput() {
  const html = `
<div style="padding:16px;font-family:sans-serif;">
  <h2>Describe el componente UI</h2>
  <textarea id="prompt" rows="4" style="width:100%;font-size:14px;"></textarea>
  <button id="go" disabled>Generar</button>
</div>
`;
  await penpot.ui.showUI({ width: 350, height: 260 }, html);
  penpot.ui.on("message", async (msg) => {
    const payload = msg.pluginMessage;
    if (payload?.type === "user-prompt") {
      penpot.ui.close();
      await generateUI(payload.data);
    }
  });
  penpot.ui.postMessage({
    type: "inject-script",
    script: `
(function() {
  const input = document.getElementById('prompt');
  const btn = document.getElementById('go');
  input.addEventListener('input', () => { btn.disabled = !input.value.trim(); });
  btn.addEventListener('click', () => {
    parent.postMessage({ pluginMessage: { type: 'user-prompt', data: input.value.trim() } }, '*');
  });
})();`
  });
}
async function generateUI(prompt) {
  try {
    const foundations = await penpot.storage.getItem("foundations");
    const apiKey = await penpot.storage.getItem("openai_api_key");
    const systemMessage = `Eres un asistente que genera un array JSON de nodos UI usando estos foundations:
${JSON.stringify(foundations)}`;
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model: OPENAI_MODEL, messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt }
      ], temperature: 0.7 })
    });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Sin contenido en la respuesta");
    const ui = JSON.parse(content);
    await placeNodes(ui.nodes);
  } catch (error) {
    console.error("generateUI error:", error);
    await penpot.ui.showToast("\u274C Error generando UI");
  }
}
async function placeNodes(nodes) {
  for (const node of nodes) {
    try {
      if (node.type === "RECTANGLE") {
        await penpot.content.createRectangle({ position: node.position, size: node.size, style: node.style });
      } else if (node.type === "TEXT") {
        await penpot.content.createText({ position: node.position, text: node.content || "", style: node.style });
      }
    } catch (error) {
      console.error("placeNodes error:", node, error);
    }
  }
}
main().catch((error) => console.error("main final error:", error));
