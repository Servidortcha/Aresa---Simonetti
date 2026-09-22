import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const COOKIE_MARKER = "-auth-token";

function requiredRoles(pathname) {
  if (/^\/panel(\/|$)/.test(pathname)) return ["admin", "subadmin"];
  if (/^\/rrhh(\/|$)/.test(pathname)) return ["admin"];
  if (/^\/stock-panol(\/|$)/.test(pathname)) return ["admin", "subadmin"];
  if (/^\/taller(\/|$)/.test(pathname)) return ["admin", "subadmin"];
  if (/^\/fabricacion(\/|$)/.test(pathname)) return ["admin", "subadmin"];
  if (/^\/precios(\/|$)/.test(pathname)) return ["admin", "subadmin"];
  if (/^\/organigrama(\/|$)/.test(pathname)) return ["admin", "subadmin"];
  if (/^\/grua(\/|$)/.test(pathname)) return ["admin", "grua", "subadmin"];
  if (/^\/partes-diarios(\/|$)/.test(pathname)) return ["admin", "encargado", "supervision", "subadmin"];
  if (/^\/stock(\/|$)/.test(pathname)) return ["admin", "taller_stock", "subadmin"];
  if (/^\/cajas-acopio(\/|$)/.test(pathname)) return ["admin", "encargado", "subadmin"];
  if (/^\/trabajos(\/|$)/.test(pathname)) return ["admin", "taller_stock", "subadmin"];
  if (/^\/nesting(\/|$)/.test(pathname)) return ["admin", "taller_stock", "subadmin"];
  if (/^\/admin(\/|$)/.test(pathname)) return ["admin"];
  return null;
}

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === "/login" || pathname.startsWith("/login/");
  const isRegistroRoute = pathname === "/registro" || pathname.startsWith("/registro/");
  const isSinAccesoRoute = pathname === "/sin-acceso" || pathname.startsWith("/sin-acceso/");

  let user = null;
  let degraded = false;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    degraded = true;
  }

  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.includes(COOKIE_MARKER) && c.value);

  const authenticated = Boolean(user) || (degraded && hasAuthCookie);

  let rol = null;
  if (!degraded && user) {
    try {
      const { data } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.rol) rol = data.rol;
    } catch {
      rol = "operario";
    }
  } else if (degraded) {
    rol = "operario";
  }

  const home =
    rol === "admin" || rol === "subadmin"
      ? "/panel"
      : rol === "encargado" || rol === "supervision"
      ? "/partes-diarios"
      : rol === "grua"
      ? "/grua"
      : rol
      ? "/ingreso-egreso"
      : "/sin-acceso";

  if (isLoginRoute || isRegistroRoute) {
    if (authenticated) {
      return NextResponse.redirect(new URL(home, request.url));
    }
    return response;
  }

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isSinAccesoRoute) {
    return response;
  }

  if (!rol) {
    return NextResponse.redirect(new URL("/sin-acceso", request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(home, request.url));
  }

  const required = requiredRoles(pathname);
  if (required && !required.includes(rol)) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)"],
};
