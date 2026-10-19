'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

/**
 * Paginación con botones Anterior/Siguiente y un input numérico
 * para saltar directamente a una página (solo si existe).
 */
export default function Pagination({ page, totalPages, onChange }: Props) {
  const [value, setValue] = useState(String(page));

  // Mantener el input sincronizado cuando la página cambia desde fuera
  useEffect(() => {
    setValue(String(page));
  }, [page]);

  const target = Number(value);
  const isValid = Number.isInteger(target) && target >= 1 && target <= totalPages;

  const goTo = () => {
    if (isValid && target !== page) {
      onChange(target);
    } else {
      setValue(String(page));
    }
  };

  if (totalPages <= 1) return null;

  const btnCls =
    'flex items-center gap-1 px-3 py-2 bg-navy-700 border border-navy-500 text-navy-200 rounded-xl text-sm disabled:opacity-40 hover:border-navy-300 transition-colors';

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} className={btnCls}>
        <ChevronLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Anterior</span>
      </button>

      <form
        onSubmit={e => { e.preventDefault(); goTo(); }}
        className="flex items-center gap-2 text-navy-300 text-sm"
      >
        <span>Página</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={totalPages}
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={goTo}
          aria-label="Ir a la página"
          className={`input-dark w-16 text-center py-1.5 px-2 ${
            value !== '' && !isValid ? 'border-red-500/60 text-red-400' : ''
          }`}
        />
        <span>de {totalPages}</span>
      </form>

      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages} className={btnCls}>
        <span className="hidden sm:inline">Siguiente</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
