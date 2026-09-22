/* Genera la Propuesta Comercial del ERP en PDF */
const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");
const autoTable = require("jspdf-autotable").default || require("jspdf-autotable");

const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

const FONTS = {
  normal: "arial.ttf",
  bold: "arialbd.ttf",
  italic: "ariali.ttf",
};
for (const [style, file] of Object.entries(FONTS)) {
  const buf = fs.readFileSync(path.join("C:\\Windows\\Fonts", file)).toString("base64");
  doc.addFileToVFS(file, buf);
  doc.addFont(file, "Arial", style);
}
doc.setFont("Arial", "normal");

const W = 210;
const M = 18;
const CW = W - M * 2;
let y = 20;

const NARANJA = [244, 121, 30];
const VERDE = [20, 195, 176];
const INK = [28, 31, 28];
const GRIS = [90, 90, 90];
const CELESTE = [46, 111, 158];
const LIMITE = 268;

function nuevaPagina(conHeader = true) {
  doc.addPage();
  y = 20;
  if (conHeader) header();
}

function header() {
  dibujarAresa(M - 6, 4, 9, 7);
  doc.setFontSize(7);
  doc.setFont("Arial", "bold");
  doc.setTextColor(...GRIS);
  doc.text("Aresa", M + 5, 10);
  const h = 6.5;
  const w = h * (868 / 211);
  doc.addImage(logoBase64, "PNG", W - M - w, 4, w, h, undefined, "FAST");
}

function footer() {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont("Arial", "normal");
    doc.setTextColor(...GRIS);
    doc.text("Pagina " + i + " de " + pages, W - M, 292, { align: "right" });
    doc.text("Powered by Aresa", M, 292);
  }
}

function dibujarAresa(x, y0, w, h) {
  const cols = ["#14C3B0", "#2E6F9E", "#8A8A8A", "#2E6F9E"];
  const n = cols.length;
  const bw = w / n;
  for (let i = 0; i < n; i++) {
    doc.setFillColor(cols[i]);
    doc.rect(x + i * bw, y0 + h * 0.15, bw * 0.62, h * 0.7, "F");
  }
}

const logoBase64 = fs.readFileSync(
  path.join(__dirname, "public", "logo-horizontal.png")
).toString("base64");

