import { NextResponse } from "next/server";
import { autenticarIA } from "../../../../lib/ai/auth";
import { llamarGemini, modeloActual } from "../../../../lib/ai/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROLES_PERMITIDOS = ["admin", "subadmin", "encargado", "supervision"];
const MAX_BYTES = 4 * 1024 * 1024;
const MIME_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_PERSONAS = 150;
const MAX_COLUMNAS = 15;

const PROMPT_HORAS = `Sos un asistente administrativo de una empresa de montajes industriales de Argentina.
La imagen o PDF adjunto es una tabla de horas de personal rendida por quincena.
Suele tener una primera columna "Nombre", una columna por frente u obra (Casa Central, Bunge Tancacha, Frías, Pico, Villegas, etc.)
y una última columna de total ("Total computable").

Extraé la tabla completa.

Devolvé EXCLUSIVAMENTE un objeto JSON válido, sin texto adicional ni bloques de código, con esta forma:
{
  "periodo": "texto del período tal como figura en el título, o null",
  "columnas": ["nombre de cada columna de horas, en orden, SIN la columna de total"],
  "personas": [
    { "nombre": "Apellido Nombre", "horas": ["11:50", "0:00", "109:47"] }
  ]
}

Reglas:
- "columnas" son solo las columnas de horas por frente/obra. NO incluyas la columna "Nombre" ni la de total.
- "horas" debe tener exactamente la misma cantidad de elementos que "columnas", en el mismo orden.
- Las horas están en formato H:MM o HH:MM (11:50 = 11 horas 50 minutos). Copialas tal cual figuran.
- NO incluyas la fila "TOTAL" general ni filas de subtotales.
- Ignorá encabezados repetidos, logos, notas, fechas sueltas y firmas.
- Si una celda está vacía, usá "0:00".
- No inventes datos: si un nombre no se puede leer, omití esa fila.
- Si no podés leer la tabla, devolvé {"periodo": null, "columnas": [], "personas": []}.`;

function texto(valor, max = 80) {
  if (typeof valor !== "string") return null;
  const limpio = valor.replace(/\s+/g, " ").trim();
  if (!limpio || limpio.toLowerCase() === "null") return null;
  return limpio.slice(0, max);
}

// Convierte "11:50", "121:37", "11h50" o "11,5" a minutos.
function aMinutos(valor) {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return Math.max(0, Math.round(valor * 60));
  }
  const s = String(valor ?? "").trim();
  if (!s) return 0;

  const hm = s.match(/^(\d{1,4})\s*[:hH]\s*(\d{1,2})$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);

  const dec = s.replace(",", ".").match(/^(\d{1,4}(?:\.\d{1,2})?)$/);
  if (dec) return Math.max(0, Math.round(Number(dec[1]) * 60));

  return 0;
}

function normalizar(datos) {
  const columnas = (Array.isArray(datos?.columnas) ? datos.columnas : [])
    .map((c) => texto(c, 60))
    .filter(Boolean)
    .filter((c) => !/^(total|nombre|apellido|persona|legajo)/i.test(c))
    .slice(0, MAX_COLUMNAS);

  const personas = (Array.isArray(datos?.personas) ? datos.personas : [])
    .map((p) => {
      const nombre = texto(p?.nombre, 80);
      if (!nombre) return null;
      const horas = Array.isArray(p?.horas) ? p.horas : [];
      const minutos = columnas.map((_, i) => aMinutos(horas[i]));
      return { nombre, minutos };
    })
    .filter(Boolean)
    .slice(0, MAX_PERSONAS);

  return {
    periodo: texto(datos?.periodo, 60),
    columnas,
    personas,
  };
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

    return NextResponse.json({
      ok: true,
      modelo,
      mime,
      datos: normalizar(datos),
    });
  } catch (err) {
    console.error("Error en lectura de horas con IA:", err);
    return NextResponse.json(
      { error: err.message || "No se pudo leer la planilla de horas." },
      { status: 500 }
    );
  }
}
