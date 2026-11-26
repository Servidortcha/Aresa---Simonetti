import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROLES_PERMITIDOS = ["admin", "subadmin", "compras"];
const MAX_BYTES = 4 * 1024 * 1024;
const MIME_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

// Google retira modelos cada tanto (por ejemplo, gemini-2.5-flash quedó
// bloqueado para claves nuevas en noviembre de 2026). Para no depender de un
// nombre fijo, si el modelo configurado no existe se consulta la lista real de
// modelos disponibles y se elige el mejor "flash" que acepte generateContent.
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

const PROMPT_FACTURA = `Sos un asistente contable experto en comprobantes argentinos.
Analizá la imagen o PDF adjunto y extraé los datos de esta FACTURA DE PROVEEDOR.

Devolvé EXCLUSIVAMENTE un objeto JSON válido, sin texto adicional ni bloques de código, con esta forma:
{
  "proveedor": "razón social del proveedor o null",
  "numero": "número completo del comprobante o null",
  "fecha": "fecha de emisión en formato YYYY-MM-DD o null",
  "vencimiento": "fecha de vencimiento en formato YYYY-MM-DD o null",
  "importe": número decimal con el TOTAL FINAL de la factura o null,
  "moneda": "ARS" o "USD" o null,
  "categoria": "categoría breve del gasto (Materiales, Herramientas, Servicios, Combustible, etc.) o null",
  "observaciones": "detalle breve o null"
}

Reglas:
- "importe" es el total final a pagar, con impuestos incluidos. Interpretá correctamente el formato argentino (1.234,56 = 1234.56).
- No inventes datos: si un dato no aparece o no se puede leer, usá null.
- "numero" incluye punto de venta y tipo si figura (ej. A-0001-00012345).
- "moneda": ARS si dice pesos, $ o ARS; USD si dice dólares, USD o U$S.
- "vencimiento" solo si el comprobante lo indica.`;

const PROMPT_PAGO = `Sos un asistente contable experto en comprobantes argentinos.
Analizá la imagen o PDF adjunto y extraé los datos de este COMPROBANTE DE PAGO (transferencia, depósito, cheque, recibo, etc.).

Devolvé EXCLUSIVAMENTE un objeto JSON válido, sin texto adicional ni bloques de código, con esta forma:
{
  "fecha": "fecha del pago en formato YYYY-MM-DD o null",
  "importe": número decimal con el importe pagado o null,
  "medio_pago": "Transferencia" | "Cheque" | "Efectivo" | "Tarjeta" | "Otro" | null,
  "referencia": "número de operación, transferencia, cheque, CBU/alias destinatario o null",
  "observaciones": "detalle breve o null"
}

Reglas:
- "importe" es el monto efectivamente pagado. Interpretá correctamente el formato argentino (1.234,56 = 1234.56).
- No inventes datos: si un dato no aparece o no se puede leer, usá null.
- "medio_pago": elegí una de las opciones exactas del listado.
- "referencia": priorizá número de operación, número de cheque o CBU/alias.`;

function texto(valor) {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  if (!limpio || limpio.toLowerCase() === "null") return null;
  return limpio.slice(0, 400);
}

