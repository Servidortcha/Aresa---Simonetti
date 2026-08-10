const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SB_URL, process.env.SB_KEY);
(async () => {
  const c = await supabase.from("taller_trabajo_items").select("tipo, descripcion, valor_pesos, cantidad, duracion_horas, trabajo_ref");
  console.log("select with valor_pesos:", c.error ? JSON.stringify(c.error) : "OK " + (c.data||[]).length + " rows");
  const s = await supabase.from("taller_trabajos").select("id, cliente");
  console.log("taller_trabajos:", s.error ? JSON.stringify(s.error) : (s.data||[]).length + " rows");
})();
