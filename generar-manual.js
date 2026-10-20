/* Genera el Manual de Uso del ERP Aresa-Simonetti en PDF */
const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");
const autoTable = require("jspdf-autotable").default || require("jspdf-autotable");

const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

/* Fuente Arial embebida del sistema: soporta acentos y simbolos */
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

/* Logo de Simonetti (PNG) en base64 */
const logoBase64 = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "public", "logo-horizontal.png")).toString("base64");

/* ===================== PORTADA ===================== */
doc.setFillColor(...VERDE);
doc.rect(0, 0, W, 10, "F");
doc.setFillColor(...NARANJA);
doc.rect(0, 10, W, 2.5, "F");

const logoAncho = 110;
const logoAlto = logoAncho * (211 / 868);
doc.addImage(logoBase64, "PNG", W / 2 - logoAncho / 2, 52, logoAncho, logoAlto, undefined, "FAST");

y = 95;
doc.setFont("Arial", "bold");
doc.setFontSize(30);
doc.setTextColor(...INK);
doc.text("MANUAL DE USO", W / 2, y, { align: "center" });
y += 11;
doc.setFontSize(16);
doc.setTextColor(...NARANJA);
doc.text("ERP Aresa - Simonetti Montajes Industriales", W / 2, y, { align: "center" });
y += 11;
doc.setFontSize(12);
doc.setTextColor(...GRIS);
doc.text("Sistema integral de gestion: stock, produccion, taller,", W / 2, y, { align: "center" });
y += 7;
doc.text("recursos humanos y herramientas de taller", W / 2, y, { align: "center" });

doc.setFillColor(...CELESTE);
doc.roundedRect(M, 140, CW, 34, 2, 2, "F");
doc.setFont("Arial", "bold");
doc.setFontSize(10);
doc.setTextColor(255, 255, 255);
doc.text("CONTENIDO", M + 6, 150);
doc.setFont("Arial", "normal");
doc.setFontSize(9);
doc.text("Acceso y roles / Stock y movimientos / Produccion (Trabajos, Taller, Fabricacion,", M + 6, 158);
doc.text("Partes diarios, Grua) / Herramientas (Nesting, Inglete) / Organigrama / RRHH /", M + 6, 163.5);
doc.text("Exportaciones e impresiones", M + 6, 169);

const aresaW = 16, aresaH = 16;
dibujarAresa(W / 2 - aresaW / 2, 262, aresaW, aresaH);
doc.setFontSize(9);
doc.setTextColor(...GRIS);
doc.text("Powered by Aresa", W / 2, 281, { align: "center" });

footer();

/* ===================== INTRODUCCION ===================== */
nuevaPagina();
titulo("1. Introduccion");
espaciado(2);
parrafo("El ERP Aresa es el sistema de gestion de Simonetti Montajes Industriales. Permite llevar el control del stock de insumos, los trabajos de produccion (corte laser, torneria, taller y fabricacion de obras), los partes diarios de cada frente de obra, el uso de grua, el organigrama de la empresa y la liquidacion de sueldos del personal.");
parrafo("Toda la informacion se guarda automaticamente en la nube (Supabase). Cada usuario ingresa con su correo y contrasena, y ve unicamente los modulos que le corresponden segun su rol.");

subtitulo("1.1 Como acceder");
parrafo("1.  Abri la aplicacion en el navegador (Google Chrome recomendado).");
parrafo("2.  Ingresa tu correo y contrasena en la pantalla de inicio de sesion.");
parrafo("3.  Toca el boton \"Ingresar\".");
parrafo("4.  Al entrar se abre automaticamente la pantalla principal de tu perfil (Panel si sos administrador, Partes diarios si sos encargado, Grua si sos operador de grua, o Ingreso/Egreso en el resto de los casos).");
parrafo("Si el correo o la contrasena son incorrectos, aparece el mensaje \"Correo o contrasena incorrectos\".");
parrafo("Para salir de la aplicacion usa el boton de cerrar sesion (icono de salida) en la barra superior.");

