// Fondo decorativo de marca Aresa — reutilizable en el login de cualquier cliente.
// Se apoya en el isotipo oficial (barras de distinta altura, la metáfora de nivel de stock)
// de la guía de marca de Aresa. No depende de assets de ningún cliente en particular.
export default function AresaBackdrop() {
  const heights = [60, 120, 80, 160, 100, 140];
  return (
    <div
      className="absolute pointer-events-none select-none"
      style={{ right: "-4vw", bottom: "-3vw", display: "flex", alignItems: "flex-end", gap: "10px", opacity: 0.1 }}
    >
      {heights.map((h, idx) => (
        <div key={idx} style={{ width: "22px", height: `${h}px`, background: "#14C3B0" }} />
      ))}
    </div>
  );
}
