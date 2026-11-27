import { NextResponse } from "next/server";
import { autenticarIA } from "../../../../lib/ai/auth";
import { llamarGemini, modeloActual } from "../../../../lib/ai/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROLES_PERMITIDOS = ["admin", "subadmin", "encargado", "supervision"];
const MAX_BYTES = 4 * 1024 * 1024;
const MIME_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_PERSONAS = 120;

const PROMPT_HORAS = `Sos un asistente administrativo de una empresa de montajes industriales de Argentina.
La imagen o PDF adjunto es una planilla de horas de personal. Puede estar escrita a mano o impresa,
y puede tener columnas por día (lunes a domingo) o una sola columna con el total.

Extraé TODAS las personas que aparecen con sus horas totales.

Devolvé EXCLUSIVAMENTE un objeto JSON válido, sin texto adicional ni bloques de código, con esta forma:
{
  "personas": [
    { "nombre": "Apellido, Nombre", "horas": 48.5 }
  ]
}

Reglas:
- "horas" es un número decimal. Interpretá el formato argentino (12,5 = 12.5).
- Si la planilla tiene horas por día, sumalas y devolvé el total de cada persona.
- Si una persona aparece repetida en varias filas o sectores, sumá sus horas en una sola entrada.
- Ignorá encabezados, filas de totales generales, firmas, fechas y aclaraciones.
- No inventes personas: si un nombre no se puede leer, omitilo.
- Si no hay ninguna persona legible, devolvé {"personas": []}.`;

function texto(valor, max = 80) {
  if (typeof valor !== "string") return null;
  const limpio = valor.replace(/\s+/g, " ").trim();
  if (!limpio || limpio.toLowerCase() === "null") return null;
  return limpio.slice(0, max);
}

function normalizarHoras(valor) {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return Math.round(Math.min(744, Math.max(0, valor)) * 100) / 100;
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
    if (Number.isFinite(n)) return Math.round(Math.min(744, Math.max(0, n)) * 100) / 100;
  }
  return null;
}

function normalizarPersonas(datos) {
  const lista = Array.isArray(datos?.personas) ? datos.personas : [];
  const acumulado = new Map();

  for (const item of lista) {
    if (!item || typeof item !== "object") continue;
    const nombre = texto(item.nombre);
    if (!nombre) continue;
    const horas = normalizarHoras(item.horas);
    if (horas == null) continue;
    const clave = nombre.toLowerCase();
    if (acumulado.has(clave)) {
      const previo = acumulado.get(clave);
      previo.horas = Math.round(Math.min(744, previo.horas + horas) * 100) / 100;
    } else {
      acumulado.set(clave, { nombre, horas });
    }
  }

  return Array.from(acumulado.values()).slice(0, MAX_PERSONAS);
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
      return NextResponse.json({ error: "No se recibió ninguna imagen." }, { status: 400 });
    }

    if (archivo.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "La imagen supera los 4 MB. Sacá la foto con menos resolución o cargá las horas a mano." },
        { status: 413 }
      );
    }

    const mime = String(archivo.type || "").toLowerCase().split(";")[0].trim();
    if (!MIME_PERMITIDOS.includes(mime)) {
      return NextResponse.json(
        { error: "Formato no soportado. Subí una foto JPG/PNG/WEBP o un PDF." },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const base64 = buffer.toString("base64");

    const { datos, modelo } = await llamarGemini({
      base64,
      mime,
      prompt: PROMPT_HORAS,
      mensajeVacio: "No se pudo leer la planilla. Probá con una foto más nítida o cargá las horas a mano.",
    });

    const personas = normalizarPersonas(datos);

    return NextResponse.json({
      ok: true,
      modelo,
      mime,
      datos: { personas },
    });
  } catch (err) {
    console.error("Error en lectura de horas con IA:", err);
    return NextResponse.json(
      { error: err.message || "No se pudo leer la planilla de horas." },
      { status: 500 }
    );
  }
}
