import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const COOKIE_MARKER = "-auth-token";

function requiredRole(pathname) {
  if (/^\/rrhh(\/|$)/.test(pathname)) return "admin";
  if (/^\/stock-panol(\/|$)/.test(pathname)) return "admin";
  if (/^\/taller(\/|$)/.test(pathname)) return "admin";
  if (/^\/stock(\/|$)/.test(pathname)) return "taller_stock";
  if (/^\/trabajos(\/|$)/.test(pathname)) return "taller_stock";
  if (/^\/nesting(\/|$)/.test(pathname)) return "taller_stock";
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

  if (isLoginRoute) {
    if (authenticated) {
      return NextResponse.redirect(new URL("/ingreso-egreso", request.url));
    }
    return response;
  }

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!degraded && user) {
    let rol = "operario";
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

    const required = requiredRole(pathname);
    if (required) {
      const allowed =
        required === "admin" ? rol === "admin" : ["admin", "taller_stock"].includes(rol);
      if (!allowed) {
        return NextResponse.redirect(new URL("/ingreso-egreso", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)"],
};