subtitulo("1.2 La barra superior y el menu");
parrafo("La barra superior esta siempre visible. A la izquierda tiene el boton de menu y el logo de Aresa; a la derecha, el boton para cerrar sesion.");
parrafo("Al tocar el boton de menu se despliega el menu lateral con todos los modulos agrupados por categoria: General, Movimiento, Produccion, Herramientas, Organizacion y RRHH. Cada grupo se abre y se cierra tocando su nombre. Solo se muestran los modulos que el rol del usuario puede usar.");

/* ===================== ROLES ===================== */
subtitulo("1.3 Roles de usuario");
parrafo("El sistema define cinco roles. Cada uno ve y puede operar distintos modulos:");
tabla(
  ["Rol", "Quien es", "Modulos principales"],
  [
    ["admin", "Direccion y administracion", "Todos los modulos"],
    ["taller_stock", "Responsable de taller / stock", "Ingreso/Egreso (egresos), Stock (lectura), Trabajos, Nesting, Inglete"],
    ["encargado", "Encargado de frente de obra", "Partes diarios (su frente), Inglete"],
    ["operario", "Operario", "Ingreso/Egreso (egresos), Inglete"],
    ["grua", "Operador de grua", "Grua"],
  ]
);

subtitulo("1.4 Recomendaciones generales");
viñeta("Guarda los datos siempre con los botones de confirmacion; la app avisa con un mensaje verde cuando algo se guardo.");
viñeta("Si aparece un mensaje en rojo, indica un error: lee el texto para saber que corregir.");
viñeta("En los campos numericos usa punto para decimales (ej. 1.5).");
viñeta("Los movimientos de stock no se pueden borrar: si te equivocas, registra un movimiento inverso.");
viñeta("Las listas se pueden ver en tarjetas (en telefonos) o en tablas (en computadora) automaticamente.");

/* ===================== STOCK Y MOVIMIENTO ===================== */
nuevaPagina();
titulo("2. Movimiento de stock");
espaciado(2);
parrafo("El stock se organiza en dos depositos: el Principal y el Panol. Los insumos se gestionan en los modulos Stock (Principal) y Stock Panol, y las entradas y salidas de material se registran en Ingreso/Egreso.");

subtitulo("2.1 Ingreso / Egreso");
parrafo("Sirve para registrar cada entrada (compra o devolucion) y cada salida (consumo o retiro) de un insumo. Al registrar, el movimiento queda en el historial y el stock del insumo se actualiza en el mismo momento.");
seccion("Registrar una entrada");
viñeta("Elegi el deposito (solo administradores): Principal o Panol.");
viñeta("Selecciona el insumo del desplegable.");
viñeta("Elegi el tipo \"Ingreso\".");
viñeta("Carga la cantidad.");
viñeta("Opcionalmente, anota una nota (ej. \"Compra mensual\").");
viñeta("Toca el boton para registrar. Aparece un mensaje verde de confirmacion.");
seccion("Registrar una salida (egreso)");
viñeta("Elegi el deposito y el insumo (los operarios y personal de taller ven solo el Principal).");
viñeta("Elegi el tipo \"Egreso\".");
viñeta("Carga la cantidad. No puede superar el stock disponible.");
viñeta("Si la salida se usa en una obra abierta, selecciona la fabricacion en el desplegable. Si no, escribi en que producto se uso.");
viñeta("Indica quien retira el insumo (nombre y apellido, obligatorio).");
viñeta("Confirma el registro.");
parrafo("Si la cantidad supera el stock, el sistema avisa y no deja guardar: \"No hay suficiente stock: quedan X unidad de insumo\".");

