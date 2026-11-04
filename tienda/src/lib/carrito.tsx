// Carrito: vive en este navegador (localStorage) y guarda una copia del producto para pintarse sin esperar a la API.
// El precio y la disponibilidad reales los confirma el servidor al hacer el pedido.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ProductoResumen } from './tipos';

export interface LineaCarrito { producto: ProductoResumen; cantidad: number }
interface Contexto {
  lineas: LineaCarrito[];
  unidades: number;
  subtotal: number;
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
  agregar: (p: ProductoResumen, cantidad?: number) => void;
  cambiar: (id: number, cantidad: number) => void;
  quitar: (id: number) => void;
  vaciar: () => void;
  actualizarProductos: (productos: ProductoResumen[]) => void;
}
const CLAVE = 'segy.carrito';
const Ctx = createContext<Contexto | null>(null);
const topeDe = (p: ProductoResumen) => Math.max(1, Math.min(10, p.disponibles || 1));

function cargar(): LineaCarrito[] {
  try {
    const raw = localStorage.getItem(CLAVE);
    const lista = raw ? (JSON.parse(raw) as LineaCarrito[]) : [];
    return Array.isArray(lista) ? lista.filter((l) => l && l.producto && typeof l.producto.id === 'number' && l.cantidad > 0) : [];
  } catch { return []; }
}

export function ProveedorCarrito({ children }: { children: ReactNode }) {
  const [lineas, setLineas] = useState<LineaCarrito[]>(cargar);
  const [abierto, setAbierto] = useState(false);
  useEffect(() => { try { localStorage.setItem(CLAVE, JSON.stringify(lineas)); } catch { /* sin almacenamiento */ } }, [lineas]);
  // Otra pestaña cambió el carrito.
  useEffect(() => {
    const f = (e: StorageEvent) => { if (e.key === CLAVE) setLineas(cargar()); };
    window.addEventListener('storage', f);
    return () => window.removeEventListener('storage', f);
  }, []);

  const agregar = useCallback((p: ProductoResumen, cantidad = 1) => {
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.producto.id === p.id);
      if (i < 0) return [...ls, { producto: p, cantidad: Math.min(cantidad, topeDe(p)) }];
      const copia = [...ls];
      copia[i] = { producto: p, cantidad: Math.min(copia[i].cantidad + cantidad, topeDe(p)) };
      return copia;
    });
    setAbierto(true);
  }, []);
  const cambiar = useCallback((id: number, cantidad: number) => setLineas((ls) => ls.map((l) => (l.producto.id === id ? { ...l, cantidad: Math.max(1, Math.min(cantidad, topeDe(l.producto))) } : l))), []);
  const quitar = useCallback((id: number) => setLineas((ls) => ls.filter((l) => l.producto.id !== id)), []);
  const vaciar = useCallback(() => setLineas([]), []);
  const abrir = useCallback(() => setAbierto(true), []);
  const cerrar = useCallback(() => setAbierto(false), []);
  const actualizarProductos = useCallback((productos: ProductoResumen[]) => setLineas((ls) => ls.map((l) => {
    const p = productos.find((x) => x.id === l.producto.id);
    return p ? { producto: p, cantidad: Math.min(l.cantidad, topeDe(p)) } : l;
  })), []);

  const valor = useMemo<Contexto>(() => ({
    lineas,
    unidades: lineas.reduce((a, l) => a + l.cantidad, 0),
    subtotal: lineas.reduce((a, l) => a + l.cantidad * l.producto.precio, 0),
    abierto, abrir, cerrar,
    agregar, cambiar, quitar, vaciar, actualizarProductos,
  }), [lineas, abierto, abrir, cerrar, agregar, cambiar, quitar, vaciar, actualizarProductos]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCarrito(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCarrito fuera de ProveedorCarrito');
  return c;
}