function normalizarFecha(valor) {
  if (!valor) return null;
  const s = String(valor).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function normalizarImporte(valor) {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return Math.round(valor * 100) / 100;
  }
  if (typeof valor === "string") {
    let s = valor.replace(/[^\d,.-]/g, "");
    if (!s) return null;
    if (s.includes(",") && s.includes(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (s.includes(",")) {
      s = s.replace(",", ".");
    }
    const n = Number.parseFloat(s);
    if (Number.isFinite(n)) return Math.round(n * 100) / 100;
  }
  return null;
}

function normalizarMoneda(valor) {
  const s = String(valor || "").toUpperCase();
  if (!s) return null;
  if (s.includes("USD") || s.includes("U$S") || s.includes("DOLAR") || s.includes("DÓLAR")) return "USD";
  if (s.includes("ARS") || s.includes("PESO") || s.includes("$")) return "ARS";
  return null;
}

function normalizarMedio(valor) {
  const s = String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!s) return null;
  if (s.includes("transfer")) return "Transferencia";
  if (s.includes("cheque")) return "Cheque";
  if (s.includes("efectivo")) return "Efectivo";
  if (s.includes("tarjeta")) return "Tarjeta";
  return "Otro";
}

function normalizarDatos(datos, tipo) {
  if (!datos || typeof datos !== "object") return {};
  if (tipo === "pago") {
    return {
      fecha: normalizarFecha(datos.fecha),
      importe: normalizarImporte(datos.importe),
      medio_pago: normalizarMedio(datos.medio_pago),
      referencia: texto(datos.referencia),
      observaciones: texto(datos.observaciones),
    };
  }
  return {
    proveedor: texto(datos.proveedor),
    numero: texto(datos.numero),
    fecha: normalizarFecha(datos.fecha),
    vencimiento: normalizarFecha(datos.vencimiento),
    importe: normalizarImporte(datos.importe),
    moneda: normalizarMoneda(datos.moneda),
    categoria: texto(datos.categoria),
    observaciones: texto(datos.observaciones),
  };
}

function parsearJson(textoRespuesta) {
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

async function autenticar(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { status: 500, error: "Falta la configuración de Supabase en el servidor." };
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return { status: 401, error: "Sesión no válida." };

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: errUser,
  } = await supabase.auth.getUser(token);

  if (errUser || !user) return { status: 401, error: "Sesión no válida o vencida." };

  const { data: perfil, error: errPerfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  if (errPerfil) return { status: 500, error: "No se pudo verificar el rol del usuario." };
  if (!perfil || !ROLES_PERMITIDOS.includes(perfil.rol)) {
    return { status: 403, error: "No tenés permiso para usar la lectura automática." };
  }

  return { user };
}

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

let cacheModelos = { at: 0, lista: [] };

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

async function llamarGemini({ base64, mime, prompt }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY en el servidor.");

  const inicial = modeloResuelto || process.env.GEMINI_MODEL || MODELO_POR_DEFECTO;
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
          throw new Error("La IA no devolvió datos legibles. Probá con una foto más clara.");
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

export async function GET() {
  return NextResponse.json({
    disponible: Boolean(process.env.GEMINI_API_KEY),
    proveedor: "gemini",
    modelo: modeloResuelto || process.env.GEMINI_MODEL || MODELO_POR_DEFECTO,
  });
}

export async function POST(request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "La lectura automática no está configurada. Falta GEMINI_API_KEY en el servidor." },
        { status: 503 }
      );
    }

    const auth = await autenticar(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const form = await request.formData();
    const archivo = form.get("archivo");
    const tipo = String(form.get("tipo") || "factura") === "pago" ? "pago" : "factura";

    if (!archivo || typeof archivo === "string" || typeof archivo.arrayBuffer !== "function") {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }

    if (archivo.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "El archivo supera los 4 MB. La lectura automática está limitada; podés guardarlo manualmente." },
        { status: 413 }
      );
    }

    const mime = archivo.type || "";
    if (!MIME_PERMITIDOS.includes(mime)) {
      return NextResponse.json(
        { error: "Formato no soportado por la IA. Usá PDF, JPG, PNG o WEBP." },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const base64 = buffer.toString("base64");
    const prompt = tipo === "pago" ? PROMPT_PAGO : PROMPT_FACTURA;

    const { datos, modelo } = await llamarGemini({ base64, mime, prompt });

    return NextResponse.json({
      ok: true,
      tipo,
      modelo,
      datos: normalizarDatos(datos, tipo),
    });
  } catch (err) {
    console.error("Error en lectura IA:", err);
    return NextResponse.json(
      { error: err.message || "No se pudo leer el archivo con IA." },
      { status: 500 }
    );
  }
}