subtitulo("2.2 Stock (deposito Principal)");
parrafo("Es el catalogo de insumos del deposito Principal. Permite crear, editar y archivar insumos, controlar el stock minimo y exportar el listado.");
seccion("Acciones disponibles (administradores)");
viñeta("Nuevo insumo: toca el boton \"Nuevo insumo\" y completa nombre, categoria, unidad, stock y stock minimo.");
viñeta("Editar: toca el lapiz de la fila, modifica lo que necesites y confirma.");
viñeta("Archivar: toca la papelera. El insumo deja de mostrarse, pero se conserva su historial. Se puede reactivar desde la vista \"Ver archivados\".");
viñeta("Buscar: escribi en el buscador para filtrar por nombre o categoria.");
viñeta("Filtrar por categoria: usa el desplegable de categorias.");
viñeta("Ver archivados: activa la casilla para ver los insumos archivados.");
viñeta("Exportar a Excel: descarga el listado actual en formato .xlsx.");
seccion("Niveles de stock");
parrafo("Cada insumo muestra una barra de nivel con su color: rojo si esta por debajo del minimo (aparece una alerta), naranja si esta al 60% o menos, y verde si esta en nivel sano. Arriba de la lista se indica cuantos insumos estan por debajo del minimo.");
seccion("Campos del insumo");
parrafo("Nombre (obligatorio) / Categoria (obligatoria: Quimicos, Empaques, Metales, Textiles, Seguridad, Insumos para Fabricacion) / Unidad (kg, L, unid, m) / Stock / Stock minimo.");
parrafo("El personal con rol taller_stock ve este modulo en modo solo lectura.");

subtitulo("2.3 Stock Panol");
parrafo("Es identico al modulo Stock pero para el deposito Panol. Solo lo usa el administrador. Todos los insumos creados aqui quedan en el deposito \"Panol\".");

subtitulo("2.4 Historial de movimientos");
parrafo("Muestra todos los movimientos de stock registrados (entradas y salidas), con fecha, insumo, tipo, cantidad, stock resultante, uso, nota y usuario. Es solo de lectura. Incluye boton para exportar a Excel.");

/* ===================== PRODUCCION ===================== */
nuevaPagina();
titulo("3. Produccion");
espaciado(2);
parrafo("El area de produccion integra los modulos Trabajos (corte laser y torneria), Taller, Fabricacion (obras), Partes diarios y Grua.");

subtitulo("3.1 Trabajos (Corte Laser / Torneria)");
parrafo("Registra los trabajos de corte laser y torneria. Estos trabajos pueden anexarse despues a los registros del modulo Taller.");
seccion("Registrar un trabajo");
viñeta("Elegi el tipo: Corte Laser o Torneria.");
viñeta("Completa cliente, descripcion y cantidad.");
viñeta("Duracion: en minutos para corte laser, en horas para torneria.");
viñeta("Para corte laser, carga largo y ancho en milimetros. El sistema calcula automaticamente el area total (m2).");
viñeta("Indica el material usado.");
viñeta("Para corte laser, adjunta el archivo DXF del trabajo (opcional).");
viñeta("Deja marcada la casilla \"Confirmado\" si el trabajo ya esta definido. Si la desmarcas, queda como \"Pendiente\".");
viñeta("Toca \"Registrar trabajo\".");
seccion("Editar / completar un trabajo");
parrafo("Toca el boton de lapiz de la fila. Podes modificar los datos y reemplazar el archivo DXF. Al guardar, el trabajo queda actualizado. El tipo de trabajo no se puede cambiar al editar.");
seccion("Filtrar y exportar");
viñeta("Filtra por estado: Todos, Pendientes o Confirmados.");
viñeta("Filtra por tipo: Todos, Corte Laser o Torneria.");
viñeta("\"Exportar a Excel\" descarga los trabajos visibles.");
viñeta("El boton de impresora imprime la \"Tarjeta de trabajo\" del registro.");

