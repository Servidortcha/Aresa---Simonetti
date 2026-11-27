import { NextResponse } from "next/server";
import { autenticarIA } from "../../../../lib/ai/auth";
import { llamarGemini, modeloActual } from "../../../../lib/ai/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROLES_PERMITIDOS = ["admin", "subadmin", "encargado", "supervision"];
const MAX_BYTES = 4 * 1024 * 1024;

const MIME_PERMITIDOS = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/flac",
  "audio/x-flac",
  "video/webm",
];

const MIME_POR_EXTENSION = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  flac: "audio/flac",
};

const PROMPT_PARTE = `Sos un asistente de obra que redacta partes diarios en español de Argentina.
Escuchá el audio y devolvé EXCLUSIVAMENTE un objeto JSON válido, sin texto adicional ni bloques de código, con esta forma:
{
  "tareas": "tareas realizadas, una por línea, cada línea empieza con '- '",
  "novedades": "incidentes, faltantes de material, visitas, clima o pendientes, una por línea con '- '; cadena vacía si no hay"
}

Reglas:
- Transcribí y ordená lo que dice el audio. No inventes datos que no se mencionan.
- Redactá en tercera persona impersonal (ej. "Se colocaron 12 placas", no "colocamos 12 placas").
- Corregí muletillas y repeticiones. Mantené nombres propios, medidas y cantidades tal cual se dicen.
- No agregues títulos, introducciones ni conclusiones.
- Si el audio no se entiende, devolvé {"tareas":"","novedades":""}.`;

function normalizarLista(valor) {
  let texto = "";
  if (Array.isArray(valor)) {
    texto = valor
      .filter((v) => v != null && String(v).trim())
      .map((v) => "- " + String(v).trim().replace(/^[-•*]\s*/, ""))
      .join("\n");
  } else if (typeof valor === "string") {
    texto = valor.trim();
  }
  return texto.slice(0, 4000);
}

function resolverMime(archivo) {
  const tipo = String(archivo.type || "").toLowerCase();
  if (tipo === "video/webm") return "audio/webm";
  if (MIME_PERMITIDOS.includes(tipo)) return tipo;
  const nombre = String(archivo.name || "").toLowerCase();
  const ext = nombre.includes(".") ? nombre.split(".").pop() : "";
  return MIME_POR_EXTENSION[ext] || "";
}

export async function GET() {
  return NextResponse.json({
    disponible: Boolean(process.env.GEMINI_API_KEY),
    proveedor: "gemini",
    modelo: modeloActual(),
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

    const auth = await autenticarIA(request, ROLES_PERMITIDOS);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const form = await request.formData();
    const archivo = form.get("archivo");

    if (!archivo || typeof archivo === "string" || typeof archivo.arrayBuffer !== "function") {
      return NextResponse.json({ error: "No se recibió ningún audio." }, { status: 400 });
    }

    if (archivo.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "El audio supera los 4 MB. Grabá uno más corto o cargá el parte a mano." },
        { status: 413 }
      );
    }

    const mime = resolverMime(archivo);
    if (!mime) {
      return NextResponse.json(
        { error: "Formato de audio no soportado. Usá la grabación del navegador o un MP3, M4A, OGG o WAV." },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const base64 = buffer.toString("base64");

    const { datos, modelo } = await llamarGemini({
      base64,
      mime,
      prompt: PROMPT_PARTE,
      mensajeVacio: "No se pudo entender el audio. Probá grabarlo de nuevo en un lugar más silencioso.",
    });

    return NextResponse.json({
      ok: true,
      modelo,
      datos: {
        tareas: normalizarLista(datos?.tareas),
        novedades: normalizarLista(datos?.novedades),
      },
    });
  } catch (err) {
    console.error("Error en lectura de parte con IA:", err);
    return NextResponse.json(
      { error: err.message || "No se pudo interpretar el audio." },
      { status: 500 }
    );
  }
}
