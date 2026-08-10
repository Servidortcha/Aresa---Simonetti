const { createClient } = require("@supabase/supabase-js");

const url = "https://sskqubpcaapwqfhwisjd.supabase.co";
const key = process.env.SB_KEY;

const supabase = createClient(url, key);

(async () => {
  const q1 = await supabase
    .from("trabajos")
    .select("id, tipo, cliente, descripcion, cantidad, duracion_minutos, duracion_horas, material, confirmado")
    .order("fecha", { ascending: false });
  console.log("Q1 trabajos columnas fijas -> error:", JSON.stringify(q1.error), "| filas:", (q1.data || []).length);

  const q2 = await supabase.from("trabajos").select("*").order("fecha", { ascending: false });
  console.log("Q2 trabajos * -> error:", JSON.stringify(q2.error), "| filas:", (q2.data || []).length);

  const q3 = await supabase.from("taller_trabajos").select("id");
  console.log("Q3 taller_trabajos -> error:", JSON.stringify(q3.error), "| filas:", (q3.data || []).length);

  const q4 = await supabase.from("taller_trabajo_items").select("id, taller_trabajo_id, tipo, trabajo_ref, descripcion, cantidad, duracion_horas");
  console.log("Q4 taller_trabajo_items -> error:", JSON.stringify(q4.error), "| filas:", (q4.data || []).length);
})();
