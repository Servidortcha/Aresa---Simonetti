"use client";

import { useState } from "react";
import { X, Camera } from "lucide-react";

function nombreSeguro(nombre) {
  return (
    String(nombre || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 40) || "insumo"
  );
}

export function FotoInsumo({ insumoId, nombre, imagenUrl, onImagen, onQuitar, puedeEditar }) {
  const [ver, setVer] = useState(false);

  async function elegir(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    onImagen(insumoId, file, nombre);
  }

  if (!imagenUrl) {
    return puedeEditar ? (
      <label
        className="h-14 w-14 shrink-0 rounded-sm border border-dashed border-line bg-[#F7F4EC] flex flex-col items-center justify-center text-[#8A8578] cursor-pointer hover:border-[#F4791E] hover:text-[#F4791E] transition-colors"
        title="Agregar foto"
      >
        <Camera size={14} />
        <span className="text-[8px] mt-0.5">Foto</span>
        <input type="file" accept="image/*" className="hidden" onChange={elegir} />
      </label>
    ) : (
      <div className="h-14 w-14 shrink-0 rounded-sm border border-[#EFEBE0] bg-[#F7F4EC]" />
    );
  }

  return (
    <span className="relative inline-block shrink-0">
      <button onClick={() => setVer(true)} className="block" title="Ver foto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagenUrl}
          alt={nombre}
          loading="lazy"
          className="h-14 w-14 rounded-sm border border-line object-cover bg-[#F7F4EC]"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = "flex";
          }}
        />
        <span style={{ display: "none" }} className="h-14 w-14 items-center justify-center rounded-sm border border-[#EFEBE0] bg-[#F7F4EC] text-[8px] text-[#8A8578] text-center p-1 leading-tight">
          {nombre}
        </span>
      </button>
      {puedeEditar && (
        <button
          onClick={() => onQuitar(insumoId)}
          className="absolute -top-1.5 -right-1.5 bg-white border border-[#EFD9C4] rounded-full p-0.5 text-[#C7522A] hover:text-red"
          title="Quitar foto"
        >
          <X size={11} />
        </button>
      )}

      {ver && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setVer(false)}>
          <div className="bg-white rounded-sm p-3 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium truncate">{nombre}</span>
              <button onClick={() => setVer(false)} className="text-[#8A8578] hover:text-ink">
                <X size={16} />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagenUrl} alt={nombre} className="w-full max-h-[60vh] object-contain rounded-sm border border-line" />
            {puedeEditar && (
              <label className="mt-3 flex items-center justify-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-ink cursor-pointer hover:bg-[#F2EEE3]">
                <Camera size={15} /> Cambiar foto
                <input type="file" accept="image/*" className="hidden" onChange={elegir} />
              </label>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

export { nombreSeguro };
