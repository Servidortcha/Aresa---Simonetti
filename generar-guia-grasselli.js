/* Genera la Guia de uso (grasselli@simonetti.local) en PDF, con usuario y clave visibles */
const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");
const autoTable = require("jspdf-autotable").default || require("jspdf-autotable");

const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

/* Fuente Arial embebida del sistema */
const FONTS = {
  normal: "arial.ttf",
  bold: "arialbd.ttf",
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

function titulo(texto, tamaño = 22) {
  doc.setFont("Arial", "bold");
  doc.setFontSize(tamaño);
  doc.setTextColor(...VERDE);
  doc.text(texto, M, y);
  y += tamaño * 0.45;
}

function subtitulo(texto) {
  if (y > LIMITE - 10) nuevaPagina();
  doc.setFont("Arial", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NARANJA);
  doc.text(texto, M, y);
  y += 6.5;
}

function seccion(texto) {
  if (y > LIMITE - 8) nuevaPagina();
  doc.setFont("Arial", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(texto, M, y);
  y += 5.5;
}

function parrafo(texto, tamaño = 9.5, sangria = 0) {
  doc.setFont("Arial", "normal");
  doc.setFontSize(tamaño);
  doc.setTextColor(...INK);
  const lineas = doc.splitTextToSize(texto, CW - sangria);
  for (const l of lineas) {
    if (y > LIMITE) nuevaPagina();
    doc.text(l, M + sangria, y);
    y += tamaño * 0.5;
  }
  y += 1.5;
}

function viñeta(texto) {
  parrafo("•  " + texto);
}

function espaciado(mm = 3) {
  y += mm;
}

function tabla(head, body) {
  if (y > LIMITE - 30) nuevaPagina();
  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { font: "Arial", fontSize: 8, cellPadding: 2, textColor: INK, lineColor: [210, 205, 190], lineWidth: 0.2 },
    headStyles: { font: "Arial", fontStyle: "bold", fillColor: NARANJA, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [247, 244, 236] },
  });
  y = doc.lastAutoTable.finalY + 6;
}

function dibujarAresa(x, yTop, ancho, altura) {
  const bw = ancho / 4;
  const bars = [
    { h: 0.62, c: VERDE },
    { h: 0.95, c: CELESTE },
    { h: 0.45, c: [143, 160, 172] },
    { h: 0.85, c: CELESTE },
  ];
  doc.setDrawColor(255, 255, 255);
  bars.forEach((b, i) => {
    const bh = altura * b.h;
    doc.setFillColor(...b.c);
    doc.rect(x + i * bw, yTop + (altura - bh), bw * 0.72, bh, "F");
  });
}

const logoBase64 = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "public", "logo-horizontal.png")).toString("base64");

/* ===================== PORTADA ===================== */
doc.setFillColor(...VERDE);
doc.rect(0, 0, W, 10, "F");
doc.setFillColor(...NARANJA);
doc.rect(0, 10, W, 2.5, "F");

const logoAncho = 100;
const logoAlto = logoAncho * (211 / 868);
doc.addImage(logoBase64, "PNG", W / 2 - logoAncho / 2, 50, logoAncho, logoAlto, undefined, "FAST");

y = 95;
doc.setFont("Arial", "bold");
doc.setFontSize(28);
doc.setTextColor(...INK);
doc.text("GUIA DE USO DE LA APLICACION", W / 2, y, { align: "center" });
y += 11;
doc.setFontSize(15);
doc.setTextColor(...NARANJA);
doc.text("ERP Aresa - Simonetti Montajes Industriales", W / 2, y, { align: "center" });

doc.setFillColor(...CELESTE);
doc.roundedRect(M, 136, CW, 44, 2, 2, "F");
doc.setFont("Arial", "bold");
doc.setFontSize(10);
doc.setTextColor(255, 255, 255);
doc.text("TUS DATOS DE ACCESO", M + 6, 146);
doc.setFont("Arial", "normal");
doc.setFontSize(9);
doc.text("Correo: grasselli@simonetti.local", M + 6, 154);
doc.text("Contrasena: grassellisimonetti", M + 6, 159.5);
doc.text("Pantalla inicial: Partes diarios (frente Frias)", M + 6, 165);
doc.text("Modulos: Partes diarios e Inglete", M + 6, 170.5);

const aresaW = 16, aresaH = 16;
dibujarAresa(W / 2 - aresaW / 2, 262, aresaW, aresaH);
doc.setFontSize(9);
doc.setTextColor(...GRIS);
doc.text("Powered by Aresa", W / 2, 281, { align: "center" });

footer();

/* ===================== 1. TU ACCESO ===================== */
nuevaPagina();
titulo("1. Tu acceso al sistema");
espaciado(2);
parrafo("El ERP Aresa es el sistema de gestion de Simonetti Montajes Industriales. Con tu usuario podes cargar y consultar los partes diarios del frente Frias y usar la calculadora de ingletes del taller.");
parrafo("Para ingresar: abri la aplicacion en el navegador (Google Chrome recomendado), escribi tu correo grasselli@simonetti.local y tu contrasena grassellisimonetti, y toca \"Ingresar\".");
parrafo("Al entrar, el sistema te lleva directamente al modulo de Partes diarios, que es tu pantalla principal.");
parrafo("El menu (boton en la barra superior izquierda) muestra solamente los modulos que tu rol puede usar:");
tabla(
  ["Modulo", "Que hace"],
  [
    ["Partes diarios", "Cargar, editar y consultar los partes de tu frente de obra"],
    ["Inglete", "Calculadora de inglete para tubos (plantilla de corte)"],
  ]
);
parrafo("Para salir de la aplicacion usa el boton de cerrar sesion (icono de salida) en la barra superior.");