subtitulo("3.2 Taller");
parrafo("Registra los trabajos realizados en el taller (armado manual), con su mano de obra, materiales, archivos, y con la posibilidad de anexar trabajos de corte/torneria e items externos (tercerizados) con su valor en pesos.");
seccion("Registrar un trabajo de taller");
viñeta("Completa cliente, cantidad, duracion en horas y cantidad de personas.");
viñeta("Escribi la descripcion de los materiales usados.");
viñeta("Adjunta los archivos que quieras (varios).");
viñeta("Anexa trabajos: usa el selector \"Anexar trabajo (corte / torneria)\" y toca \"Anexar\". Se suman los trabajos registrados en el modulo Trabajos.");
viñeta("Agrega items externos: escribi descripcion, cantidad, horas y valor en $, y toca \"Agregar\". Ejemplo: \"Soldadura tercerizada, $15.000\".");
viñeta("Toca \"Registrar\". El sistema confirma \"Registro guardado / N anexado(s)\".");
seccion("Ver detalle y editar");
parrafo("Desde la lista, toca \"Ver detalle\" (o el boton de materiales/trabajos/archivos) para abrir el modal del trabajo. Dentro del modal podes anexar trabajos, agregar items externos o quitar items sin editar todo el registro.");
parrafo("El boton de lapiz abre el formulario completo para editar. La papelera elimina el registro con confirmacion; tambien se eliminan sus trabajos anexados.");
seccion("Imprimir la tarjeta");
parrafo("El boton de impresora imprime la tarjeta de taller con el detalle completo: fecha, cliente, cantidad, duracion, personas, materiales, trabajos anexados e items externos con su valor en pesos.");
seccion("Exportar");
parrafo("\"Exportar a Excel\" descarga el historial con una columna \"Trabajos anexados\" que resume los trabajos y items externos de cada registro.");

subtitulo("3.3 Fabricacion (obras)");
parrafo("Gestiona las obras o fabricaciones abiertas. Cada obra puede tener insumos usados (que descuentan stock) y un estimado de insumos a usar. Cuando se cierra, se puede exportar un PDF de resumen.");
seccion("Abrir una fabricacion");
parrafo("Toca \"Abrir fabricacion\", escribi el nombre de la obra (obligatorio) y opcionalmente cliente y descripcion. La obra queda en estado \"Abierta\".");
seccion("Cargar insumos usados");
viñeta("En la tarjeta de la obra abierta, selecciona el insumo (se muestra su stock disponible).");
viñeta("Carga la cantidad y confirma. El stock del insumo se descuenta automaticamente.");
parrafo("Si la cantidad supera el stock disponible, el sistema avisa y no descuenta.");
seccion("Cargar estimado");
parrafo("Es el pronostico de insumos que se van a usar. Se carga igual que los insumos usados, pero no toca el stock. Las cantidades se pueden corregir directamente en el campo y se guardan al salir.");
seccion("Finalizar, editar y eliminar una obra");
viñeta("Finalizar: toca \"Finalizar fabricacion\" para cerrar la obra.");
viñeta("Editar: en obras cerradas, toca \"Editar\". Podes cambiar nombre, cliente, descripcion, corregir cantidades de insumos usados (ajustando el stock), quitar insumos (se devuelven al stock) o agregar nuevos.");
viñeta("Eliminar: toca \"Eliminar\". Pide confirmacion y devuelve al stock todos los insumos cargados.");
seccion("Exportar PDF");
parrafo("En obras cerradas, el boton \"PDF\" genera un resumen con los datos de la obra, la hora hombre, el tiempo transcurrido y las tablas de insumos usados y estimados.");
parrafo("La hora hombre se calcula como el tiempo transcurrido por la jornada de 11 horas diarias.");

/* ===================== PARTES DIARIOS + GRUA ===================== */
nuevaPagina();
subtitulo("3.4 Partes diarios");
parrafo("Registra el parte diario de cada frente de obra: tareas realizadas, novedades, fotos y, para el frente especial de Bunge, el numero de parte y las horas por persona del sector.");
parrafo("Los administradores ven todos los frentes y pueden filtrar. Los encargados solo ven y cargan los frentes asignados a su usuario.");
seccion("Cargar un parte diario");
viñeta("Toca \"Nuevo parte\".");
viñeta("Elegi el frente de trabajo y la fecha.");
viñeta("Si el frente es Bunge Tancacha, completa el N de parte de Bunge y las horas por persona del sector (se sugieren los nombres del organigrama).");
viñeta("Escribi las tareas realizadas y las novedades (incidentes, faltas de material, clima, pendientes).");
viñeta("Adjunta fotos u archivos si queres.");
viñeta("Guarda el parte.");
seccion("Editar y eliminar");
parrafo("Un parte se puede editar o eliminar solo por el usuario que lo creo o por un administrador. Los demas usuarios solo lo ven.");

