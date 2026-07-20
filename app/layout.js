import "./globals.css";

export const metadata = {
  title: "Inventario · Simonetti Montajes Industriales",
  description: "Control de inventario de insumos — Simonetti Montajes Industriales",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Almacén Simonetti",
  },
};

export const viewport = {
  themeColor: "#4A4B4D",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