/* ===================== 2. PARTES DIARIOS ===================== */
nuevaPagina();
titulo("2. Partes diarios");
espaciado(2);
parrafo("El parte diario es el registro de lo que se hizo cada dia en el frente: tareas realizadas, novedades y, si corresponde, fotos o archivos. Es lo que la direccion usa para seguir el avance de la obra.");
parrafo("Tu frente asignado es Frias. Solo ves los partes de ese frente y no podes ver los de otros frentes.");

subtitulo("2.1 Cargar un parte diario nuevo");
viñeta("Toca el boton \"Nuevo parte\".");
viñeta("Elegi el frente de trabajo y la fecha del parte.");
viñeta("En el campo \"Tareas realizadas\" detalla que se hizo en la jornada (por ejemplo: \"Colocacion de 12 soportes, armado de estructura principal\").");
viñeta("En \"Novedades\" anota incidentes, faltas de material, clima, pendientes u observaciones.");
viñeta("Si queres, adjunta fotos o archivos (acepta imagenes, PDF, DXF y DWG).");
viñeta("Toca \"Guardar parte\". Aparece un mensaje verde de confirmacion.");

subtitulo("2.2 Imprimir un parte");
parrafo("Cada parte tiene un boton de impresora. Al tocarlo se abre la ficha imprimible con una casilla \"Incluir imagenes\": tildada muestra las fotos en miniatura, destildada las oculta.");

subtitulo("2.3 Editar y eliminar");
parrafo("Un parte se puede editar o eliminar solo por la persona que lo creo o por un administrador. Si no sos el autor, lo ves pero no podes modificarlo.");
viñeta("Editar: toca el lapiz del parte y cambia lo que necesites.");
viñeta("Eliminar: toca la papelera y confirma. El parte se borra definitivamente.");

subtitulo("2.4 Consejos para un buen parte");
viñeta("Cargalo el mismo dia de trabajo, mientras la informacion esta fresca.");
viñeta("Se concreto en las tareas: cuantos metros, cuantas piezas, que sectores.");
viñeta("Foto del avance: una imagen ayuda mas que un texto largo.");
viñeta("Si algo se rompio o falta material, ponelo en novedades para que lo vea la direccion.");

/* ===================== 3. INGLETE ===================== */
nuevaPagina();
titulo("3. Calculadora de inglete");
espaciado(2);
parrafo("La calculadora de inglete calcula la linea de corte para que un tubo encastre contra otro en el angulo que necesites. Es una herramienta de taller: no guarda datos, solo calcula.");
subtitulo("Como usarla");
viñeta("Carga el diametro del tubo principal (D1) en milimetros.");
viñeta("Carga el diametro del tubo a cortar (D2).");
viñeta("Opcional: carga el espesor de pared para tener el diametro interior a mano.");
viñeta("Ajusta el angulo de interseccion con la barra deslizante. 90 grados es la union en T (perpendicular).");
viñeta("Los resultados se actualizan al instante: circunferencia a desarrollar, altura minima y maxima, y largo minimo del tubo.");
viñeta("Usa la tabla de medidas (una fila cada 15 grados) para marcar directamente sobre el cano.");
viñeta("\"Exportar tabla (.csv)\" descarga las medidas.");
viñeta("\"Imprimir plantilla\" imprime la plantilla a escala real 1:1, dividida en tiras con una regla de control.");
parrafo("El sistema avisa si el tubo a cortar es igual o mas grueso que el principal, o si la curva no tiene solucion con los datos ingresados.");

/* ===================== 4. CONSEJOS ===================== */
nuevaPagina();
titulo("4. Consejos generales");
espaciado(2);
viñeta("Guarda los datos siempre con los botones de confirmacion; la app avisa con un mensaje verde cuando algo se guardo.");
viñeta("Si aparece un mensaje en rojo, indica un error: lee el texto para saber que corregir.");
viñeta("En los campos numericos usa punto para decimales (ej. 1.5).");
viñeta("En el telefono las listas se ven como tarjetas; en la computadora como tablas.");
viñeta("Si olvidaste tu contrasena, pedile al administrador que la restablezca.");

subtitulo("Resumen rapido");
tabla(
  ["Accion", "Podes"],
  [
    ["Cargar un parte diario de tu frente", "Si"],
    ["Editar o eliminar un parte", "Solo los que cargaste vos"],
    ["Ver partes de otros frentes", "No"],
    ["Usar la calculadora de inglete", "Si"],
    ["Ver stock, trabajos, taller o fabricacion", "No"],
    ["Exportar o imprimir algo", "Partes se imprimen con el navegador; Inglete imprime plantilla 1:1"],
  ]
);

footer();
doc.save("Guia de uso - grasselli@simonetti.local.pdf");
console.log("PDF generado correctamente.");
