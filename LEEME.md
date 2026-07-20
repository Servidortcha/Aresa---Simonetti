# Inventario ERP — Guía para arrancarlo

## 1. Descomprime el archivo
Descomprime `inventario-erp.zip` en una carpeta de tu computadora.

## 2. Agrega tus claves de Supabase
1. Dentro de la carpeta, busca el archivo `.env.local.example`
2. Haz una copia y renómbrala a `.env.local` (sin ".example")
3. Ábrelo con el Bloc de notas (o cualquier editor de texto) y reemplaza:
   - `https://tu-proyecto.supabase.co` por tu **Project URL**
   - `tu-clave-anon-aqui` por tu **anon public key**
   (ambas las encuentras en Supabase → Project Settings → API)

## 3. Agrega al menos un producto de ejemplo
Ve a Supabase → **SQL Editor** y pega esto para tener algo que elegir en "Usado en (producto)":

```sql
insert into productos (nombre) values
  ('Producto A'),
  ('Producto B');
```

(Después puedes agregar más productos así, o directamente desde la pestaña Table Editor de Supabase.)

## 4. Instala las dependencias
Abre la terminal (Símbolo del sistema / PowerShell / Terminal), navega hasta la carpeta del proyecto con `cd`, por ejemplo:
```
cd Descargas/inventario-erp
```
Luego instala todo con:
```
npm install
```
Esto puede tardar 1-2 minutos.

## 5. Arranca el proyecto
```
npm run dev
```
Cuando termine, abre tu navegador en:
```
http://localhost:3000
```
Y ahí deberías ver tu aplicación funcionando, conectada de verdad a tu base de datos.

## Notas
- Cada vez que quieras usarlo, solo repites el paso 5 (`npm run dev`) desde la carpeta del proyecto.
- Si algo da error, cópiame el mensaje exacto y lo resolvemos.
