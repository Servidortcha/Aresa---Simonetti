const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SB_URL, process.env.SB_KEY);
(async () => {
  const c = await supabase.from("taller_trabajo_items").insert({ taller_trabajo_id: 1, tipo: "externo", descripcion: "test", valor_pesos: 100 });
  console.log("insert externo:", c.error ? JSON.stringify(c.error) : "OK");
  const d = await supabase.from("taller_trabajo_items").delete().eq("descripcion", "test");
  console.log("cleanup:", d.error ? JSON.stringify(d.error) : "OK");
})();