subtitulo("3.5 Grua");
parrafo("Registra los trabajos realizados con grua: cliente, ubicacion, descripcion, tipo/capacidad, operador, horas de uso y una foto del trabajo.");
seccion("Registrar un trabajo con grua");
viñeta("Completa cliente, ubicacion o direccion y descripcion del trabajo.");
viñeta("Indica el tipo o capacidad de la grua (ej. \"Grua 25 ton\").");
viñeta("Carga el operador y las horas de uso.");
viñeta("Adjunta una foto del trabajo (opcional).");
viñeta("Toca \"Registrar trabajo\".");
seccion("Consultar y exportar");
parrafo("El historial se ordena por fecha. La foto se ve en miniatura y se abre al hacer clic. El boton \"Exportar a Excel\" descarga el listado.");

/* ===================== HERRAMIENTAS ===================== */
nuevaPagina();
titulo("4. Herramientas de taller");
espaciado(2);

subtitulo("4.1 Optimizacion de cortes (Nesting)");
parrafo("Permite cargar piezas desde archivos DXF, definir las medidas de la chapa y optimizar automaticamente la ubicacion de las piezas para aprovechar el material. Muestra cada chapa resultante y permite descargarla en DXF.");
seccion("Como usarlo");
viñeta("Toca \"Elegir archivos DXF\" y selecciona una o varias piezas.");
viñeta("Ajusta la cantidad de cada pieza si hace falta.");
viñeta("Defini los parametros de la chapa: ancho (por defecto 1200 mm), largo maximo (opcional), espaciado entre piezas (por defecto 3 mm) y si se permite rotar piezas.");
viñeta("Toca \"Optimizar (N piezas)\".");
viñeta("En los resultados, cada chapa muestra su aprovechamiento (%) y el dibujo con las piezas. Toca \"DXF\" para descargar la chapa lista para cortar.");
parrafo("Si alguna pieza no entra, el sistema muestra un aviso naranja con la lista de piezas no ubicadas.");

subtitulo("4.2 Calculadora de inglete para tubos");
parrafo("Calcula la linea de corte para que un tubo encastre contra otro en el angulo deseado (union tipo silla de montar). Ofrece la plantilla desarrollada en pantalla, una tabla de medidas para marcar el cano, plantilla imprimible a escala real 1:1 y exportacion CSV.");
seccion("Como usarlo");
viñeta("Carga el diametro del tubo principal (D1), el diametro del tubo a cortar (D2) y el espesor de pared.");
viñeta("Ajusta el angulo de interseccion con la barra deslizante (90 grados es la union en T).");
viñeta("Los resultados se actualizan al instante: circunferencia a desarrollar, alturas minima y maxima, y largo minimo de tubo.");
viñeta("Usa la tabla de medidas (una fila cada 15 grados) para marcar directamente sobre el cano.");
viñeta("\"Exportar tabla (.csv)\" descarga las medidas.");
viñeta("\"Imprimir plantilla\" abre el dialogo de impresion con la plantilla a escala real 1:1 (dividida en tiras, con una regla de control de 100 mm).");
parrafo("El sistema advierte si el tubo a cortar es igual o mas grueso que el principal, y si la curva no tiene solucion con los datos ingresados.");

