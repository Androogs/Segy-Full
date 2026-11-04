// Carga de datos con estados de carga y error, y cancelación al cambiar de ruta.
import { useCallback, useEffect, useState } from 'react';

export interface Estado<T> { datos: T | null; cargando: boolean; error: string | null; status: number | null; reintentar: () => void }

export function usarDatos<T>(cargar: (() => Promise<T>) | null, deps: unknown[]): Estado<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(!!cargar);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    if (!cargar) { setCargando(false); return; }
    let vivo = true;
    setCargando(true); setError(null); setStatus(null);
    cargar().then((d) => { if (vivo) { setDatos(d); setCargando(false); } })
      .catch((e: Error & { status?: number }) => { if (vivo) { setError(e.message); setStatus(e.status ?? null); setCargando(false); } });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, vuelta]);
  const reintentar = useCallback(() => setVuelta((v) => v + 1), []);
  return { datos, cargando, error, status, reintentar };
}
