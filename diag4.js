const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SB_URL, process.env.SB_KEY);
(async () => {
  const c = await supabase.from("taller_trabajo_items").select("tipo, descripcion, valor_pesos");
  console.log("items:", c.error ? JSON.stringify(c.error) : (c.data||[]).length + " rows");
  if (c.data && c.data[0]) console.log("ejemplo:", JSON.stringify(c.data[0]));
})();