/* ===================== ORGANIGRAMA ===================== */
nuevaPagina();
titulo("5. Organigrama");
espaciado(2);
parrafo("Muestra la estructura de la empresa (dueno, sub-gerencia, administracion y operarios de taller) y permite administrar los frentes de trabajo (escuadrillas) y su personal. Todos los cambios se guardan automaticamente.");
seccion("Administrar frentes de trabajo");
viñeta("Crear un frente: toca \"+ Nuevo frente\" e ingresa el nombre.");
viñeta("Renombrar: edita el nombre directamente en la tarjeta; se guarda al salir del campo.");
viñeta("Eliminar: toca la X de la tarjeta. Si tiene personas asignadas, pide confirmacion.");
seccion("Administrar el personal de cada frente");
viñeta("Agregar una persona: usa el selector \"De la grilla...\" para traer un empleado activo, o escribi el nombre completo y elegí el rol (Encargado de escuadrilla, Puntero u Operario). Toca \"+ Agregar\".");
viñeta("Cambiar rol: usa el selector de rol de la persona.");
viñeta("Mover de frente: usa el selector \"Mover a...\" para trasladar la persona a otro frente.");
viñeta("Sacar del frente: toca la X de la persona.");
parrafo("La tarjeta de cada frente indica si tiene un encargado con cuenta de acceso (para cargar partes diarios) o no.");

/* ===================== RRHH ===================== */
nuevaPagina();
titulo("6. Recursos Humanos (RRHH)");
espaciado(2);

subtitulo("6.1 Empleados");
parrafo("Administra el padron de empleados: alta, edicion, archivo y carga masiva desde Excel. Esta informacion alimenta el modulo de Liquidacion de sueldos.");
seccion("Agregar un empleado");
parrafo("Completa el formulario \"Nuevo empleado\": legajo, apellido, nombre, CUIL, domicilio, localidad, categoria, tipo de contrato, sueldo basico, fecha de ingreso, fecha de antiguedad, banco y lugar de pago. Toca \"Agregar empleado\".");
seccion("Editar, archivar y reactivar");
viñeta("Editar: toca \"Editar\" en la fila, modifica y guarda los cambios.");
viñeta("Archivar: toca \"Archivar\". El empleado deja de aparecer en la liquidacion (advertencia del sistema) pero se conserva su legajo.");
viñeta("Reactivar: activa \"Mostrar archivados\" y toca \"Reactivar\".");
seccion("Importar desde Excel");
viñeta("Descarga la plantilla con \"Descargar plantilla\" para conocer el formato.");
viñeta("Completa la planilla y usa \"Importar desde Excel\".");
viñeta("El sistema informa cuantos empleados se importaron y lista los errores por fila (por ejemplo, legajos repetidos).");
parrafo("La importacion reconoce encabezados en espanol o ingles y no duplica legajos existentes.");

subtitulo("6.2 Conceptos de liquidacion");
parrafo("Administra el catalogo de conceptos que se usan al liquidar sueldos: haberes y descuentos, con su modo de calculo y el orden en el recibo.");
seccion("Agregar un concepto");
viñeta("Completa codigo, nombre (obligatorio) y orden (posicion en el recibo).");
viñeta("Elegi el tipo: Haber con descuento, Haber sin descuento o Descuento.");
viñeta("Elegi el modo de calculo: % del basico, Monto fijo o Manual (se carga cada vez).");
viñeta("Si el modo es % del basico, carga el porcentaje.");
viñeta("Toca \"Agregar concepto\".");
parrafo("Los conceptos se pueden editar, archivar y reactivar igual que los empleados. Los activos aparecen automaticamente al generar una liquidacion.");

