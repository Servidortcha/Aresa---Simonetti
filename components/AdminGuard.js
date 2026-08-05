"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthContext";

export default function AdminGuard({ children }) {
  const { rol } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (rol && rol !== "admin") {
      router.replace("/ingreso-egreso");
    }
  }, [rol, router]);

  if (rol && rol !== "admin") {
    return null;
  }

  return <>{children}</>;
}
