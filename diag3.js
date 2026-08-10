const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SB_URL, process.env.SB_KEY);
(async () => {
  const t = await supabase.from("taller_trabajo_items").select("tipo");
  console.log("items table:", t.error ? JSON.stringify(t.error) : "OK " + (t.data||[]).length + " rows");
  const cols = await supabase.from("taller_trabajo_items").select("taller_trabajo_id, trabajo_ref, descripcion, cantidad, duracion_horas").limit(1);
  console.log("cols:", cols.error ? JSON.stringify(cols.error) : "OK");
})();