subtitulo("6.3 Liquidacion de sueldos");
parrafo("Genera, guarda e imprime las liquidaciones de sueldo por empleado (1 quincena, 2 quincena o SAC/aguinaldo), con conceptos precargados y editables, totales automaticos y recibo imprimible.");
seccion("Generar una liquidacion");
viñeta("Selecciona el empleado (solo activos).");
viñeta("Elegi el tipo de liquidacion, el mes y el ano, y las fechas de pago y deposito.");
viñeta("Toca \"Generar liquidacion\". El sistema precarga los conceptos activos con sus montos calculados.");
viñeta("Revisa y edita las cantidades o montos de cada concepto si es necesario.");
viñeta("Toca el boton de confirmar para guardar la liquidacion.");
seccion("Imprimir el recibo");
parrafo("El boton de impresion abre el recibo completo en una ventana nueva y lanza la impresion. Incluye los datos de la empresa, del empleado, el detalle de conceptos, el sueldo bruto, el neto a cobrar y el monto en letras, con espacios de firma.");
seccion("Calculo de totales");
parrafo("El sistema calcula en vivo: total de haberes con y sin descuento, total de descuentos, sueldo bruto y neto a cobrar (haberes menos descuentos).");

/* ===================== PANEL ===================== */
nuevaPagina();
titulo("7. Panel de administracion");
espaciado(2);
parrafo("Es la pantalla principal del administrador. Resume la actividad de la empresa en un solo lugar:");
viñeta("Partes diarios de hoy y del mes (cuantos frentes reportaron).");
viñeta("Frentes de trabajo con su personal.");
viñeta("Uso de grua del mes (cantidad de trabajos y horas).");
viñeta("Insumos por debajo del minimo (Stocks comprometidos).");
viñeta("Fabricaciones abiertas.");
viñeta("Ultimos partes diarios y ultimos trabajos de grua con foto.");
parrafo("Cada seccion tiene un enlace \"Ver todo\" que lleva al modulo completo. Es solo de consulta y navegacion.");

/* ===================== EXPORTACIONES ===================== */
subtitulo("8. Exportaciones e impresiones");
espaciado(2);
tabla(
  ["Modulo", "Excel", "PDF / DXF", "Impresion"],
  [
    ["Stock", "Si (lista filtrada)", "-", "-"],
    ["Stock Panol", "Si (lista filtrada)", "-", "-"],
    ["Movimientos", "Si (todo el historial)", "-", "-"],
    ["Trabajos", "Si", "-", "Tarjeta de trabajo"],
    ["Taller", "Si", "-", "Tarjeta de taller"],
    ["Fabricacion", "-", "PDF de resumen por obra", "-"],
    ["Grua", "Si", "-", "-"],
    ["Nesting", "-", "DXF de cada chapa", "-"],
    ["Inglete", "CSV de medidas", "-", "Plantilla 1:1"],
    ["Empleados", "Plantilla + importacion", "-", "-"],
    ["Liquidacion", "-", "-", "Recibo de sueldo"],
  ]
);

espaciado(2);
parrafo("Todos los archivos Excel se descargan con el nombre del dia en el nombre (por ejemplo stock-2026-08-10.xlsx).");

subtitulo("9. Resumen por rol");
espaciado(2);
tabla(
  ["Accion", "admin", "taller_stock", "encargado", "operario", "grua"],
  [
    ["Panel de administracion", "Si", "-", "-", "-", "-"],
    ["Ingreso/Egreso (entradas y salidas)", "Si", "Solo egresos", "-", "Solo egresos", "-"],
    ["Stock / Stock Panol", "Si", "Stock (lectura)", "-", "-", "-"],
    ["Movimientos (historial)", "Si", "-", "-", "-", "-"],
    ["Trabajos", "Si", "Si", "-", "-", "-"],
    ["Taller", "Si", "-", "-", "-", "-"],
    ["Fabricacion", "Si", "-", "-", "-", "-"],
    ["Partes diarios", "Si (todos)", "-", "Si (su frente)", "-", "-"],
    ["Grua", "Si", "-", "-", "-", "Si"],
    ["Nesting", "Si", "Si", "-", "-", "-"],
    ["Inglete", "Si", "Si", "Si", "Si", "-"],
    ["Organigrama", "Si", "-", "-", "-", "-"],
    ["RRHH (Empleados, Conceptos, Liquidacion)", "Si", "-", "-", "-", "-"],
  ]
);

footer();
doc.save("Manual de Uso - ERP Aresa Simonetti.pdf");
console.log("PDF generado correctamente.");
