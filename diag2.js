const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SB_URL, process.env.SB_KEY);
(async () => {
  const q = await supabase.from("trabajos").select("id, tipo, cliente, descripcion, cantidad, duracion_minutos, duracion_horas, material, largo_mm, ancho_mm, metros_cuadrados, confirmado").order("fecha", { ascending: false });
  console.log("error:", JSON.stringify(q.error));
  console.log("filas:", (q.data || []).length);
  if (q.data && q.data[0]) console.log("ejemplo:", JSON.stringify(q.data[0]));
})();
