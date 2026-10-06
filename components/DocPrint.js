"use client";

const EXACT = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

export function DocPrint({ titulo, numero, children }) {
  return (
    <div className="print-card hidden" style={{ maxWidth: 680, padding: 0, color: "#1C1F1C" }}>
      <div style={{ background: "#F4791E", color: "#fff", padding: "18px 24px", borderRadius: "8px 8px 0 0", ...EXACT }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.9 }}>
          Simonetti Montajes Industriales
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 30, lineHeight: 1 }}>
            {titulo}
          </span>
          {numero && (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 16,
                background: "rgba(255,255,255,0.25)",
                padding: "4px 14px",
                borderRadius: 6,
                whiteSpace: "nowrap",
              }}
            >
              {numero}
            </span>
          )}
        </div>
      </div>
      <div style={{ border: "1px solid #E4DFD3", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "20px 24px" }}>
        {children}
        <div style={{ marginTop: 20, fontSize: 10, color: "#B0AA9A", textAlign: "center" }}>
          Simonetti Montajes Industriales · Powered by Aresa
        </div>
      </div>
    </div>
  );
}

export function DocGrid({ datos }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", marginBottom: 16 }}>
      {datos.map((d, i) => (
        <div key={i} style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#8A8578" }}>{d.label}</div>
          <div style={{ fontSize: 14, overflowWrap: "anywhere" }}>{d.valor}</div>
        </div>
      ))}
    </div>
  );
}

export function DocTabla({ head, children, pie }) {
  return (
    <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginBottom: 8 }}>
      <thead>
        <tr style={{ background: "#1C1F1C", color: "#fff", ...EXACT }}>
          {head.map((h, i) => (
            <th
              key={i}
              style={{
                padding: "8px 10px",
                fontWeight: 600,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 1,
                textAlign: h.align || "left",
              }}
            >
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
      {pie}
    </table>
  );
}

export function DocFila({ celdas, zebra }) {
  return (
    <tr style={{ background: zebra ? "#F7F4EC" : "#fff", borderBottom: "1px solid #E4DFD3", ...EXACT }}>
      {celdas.map((c, i) => (
        <td key={i} style={{ padding: "8px 10px", textAlign: c.align || "left" }}>
          {c.valor}
        </td>
      ))}
    </tr>
  );
}

export function DocNota({ label, texto }) {
  if (!texto) return null;
  return (
    <div style={{ background: "#F7F4EC", border: "1px solid #E4DFD3", borderRadius: 6, padding: "10px 12px", marginBottom: 16, ...EXACT }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#8A8578", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{texto}</div>
    </div>
  );
}

export function DocFirmas({ izq, der }) {
  return (
    <div style={{ display: "flex", gap: 40, marginTop: 56, fontSize: 12, color: "#6B6558" }}>
      <div style={{ flex: 1, borderTop: "1px solid #1C1F1C", paddingTop: 6, textAlign: "center" }}>{izq}</div>
      <div style={{ flex: 1, borderTop: "1px solid #1C1F1C", paddingTop: 6, textAlign: "center" }}>{der}</div>
    </div>
  );
}
