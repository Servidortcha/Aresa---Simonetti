"use client";

import { createContext, useContext } from "react";

export const AuthContext = createContext({ session: null, rol: null });

export function useAuth() {
  return useContext(AuthContext);
}
