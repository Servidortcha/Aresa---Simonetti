import { createClient } from "@supabase/supabase-js";

// Verifica el token del usuario y que su rol esté habilitado para usar IA.
// Devuelve { user } si todo está bien, o { status, error } para responder.
export async function autenticarIA(request, rolesPermitidos) {
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
  if (!perfil || !rolesPermitidos.includes(perfil.rol)) {
    return { status: 403, error: "No tenés permiso para usar la lectura automática." };
  }

  return { user };
}
