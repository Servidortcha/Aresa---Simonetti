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
  "application/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/x-mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/vnd.wave",
  "audio/aac",
  "audio/aacp",
  "audio/flac",
  "audio/x-flac",
  "audio/3gpp",
  "audio/3gpp2",
  "audio/amr",
  "audio/opus",
  "audio/x-caf",
  "audio/aiff",
  "audio/x-aiff",
  "video/webm",
  "video/mp4",
  "video/3gpp",
];

const MIME_POR_EXTENSION = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  flac: "audio/flac",
  "3gp": "audio/3gpp",
  "3gpp": "audio/3gpp",
  amr: "audio/amr",
  caf: "audio/x-caf",
  aiff: "audio/aiff",
  aif: "audio/aiff",
};

// Los grabadores de Android/iOS a veces mandan el archivo sin tipo MIME o con
// "application/octet-stream". Para no rechazar un audio válido, miramos los
// primeros bytes del archivo (magic numbers) y deducimos el formato real.
function detectarMime(buffer) {
  if (!buffer || buffer.length < 12) return "";
  const ascii = (desde, hasta) => buffer.toString("latin1", desde, hasta);

  if (ascii(0, 4) === "OggS") return "audio/ogg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "audio/wav";
  if (ascii(0, 4) === "fLaC") return "audio/flac";
  if (ascii(0, 3) === "ID3") return "audio/mpeg";
  if (ascii(0, 4) === "caff") return "audio/x-caf";
  if (ascii(0, 4) === "FORM" && /AIFF|AIFC/.test(ascii(8, 12))) return "audio/aiff";
  if (ascii(0, 5) === "#!AMR") return "audio/amr";
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "audio/webm";
  }
  if (ascii(4, 8) === "ftyp") {
    const marca = ascii(8, 12);
    if (/3gp/i.test(marca)) return "audio/3gpp";
    return "audio/mp4";
  }
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return "audio/mpeg";
  return "";
}

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

function resolverMime(archivo, buffer) {
  const tipo = String(archivo.type || "").toLowerCase().split(";")[0].trim();

  // Normalizamos los tipos "de video" que en realidad traen solo audio.
  if (tipo === "video/webm") return "audio/webm";
  if (tipo === "video/mp4") return "audio/mp4";
  if (tipo === "video/3gpp") return "audio/3gpp";
  if (MIME_PERMITIDOS.includes(tipo)) return tipo;

  const nombre = String(archivo.name || "").toLowerCase();
  const ext = nombre.includes(".") ? nombre.split(".").pop() : "";
  if (MIME_POR_EXTENSION[ext]) return MIME_POR_EXTENSION[ext];

  return detectarMime(buffer);
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

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const mime = resolverMime(archivo, buffer);
    if (!mime) {
      console.warn("Audio no reconocido:", archivo.name, archivo.type, buffer.length);
      return NextResponse.json(
        {
          error:
            "No se reconoció el formato del audio. Probá grabando con el botón «Grabar» o convertí el archivo a MP3, M4A, OGG o WAV.",
        },
        { status: 415 }
      );
    }

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
      mime,
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
