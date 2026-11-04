// Datos generales de la tienda (/inicio): negocio, envíos, pagos, crédito, categorías, producto insignia y destacados.
// Se cargan una vez al abrir la página y se comparten con todos los componentes.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { obtener } from './api';
import type { DatosInicio } from './tipos';
import { activarSeguimiento } from './seguimiento';

interface Contexto { datos: DatosInicio | null; error: string | null; reintentar: () => void }
const Ctx = createContext<Contexto>({ datos: null, error: null, reintentar: () => undefined });

export function ProveedorNegocio({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<DatosInicio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cargar = useCallback(() => {
    setError(null);
    obtener<DatosInicio>('/inicio', { fresco: true })
      .then((d) => { setDatos(d); activarSeguimiento(d.seguimiento); })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(cargar, [cargar]);
  return <Ctx.Provider value={{ datos, error, reintentar: cargar }}>{children}</Ctx.Provider>;
}

export const useNegocio = () => useContext(Ctx);
