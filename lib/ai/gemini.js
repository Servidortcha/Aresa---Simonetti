// ============================================================
// lib/ai/gemini.js
// Lógica compartida para hablar con Google Gemini desde el
// servidor. La clave vive solo en el backend (GEMINI_API_KEY).
//
// Incluye:
//   - Detección automática de un modelo disponible (Google retira
//     modelos cada tanto; ej. gemini-2.5-flash quedó bloqueado
//     para claves nuevas en noviembre de 2026).
//   - Reintento con otro modelo si el actual está saturado (5xx).
//   - Límite total de tiempo para no exceder la función de Vercel.
//   - Parseo tolerante de la respuesta JSON.
// ============================================================

const MODELO_POR_DEFECTO = "gemini-3.8-flash";
const MODELOS_PREFERIDOS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];
const EXCLUIR_MODELO = /(preview|exp|tts|live|image|audio|embedding|computer-use|robotics|omni|nano)/i;

let modeloResuelto = null;
let cacheModelos = { at: 0, lista: [] };

function puntajeModelo(nombre) {
  const m = String(nombre).match(/(\d+)(?:\.(\d+))?/);
  if (!m) return 0;
  return Number(m[1]) + Number(m[2] || 0) / 10;
}

async function listarModelos(apiKey) {
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
      { headers: { "x-goog-api-key": apiKey }, cache: "no-store" }
    );
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    return (json?.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => String(m.name || "").replace(/^models\//, ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function modelosDisponibles(apiKey, forzar = false) {
  const ahora = Date.now();
  if (!forzar && cacheModelos.lista.length && ahora - cacheModelos.at < 60 * 60 * 1000) {
    return cacheModelos.lista;
  }
  const lista = await listarModelos(apiKey);
  if (lista.length) cacheModelos = { at: ahora, lista };
  return lista;
}

function elegirModelo(disponibles) {
  for (const preferido of MODELOS_PREFERIDOS) {
    if (disponibles.includes(preferido)) return preferido;
  }
  const flash = disponibles
    .filter((n) => /flash/i.test(n) && !EXCLUIR_MODELO.test(n))
    .sort((a, b) => puntajeModelo(b) - puntajeModelo(a));
  if (flash.length) return flash[0];
  const cualquiera = disponibles
    .filter((n) => !EXCLUIR_MODELO.test(n))
    .sort((a, b) => puntajeModelo(b) - puntajeModelo(a));
  return cualquiera[0] || null;
}

async function pedirGemini({ apiKey, modelo, base64, mime, prompt, conConfig, deadline }) {
  const controller = new AbortController();
  const restante = Math.max(5000, (deadline || Date.now() + 50000) - Date.now());
  const timeout = setTimeout(() => controller.abort(), Math.min(50000, restante));

  try {
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mime, data: base64 } },
          ],
        },
      ],
    };
    if (conConfig) body.generationConfig = { responseMimeType: "application/json" };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    const json = await res.json().catch(() => null);
    return { res, json };
  } finally {
    clearTimeout(timeout);
  }
}

async function intentarModelo({ apiKey, modelo, base64, mime, prompt, deadline }) {
  let { res, json } = await pedirGemini({ apiKey, modelo, base64, mime, prompt, conConfig: true, deadline });

  // Los modelos Gemini 3 ignoran o rechazan algunos parámetros de
  // generationConfig: si el error lo menciona, reintentamos sin ellos.
  if (res.status === 400) {
    const msg = json?.error?.message || "";
    if (/generationconfig|temperature|top_?p|top_?k|response_?mime/i.test(msg)) {
      ({ res, json } = await pedirGemini({ apiKey, modelo, base64, mime, prompt, conConfig: false, deadline }));
    }
  }

  return { res, json };
}

export function parsearJson(textoRespuesta) {
  const limpio = String(textoRespuesta || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(limpio);
  } catch {
    const inicio = limpio.indexOf("{");
    const fin = limpio.lastIndexOf("}");
    if (inicio !== -1 && fin > inicio) {
      try {
        return JSON.parse(limpio.slice(inicio, fin + 1));
      } catch {
        // sigue abajo
      }
    }
  }
  throw new Error("La IA devolvió una respuesta que no se pudo interpretar.");
}

export function modeloActual() {
  return modeloResuelto || process.env.GEMINI_MODEL || MODELO_POR_DEFECTO;
}

export async function llamarGemini({ base64, mime, prompt, mensajeVacio }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY en el servidor.");

  const inicial = modeloActual();
  const deadline = Date.now() + 55000;
  const probados = [];
  let disponibles = null;
  let forzarLista = false;
  let ultimoError = null;

  try {
    // Hasta 3 intentos: si el modelo no existe (404) o está saturado (5xx),
    // se prueba automáticamente con otro modelo habilitado de la cuenta.
    for (let intento = 0; intento < 3; intento++) {
      let modelo;
      if (intento === 0) {
        modelo = inicial;
      } else {
        disponibles = await modelosDisponibles(apiKey, forzarLista);
        forzarLista = false;
        modelo =
          elegirModelo(disponibles.filter((m) => !probados.includes(m))) ||
          MODELOS_PREFERIDOS.find((m) => !probados.includes(m)) ||
          null;
        if (!modelo) break;
      }
      probados.push(modelo);

      const { res, json } = await intentarModelo({ apiKey, modelo, base64, mime, prompt, deadline });

      if (res.ok) {
        const textoRespuesta =
          json?.candidates?.[0]?.content?.parts
            ?.map((p) => p.text)
            .filter(Boolean)
            .join("\n") || "";

        if (!textoRespuesta) {
          throw new Error(mensajeVacio || "La IA no devolvió datos legibles. Probá con un archivo más claro.");
        }

        modeloResuelto = modelo;
        return { datos: parsearJson(textoRespuesta), modelo };
      }

      const mensaje = json?.error?.message || `Error ${res.status}`;

      if (res.status === 401 || res.status === 403) {
        throw new Error("La clave de Gemini no es válida o no tiene permisos.");
      }
      if (res.status === 404) {
        forzarLista = true;
        ultimoError = new Error(
          "Ningún modelo de Gemini respondió. Modelos disponibles: " +
            ((disponibles || []).slice(0, 8).join(", ") || "no se pudieron consultar") +
            "."
        );
        continue;
      }
      if (res.status === 429) {
        ultimoError = new Error("Se superó el límite de uso de Gemini. Probá de nuevo en unos minutos.");
        continue;
      }
      if (res.status >= 500) {
        ultimoError = new Error(
          "El modelo de IA está saturado en este momento. Probá de nuevo en unos segundos."
        );
        continue;
      }
      throw new Error("Gemini no pudo procesar el archivo: " + mensaje);
    }

    throw ultimoError || new Error("No se pudo obtener respuesta de la IA. Probá de nuevo en unos segundos.");
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("La lectura con IA tardó demasiado. Probá de nuevo.");
    }
    throw err;
  }
}