function titulo(texto, sub) {
  doc.setFont("Arial", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text(texto, M, y);
  y += 8;
  if (sub) {
    doc.setFont("Arial", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...GRIS);
    doc.text(sub, M, y);
    y += 6;
  }
  doc.setDrawColor(...NARANJA);
  doc.setLineWidth(0.8);
  doc.line(M, y, M + CW, y);
  y += 8;
}

function encabezado(texto) {
  if (y > LIMITE) nuevaPagina();
  doc.setFont("Arial", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...VERDE);
  doc.text(texto, M, y);
  y += 7;
}

function parrafo(texto) {
  doc.setFont("Arial", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(texto, CW);
  for (const ln of lines) {
    if (y > LIMITE) nuevaPagina();
    doc.text(ln, M, y);
    y += 5.2;
  }
  y += 2;
}

function item(texto) {
  doc.setFont("Arial", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(texto, CW - 6);
  let ly = y;
  doc.setFontSize(11);
  doc.setTextColor(...NARANJA);
  doc.text("-", M, y);
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  for (const ln of lines) {
    if (y > LIMITE) nuevaPagina();
    doc.text(ln, M + 6, y);
    y += 5.2;
  }
  if (lines.length === 0) y += 5.2;
  y += 0.6;
}

function separador() {
  if (y > LIMITE - 10) nuevaPagina();
  y += 3;
  doc.setDrawColor(...GRIS);
  doc.setLineWidth(0.2);
  doc.line(M, y, M + CW, y);
  y += 6;
}

/* ============ PORTADA ============ */
const logoH = 24;
const logoW = logoH * (868 / 211);
doc.addImage(logoBase64, "PNG", (W - logoW) / 2, 70, logoW, logoH, undefined, "FAST");

doc.setFont("Arial", "bold");
doc.setFontSize(30);
doc.setTextColor(...INK);
doc.text("PROPUESTA", W / 2, 130, { align: "center" });
doc.text("COMERCIAL", W / 2, 141, { align: "center" });

doc.setFont("Arial", "bold");
doc.setFontSize(15);
doc.setTextColor(...NARANJA);
doc.text("ERP de Gestión Integral", W / 2, 160, { align: "center" });

doc.setFont("Arial", "normal");
doc.setFontSize(12);
doc.setTextColor(...GRIS);
doc.text("Simonetti Montajes Industriales", W / 2, 170, { align: "center" });

doc.setDrawColor(...NARANJA);
doc.setLineWidth(1);
doc.line(W / 2 - 40, 176, W / 2 + 40, 176);

doc.setFontSize(10);
doc.setTextColor(...INK);
doc.text("Preparada por Aresa - Desarrollo de software", W / 2, 200, { align: "center" });
doc.text("Agosto 2026", W / 2, 208, { align: "center" });

dibujarAresa(W / 2 - 12, 245, 24, 9);

footer();

/* ============ PAGINA 2: Alcance ============ */
nuevaPagina();
titulo("1. Alcance del sistema", "El sistema ya se encuentra desarrollado y en producción, y cubre los siguientes módulos:");

autoTable(doc, {
  startY: y,
  margin: { left: M, right: M },
  styles: { font: "Arial", fontSize: 9.5, cellPadding: 2.5, textColor: INK, lineColor: [210, 210, 210], lineWidth: 0.2 },
  headStyles: { font: "Arial", fontStyle: "bold", fillColor: CELESTE, textColor: [255, 255, 255] },
  body: [
    ["Stock e inventario", "Insumos, movimientos de entrada y salida, control de existencias y trazabilidad por usuario"],
    ["Producción", "Trabajos, partes diarios, registro de grúa, fabricación con estimados y edición"],
    ["Taller", "Órdenes de trabajo, ítems internos y externos (con valor en pesos), tarjetas imprimibles"],
    ["Herramientas de taller", "Registro, préstamos y devolución de herramientas"],
    ["Organigrama", "Estructura de la empresa y su personal"],
    ["Recursos Humanos", "Empleados, conceptos y liquidaciones de sueldo"],
    ["Panel de administración", "Métricas y control central de toda la operación"],
    ["Roles y permisos", "Admin, taller/stock, encargado y operario con accesos diferenciados"],
    ["Exportaciones", "Reportes a Excel e impresiones (tarjetas, partes diarios)"],
  ],
});
y = doc.lastAutoTable.finalY + 6;

parrafo("Incluye: manual de uso completo en PDF y capacitación al personal.");
separador();

encabezado("2. Infraestructura (hosting y datos)");
autoTable(doc, {
  startY: y,
  margin: { left: M, right: M },
  styles: { font: "Arial", fontSize: 9.5, cellPadding: 2.5, textColor: INK, lineColor: [210, 210, 210], lineWidth: 0.2 },
  headStyles: { font: "Arial", fontStyle: "bold", fillColor: CELESTE, textColor: [255, 255, 255] },
  footStyles: { font: "Arial", fontStyle: "bold", fillColor: [240, 240, 240], textColor: INK },
  foot: [["Total infraestructura", "", "US$ 45 / mes"]],
  body: [
    ["Alojamiento web con SSL y CDN", "Vercel (plan Pro)", "US$ 20 / mes"],
    ["Base de datos + autenticación + backups diarios", "Supabase (plan Pro)", "US$ 25 / mes"],
    ["Dominio propio (opcional, recomendado)", "Registrador", "US$ 12 / año"],
  ],
});
y = doc.lastAutoTable.finalY + 4;
parrafo("La infraestructura está incluida dentro de la mensualidad del punto 3; no se factura por separado.");
separador();

encabezado("3. Condiciones comerciales");
parrafo("Opción A - Desarrollo + mensualidad (recomendada)");
autoTable(doc, {
  startY: y,
  margin: { left: M, right: M },
  styles: { font: "Arial", fontSize: 9.5, cellPadding: 2.5, textColor: INK, lineColor: [210, 210, 210], lineWidth: 0.2 },
  headStyles: { font: "Arial", fontStyle: "bold", fillColor: NARANJA, textColor: [255, 255, 255] },
  body: [
    ["Desarrollo e implementación (única vez)", "US$ 8.000"],
    ["Puesta en marcha, migración de datos y capacitación", "Incluido"],
    ["Mensualidad (infra + mantenimiento + soporte)", "US$ 200 / mes"],
  ],
  columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
});
y = doc.lastAutoTable.finalY + 4;

parrafo("Forma de pago del desarrollo: 50% al inicio de los trabajos, 50% contra entrega.");
item("La mensualidad incluye: Infraestructura completa (Vercel Pro + Supabase Pro + dominio si aplica).");
item("Soporte por correo y WhatsApp con respuesta en 24 h hábiles.");
item("Corrección de errores y respaldo mensual de los datos.");
item("Ajustes menores y mejoras de bajo alcance.");
separador();

parrafo("Opción B - Solo mensualidad (sin costo de desarrollo)");
autoTable(doc, {
  startY: y,
  margin: { left: M, right: M },
  styles: { font: "Arial", fontSize: 9.5, cellPadding: 2.5, textColor: INK, lineColor: [210, 210, 210], lineWidth: 0.2 },
  headStyles: { font: "Arial", fontStyle: "bold", fillColor: NARANJA, textColor: [255, 255, 255] },
  body: [
    ["Uso del sistema (mínimo 12 meses)", "US$ 500 / mes"],
    ["Infraestructura, soporte y mantenimiento", "Incluido"],
  ],
  columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
});
y = doc.lastAutoTable.finalY + 6;
separador();

encabezado("4. Garantías y condiciones");
item("30 días de garantía de corrección de errores a partir de la entrega.");
item("Respuesta de soporte en 24 h hábiles dentro del horario laboral.");
item("Si se factura en pesos, la mensualidad se ajusta por IPC mensual.");
item("El contrato de mantenimiento se renueva mensualmente y puede darse de baja con 30 días de aviso.");
separador();

encabezado("5. Lo que NO incluye");
item("Hardware y conectividad del cliente.");
item("Cambios funcionales mayores no contemplados en el alcance (se cotizan por módulo u hora).");
item("Integraciones con sistemas contables o administrativos de terceros (cotizable por separado).");
item("Carga inicial de datos históricos (incluida solo una vez en la migración de la Opción A).");
separador();

encabezado("6. Aceptación");
y += 2;
parrafo("Firma y aclaración del cliente: ____________________________");
parrafo("Fecha: ____________________________");
y += 2;
doc.setFont("Arial", "bold");
doc.setFontSize(10.5);
doc.setTextColor(...GRIS);
doc.text("Aresa - Desarrollo de software", M, y);

footer();

doc.save("Propuesta Comercial - ERP Simonetti.pdf");
console.log("PDF generado correctamente.");
