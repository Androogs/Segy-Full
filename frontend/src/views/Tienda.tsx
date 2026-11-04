// Tienda web · gestión de la página pública desde el panel.
//  #/tienda (o #/tienda/pedidos)  Pedidos hechos en la página: confirmar, cambiar estado, vincular la venta real.
//  #/tienda/productos             Qué productos se ven en la página, destacados y precio "antes" (oferta).
//  #/tienda/ajustes               WhatsApp, envíos, formas de pago, planes de crédito, producto de la portada y redes.
// Las fotos, el precio y la descripción de cada producto se siguen editando en Inventario (una sola fuente de verdad).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';
import { estado } from '../lib/estado';
import { fmt, plural } from '../lib/formato';
import type { Ruta, Topbar } from '../lib/tipos';
import { Icono } from '../components/Icono';
import { toast, mostrarError } from '../legacy/ui.js';

// ---------- Tipos (backend/server/services/tienda.js) ----------
type EstadoPedido = 'nuevo' | 'confirmado' | 'pagado' | 'enviado' | 'listo' | 'entregado' | 'cancelado';
interface PedidoFila { id: number; numero: string; fecha: string; estado: EstadoPedido; nombre: string; telefono: string; entrega: string; ciudad: string | null; pago: string; credito_cuotas: number | null; total: number; envio_por_confirmar: number; venta_numero: string | null; lineas: number; resumen: string }
interface PedidoDetalle extends Omit<PedidoFila, 'envio_por_confirmar'> {
  email: string | null; documento: string | null; direccion: string | null; barrio: string | null; subtotal: number; envio: number; envio_por_confirmar: boolean;
  notas: string | null; retoma: string | null; notas_internas: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
  campana_nombre: string | null; lead_id: number | null; lead_estado: string | null; estado_texto: string; pago_texto: string; entrega_texto: string; enlace_seguimiento: string | null;
  items: { id: number; producto_id: number; nombre: string; precio: number; cantidad: number; total: number; stock: number | null }[];
  historial: { fecha: string; estado: EstadoPedido; nota?: string | null; usuario?: string | null }[];
}
interface ProductoWeb { id: number; nombre: string; marca: string | null; sku: string | null; estado: string; precio_venta: number; categoria_nombre: string | null; stock: number; publicado: boolean; publicado_explicito: boolean; destacado: boolean; precio_antes: number | null; resumen: string | null; fotos: number; foto: string | null; grupo: string; slug: string; visible: boolean; motivos_oculto: string[] }
interface Plan { cuotas: number; interes_pct: number }
interface Ajustes {
  activa: boolean; url_tienda: string; publicar_por_defecto: boolean; mostrar_agotados: boolean; whatsapp: string; whatsapp_efectivo: string; horario: string; mapa_url: string; mensajes_barra: string[];
  envio: { local_nombre: string; local_costo: number | null; nacional: boolean; nacional_costo: number | null; gratis_desde: number | null };
  pagos: string[]; credito: { activo: boolean; cuota_inicial_min_pct: number; planes: Plan[] }; producto_insignia_id: number | null; insignia: { id: number; nombre: string } | null;
  redes: { instagram: string; facebook: string; tiktok: string }; seguimiento_activo: boolean;
}

const ESTADOS: Record<EstadoPedido, [string, string]> = {
  nuevo: ['Nuevo', 'peligro'], confirmado: ['Confirmado', 'aviso'], pagado: ['Pagado', 'ok'], enviado: ['En camino', 'neutro'], listo: ['Listo para recoger', 'neutro'], entregado: ['Entregado', 'ok'], cancelado: ['Cancelado', 'neutro'],
};
const PAGOS: Record<string, string> = { transferencia: 'Transferencia', contraentrega: 'Contra entrega', tienda: 'Pago en la tienda', credito: 'Crédito SEGY' };
const ENTREGAS: Record<string, string> = { recoger: 'Recoge en la tienda', local: 'Domicilio local', nacional: 'Envío nacional' };
const FILTROS_PEDIDO: { clave: string; texto: string }[] = [{ clave: 'abiertos', texto: 'Por atender' }, { clave: 'nuevo', texto: 'Nuevos' }, { clave: 'entregado', texto: 'Entregados' }, { clave: 'cancelado', texto: 'Cancelados' }, { clave: 'todos', texto: 'Todos' }];
const hora = (f: string) => String(f || '').slice(11, 16);
const wa = (tel: string, texto: string) => {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('3')) d = '57' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
};
const Insignia = ({ e }: { e: EstadoPedido }) => <span className={`badge ${ESTADOS[e]?.[1] || 'neutro'}`}>{ESTADOS[e]?.[0] || e}</span>;

// Diálogo con el diseño de los modales del panel (#modales).
function Dialogo({ titulo, cerrar, children, pie, ancho = true }: { titulo: React.ReactNode; cerrar: () => void; children: React.ReactNode; pie?: React.ReactNode; ancho?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [cerrar]);
  const destino = document.getElementById('modales') || document.body;
  return createPortal(
    <div className="modal-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <div className={`modal${ancho ? ' ancho' : ''}`} role="dialog" aria-modal="true">
        <div className="cab"><h2>{titulo}</h2><button type="button" className="btn icono fantasma" onClick={cerrar} aria-label="Cerrar"><Icono nombre="x" /></button></div>
        <div className="cuerpo">{children}</div>
        {pie && <div className="pie">{pie}</div>}
      </div>
    </div>, destino);
}

// ====================================================================================================================
// Pedidos
// ====================================================================================================================
function siguientes(p: PedidoDetalle): EstadoPedido[] {
  if (p.estado === 'entregado' || p.estado === 'cancelado') return [];
  const flujo: EstadoPedido[] = ['nuevo', 'confirmado'];
  if (p.pago === 'transferencia' || p.pago === 'credito') flujo.push('pagado');
  flujo.push(p.entrega === 'recoger' ? 'listo' : 'enviado', 'entregado');
  const i = flujo.indexOf(p.estado);
  return [...flujo.slice(i + 1), 'cancelado'];
}

function DetallePedido({ id, cerrar, alCambiar, urlTienda }: { id: number; cerrar: () => void; alCambiar: () => void; urlTienda: string }) {
  const [p, setP] = useState<PedidoDetalle | null>(null);
  const [nota, setNota] = useState('');
  const [venta, setVenta] = useState('');
  const [internas, setInternas] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const puede = estado.tiene('tienda.gestionar');
  useEffect(() => {
    api.get<PedidoDetalle>(`/api/tienda/pedidos/${id}`).then((d) => { setP(d); setVenta(d.venta_numero || ''); setInternas(d.notas_internas || ''); }).catch((e) => { mostrarError(e); cerrar(); });
  }, [id, cerrar]);
  if (!p) return <Dialogo titulo="Pedido" cerrar={cerrar}><div className="cargando">Cargando…</div></Dialogo>;

  const cambiarEstado = async (nuevo: EstadoPedido) => {
    if (nuevo === 'cancelado' && !nota.trim()) { toast('Escribe el motivo de la cancelación en la nota', 'error'); return; }
    setOcupado(true);
    try { const d = await api.post<PedidoDetalle>(`/api/tienda/pedidos/${p.id}/estado`, { estado: nuevo, nota: nota.trim() || undefined }); setP(d); setNota(''); toast(`Pedido ${d.numero}: ${ESTADOS[nuevo][0].toLowerCase()}`, 'ok'); alCambiar(); }
    catch (e) { mostrarError(e); } finally { setOcupado(false); }
  };
  const guardar = async () => {
    setOcupado(true);
    try { const d = await api.put<PedidoDetalle>(`/api/tienda/pedidos/${p.id}`, { venta_numero: venta.trim() || null, notas_internas: internas.trim() || null }); setP(d); toast('Cambios guardados', 'ok'); alCambiar(); }
    catch (e) { mostrarError(e); } finally { setOcupado(false); }
  };
  const faltaStock = p.items.some((i) => (i.stock ?? 0) < i.cantidad);
  const saludo = `Hola ${p.nombre.split(' ')[0]}, te escribimos de SEGY por tu pedido ${p.numero}.${p.enlace_seguimiento ? ` Puedes ver su estado aquí: ${p.enlace_seguimiento}` : ''}`;
  const acciones = siguientes(p);

  return (
    <Dialogo titulo={<>{p.numero} <Insignia e={p.estado} /></>} cerrar={cerrar}
      pie={puede ? <><button type="button" className="btn suave" onClick={cerrar}>Cerrar</button><button type="button" className="btn primario" onClick={() => void guardar()} disabled={ocupado}>Guardar notas y venta</button></> : undefined}>
      <div className="grid2 tw-grid">
        <div className="card compacta">
          <h3 className="mb">Cliente</h3>
          <dl className="kv">
            <dt>Nombre</dt><dd>{p.nombre}</dd>
            <dt>Celular</dt><dd><a className="tw-enlace" href={wa(p.telefono, saludo)} target="_blank" rel="noopener">{p.telefono} <Icono nombre="whatsapp" tam={14} /></a></dd>
            {p.email && <><dt>Correo</dt><dd><a className="tw-enlace" href={`mailto:${p.email}`}>{p.email}</a></dd></>}
            {p.documento && <><dt>Cédula</dt><dd>{p.documento}</dd></>}
          </dl>
        </div>
        <div className="card compacta">
          <h3 className="mb">Entrega y pago</h3>
          <dl className="kv">
            <dt>Entrega</dt><dd>{p.entrega_texto}</dd>
            {p.direccion && <><dt>Dirección</dt><dd>{p.direccion}{p.barrio ? `, ${p.barrio}` : ''}{p.ciudad ? `, ${p.ciudad}` : ''}</dd></>}
            <dt>Pago</dt><dd>{p.pago_texto}{p.credito_cuotas ? ` · ${p.credito_cuotas} cuotas` : ''}</dd>
            <dt>Fecha</dt><dd>{fmt.fechaHora(p.fecha)}</dd>
          </dl>
        </div>
      </div>
      {(p.retoma || p.notas) && (
        <div className="card compacta mt">
          {p.retoma && <p><b>Retoma:</b> {p.retoma} <span className="muted small">(revísalo en Celulares usados al recibirlo)</span></p>}
          {p.notas && <p className={p.retoma ? 'mt' : ''}><b>Nota del cliente:</b> {p.notas}</p>}
        </div>
      )}
      <div className="tabla-wrap mt">
        <table className="tabla">
          <thead><tr><th>Producto</th><th className="n">Cant.</th><th className="n">Precio</th><th className="n">Total</th><th className="n">Stock hoy</th></tr></thead>
          <tbody>{p.items.map((i) => <tr key={i.id}><td>{i.nombre}</td><td className="n">{i.cantidad}</td><td className="n">{fmt.cop(i.precio)}</td><td className="n">{fmt.cop(i.total)}</td><td className={`n ${(i.stock ?? 0) < i.cantidad ? 'neg' : ''}`}>{fmt.num(i.stock ?? 0)}</td></tr>)}</tbody>
          <tfoot>
            <tr><td colSpan={3}>Envío</td><td className="n">{p.entrega === 'recoger' ? '—' : p.envio_por_confirmar ? 'Por confirmar' : fmt.cop(p.envio)}</td><td /></tr>
            <tr><td colSpan={3}>Total</td><td className="n">{fmt.cop(p.total)}</td><td /></tr>
          </tfoot>
        </table>
      </div>
      {faltaStock && <div className="alerta aviso mt">Hoy no hay unidades suficientes de algún producto. Confírmalo con el cliente antes de cobrar.</div>}

      {puede && acciones.length > 0 && (
        <div className="card compacta mt">
          <h3 className="mb">Siguiente paso</h3>
          <div className="campo"><label htmlFor="tw-nota">Nota para el historial {acciones.includes('cancelado') && <span className="muted">(obligatoria para cancelar)</span>}</label><input id="tw-nota" type="text" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: Confirmado por WhatsApp, paga contra entrega" maxLength={500} /></div>
          <div className="row wrap">
            {acciones.map((a) => <button key={a} type="button" className={`btn chico ${a === 'cancelado' ? 'peligro' : a === acciones[0] ? 'primario' : 'suave'}`} disabled={ocupado} onClick={() => void cambiarEstado(a)}>{a === 'cancelado' ? 'Cancelar pedido' : `Marcar ${ESTADOS[a][0].toLowerCase()}`}</button>)}
          </div>
        </div>
      )}

      <div className="grid2 mt">
        <div className="campo">
          <label htmlFor="tw-venta">Venta registrada</label>
          <input id="tw-venta" type="text" value={venta} onChange={(e) => setVenta(e.target.value)} placeholder="Ej.: V-000123" disabled={!puede} />
          <span className="ayuda">Registra la venta en <a href="#/vender">Ventas</a> (descuenta inventario y caja) y escribe aquí su número.</span>
        </div>
        <div className="campo">
          <label htmlFor="tw-internas">Notas internas</label>
          <textarea id="tw-internas" value={internas} onChange={(e) => setInternas(e.target.value)} rows={3} disabled={!puede} placeholder="Solo las ve el equipo" />
        </div>
      </div>

      <details className="mas mt">
        <summary>Origen e historial</summary>
        <dl className="kv">
          <dt>Campaña</dt><dd>{p.campana_nombre || (p.utm_campaign ? `${p.utm_campaign} (sin campaña creada)` : 'Sin campaña')}</dd>
          {p.utm_source && <><dt>Fuente</dt><dd>{p.utm_source}{p.utm_medium ? ` / ${p.utm_medium}` : ''}</dd></>}
          {p.lead_id && <><dt>Cliente potencial</dt><dd><a href="#/marketing/leads">#{p.lead_id} · {p.lead_estado}</a></dd></>}
          {p.enlace_seguimiento && <><dt>Enlace del cliente</dt><dd><a href={p.enlace_seguimiento} target="_blank" rel="noopener">Abrir seguimiento</a></dd></>}
        </dl>
        <div className="actividad mt">
          {p.historial.map((h, i) => <div key={i}><time>{fmt.fecha(h.fecha)} {hora(h.fecha)}</time><span><Insignia e={h.estado} /> {h.nota ? <span className="q">{h.nota}</span> : null}{h.usuario ? <span className="muted"> · {h.usuario}</span> : null}</span></div>)}
        </div>
      </details>
      {!urlTienda && <p className="muted xs mt">Configura la dirección de la tienda en Ajustes para compartir el enlace de seguimiento con el cliente.</p>}
    </Dialogo>
  );
}

function Pedidos({ urlTienda }: { urlTienda: string }) {
  const [filtro, setFiltro] = useState('abiertos');
  const [q, setQ] = useState('');
  const [datos, setDatos] = useState<{ pedidos: PedidoFila[]; conteo: Record<string, number> } | null>(null);
  const [abierto, setAbierto] = useState<number | null>(null);
  const cargar = useCallback(() => {
    api.get<{ pedidos: PedidoFila[]; conteo: Record<string, number> }>(`/api/tienda/pedidos${api.qs({ estado: filtro, q: q.trim() || undefined })}`).then(setDatos).catch(mostrarError);
  }, [filtro, q]);
  useEffect(() => { const t = setTimeout(cargar, q ? 250 : 0); return () => clearTimeout(t); }, [cargar, q]);
  const conteo = datos?.conteo || {};
  const abiertos = Object.entries(conteo).filter(([e]) => e !== 'entregado' && e !== 'cancelado').reduce((a, [, n]) => a + n, 0);
  const total = Object.values(conteo).reduce((a, n) => a + n, 0);
  const n = (c: string) => (c === 'abiertos' ? abiertos : c === 'todos' ? total : conteo[c] || 0);
  const cerrar = useCallback(() => setAbierto(null), []);

  return (
    <>
      <div className="filtros">
        <div className="pills">{FILTROS_PEDIDO.map((f) => <button key={f.clave} type="button" className={`pill${filtro === f.clave ? ' activo' : ''}`} onClick={() => setFiltro(f.clave)}>{f.texto} <span className="tw-n">{n(f.clave)}</span></button>)}</div>
        <div className="buscador grow" style={{ maxWidth: 320 }}><Icono nombre="search" /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número, nombre o celular" /></div>
      </div>
      {!datos ? <div className="cargando">Cargando pedidos…</div> : datos.pedidos.length === 0 ? (
        <div className="vacio"><Icono nombre="globe" /><p>{filtro === 'abiertos' ? 'No hay pedidos por atender. Los que lleguen desde la página aparecerán aquí.' : 'No hay pedidos con este filtro.'}</p></div>
      ) : (
        <div className="lista">
          {datos.pedidos.map((p) => (
            <a key={p.id} className="item" href="#" onClick={(e) => { e.preventDefault(); setAbierto(p.id); }}>
              <div className="thumb"><Icono nombre={p.entrega === 'recoger' ? 'bag' : 'truck'} tam={20} /></div>
              <div className="cuerpo">
                <div className="titulo">{p.numero} · {p.nombre}</div>
                <div className="sub">{p.resumen}</div>
                <div className="sub">{ENTREGAS[p.entrega]}{p.ciudad && p.entrega !== 'recoger' ? `, ${p.ciudad}` : ''} · {PAGOS[p.pago]}{p.credito_cuotas ? ` (${p.credito_cuotas} cuotas)` : ''}{p.venta_numero ? ` · Venta ${p.venta_numero}` : ''}</div>
              </div>
              <div className="fin"><div className="valor">{fmt.cop(p.total)}</div><div className="xs muted">{fmt.fecha(p.fecha)} {hora(p.fecha)}</div><Insignia e={p.estado} /></div>
            </a>
          ))}
        </div>
      )}
      {abierto && <DetallePedido id={abierto} cerrar={cerrar} alCambiar={cargar} urlTienda={urlTienda} />}
    </>
  );
}

// ====================================================================================================================
// Productos en la web
// ====================================================================================================================
function FilaProducto({ p, urlTienda, alGuardar }: { p: ProductoWeb; urlTienda: string; alGuardar: (x: ProductoWeb) => void }) {
  const puede = estado.tiene('tienda.configurar');
  const [antes, setAntes] = useState(p.precio_antes ? String(p.precio_antes) : '');
  useEffect(() => { setAntes(p.precio_antes ? String(p.precio_antes) : ''); }, [p.precio_antes]);
  const guardar = async (cambios: Partial<ProductoWeb>) => {
    try { const x = await api.put<ProductoWeb>(`/api/tienda/productos/${p.id}`, cambios); alGuardar(x); }
    catch (e) { mostrarError(e); setAntes(p.precio_antes ? String(p.precio_antes) : ''); }
  };
  const guardarAntes = () => {
    const v = Number(antes.replace(/\D/g, '')) || null;
    if (v === (p.precio_antes || null)) return;
    void guardar({ precio_antes: v });
  };
  return (
    <tr className={p.visible ? '' : 'tw-oculto'}>
      <td><div className="thumb">{p.foto ? <img src={`/api/archivos/${p.foto}`} alt="" loading="lazy" /> : <Icono nombre="image" tam={18} />}</div></td>
      <td className="celda-resp">
        <a href={`#/inventario/${p.id}`} className="bold">{p.nombre}</a>
        <div className="xs muted">{p.categoria_nombre || 'Sin categoría'}{!p.fotos ? ' · sin fotos' : ` · ${plural(p.fotos, 'foto', 'fotos')}`}</div>
        {p.publicado && p.motivos_oculto.length > 0 && <div className="xs" style={{ color: 'var(--warn)' }}>No se ve: {p.motivos_oculto.join(', ')}</div>}
      </td>
      <td className="n">{fmt.cop(p.precio_venta)}</td>
      <td className="n"><span className={`stock-badge ${p.stock <= 0 ? 'cero' : p.stock <= 3 ? 'bajo' : ''}`}>{fmt.num(p.stock)}</span></td>
      <td className="center"><input type="checkbox" className="tw-check" checked={p.publicado} disabled={!puede} onChange={(e) => void guardar({ publicado: e.target.checked })} aria-label={`Publicar ${p.nombre}`} /></td>
      <td className="center"><input type="checkbox" className="tw-check" checked={p.destacado} disabled={!puede} onChange={(e) => void guardar({ destacado: e.target.checked })} aria-label={`Destacar ${p.nombre}`} /></td>
      <td><input type="text" inputMode="numeric" className="tw-antes" value={antes ? fmt.cop(Number(antes.replace(/\D/g, ''))) : ''} placeholder="—" disabled={!puede} onChange={(e) => setAntes(e.target.value.replace(/\D/g, ''))} onBlur={guardarAntes} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} aria-label={`Precio antes de ${p.nombre}`} /></td>
      <td>{urlTienda && p.visible ? <a className="btn icono chico fantasma" href={`${urlTienda}/producto/${p.slug}`} target="_blank" rel="noopener" title="Ver en la tienda"><Icono nombre="external" tam={16} /></a> : null}</td>
    </tr>
  );
}

function Productos({ urlTienda }: { urlTienda: string }) {
  const [filtro, setFiltro] = useState('todos');
  const [q, setQ] = useState('');
  const [datos, setDatos] = useState<{ productos: ProductoWeb[]; totales: Record<string, number> } | null>(null);
  const cargar = useCallback(() => { api.get<{ productos: ProductoWeb[]; totales: Record<string, number> }>(`/api/tienda/productos${api.qs({ filtro, q: q.trim() || undefined })}`).then(setDatos).catch(mostrarError); }, [filtro, q]);
  useEffect(() => { const t = setTimeout(cargar, q ? 250 : 0); return () => clearTimeout(t); }, [cargar, q]);
  const actualizar = (x: ProductoWeb) => { setDatos((d) => d && { ...d, productos: d.productos.map((p) => (p.id === x.id ? x : p)) }); toast('Tienda actualizada', 'ok'); };
  const t = datos?.totales || {};
  const FILTROS = [['todos', 'Todos', t.todos], ['visibles', 'Se ven en la página', t.visibles], ['ocultos', 'Ocultos', (t.todos || 0) - (t.visibles || 0)], ['destacados', 'Destacados', t.destacados], ['sin_fotos', 'Sin fotos', t.sin_fotos]] as const;
  return (
    <>
      <p className="intro-modulo">Elige qué productos se ven en la página. El precio, la descripción y las fotos se editan en <a href="#/inventario">Inventario</a>; los productos sin foto se muestran con una ilustración de su categoría. "Precio antes" muestra el producto como oferta (debe ser mayor que el precio actual).</p>
      <div className="filtros">
        <div className="pills">{FILTROS.map(([c, txt, n]) => <button key={c} type="button" className={`pill${filtro === c ? ' activo' : ''}`} onClick={() => setFiltro(c)}>{txt} <span className="tw-n">{n ?? 0}</span></button>)}</div>
        <div className="buscador grow" style={{ maxWidth: 320 }}><Icono nombre="search" /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" /></div>
      </div>
      {!datos ? <div className="cargando">Cargando productos…</div> : (
        <div className="tabla-wrap">
          <table className="tabla tw-tabla">
            <thead><tr><th /><th>Producto</th><th className="n">Precio</th><th className="n">Stock</th><th className="center">Publicado</th><th className="center">Destacado</th><th>Precio antes</th><th /></tr></thead>
            <tbody>{datos.productos.map((p) => <FilaProducto key={p.id} p={p} urlTienda={urlTienda} alGuardar={actualizar} />)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ====================================================================================================================
// Ajustes
// ====================================================================================================================
const numONulo = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(/\D/g, '')) || 0);
const texto = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

function AjustesTienda({ a, alGuardar }: { a: Ajustes; alGuardar: (x: Ajustes) => void }) {
  const puede = estado.tiene('tienda.configurar');
  const [f, setF] = useState(() => ({
    ...a, mensajes: a.mensajes_barra.join('\n'),
    local_costo: texto(a.envio.local_costo), nacional_costo: texto(a.envio.nacional_costo), gratis_desde: texto(a.envio.gratis_desde),
  }));
  const [celulares, setCelulares] = useState<ProductoWeb[]>([]);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { api.get<{ productos: ProductoWeb[] }>('/api/tienda/productos').then((d) => setCelulares(d.productos.filter((p) => p.grupo === 'celulares' || p.grupo === 'usados'))).catch(() => undefined); }, []);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const planes = f.credito.planes;
  const setPlanes = (p: Plan[]) => set('credito', { ...f.credito, planes: p });

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    try {
      const x = await api.put<Ajustes>('/api/tienda/ajustes', {
        activa: f.activa, url_tienda: f.url_tienda, publicar_por_defecto: f.publicar_por_defecto, mostrar_agotados: f.mostrar_agotados,
        whatsapp: f.whatsapp, horario: f.horario, mapa_url: f.mapa_url, mensajes_barra: f.mensajes.split('\n'),
        envio: { local_nombre: f.envio.local_nombre, local_costo: numONulo(f.local_costo), nacional: f.envio.nacional, nacional_costo: numONulo(f.nacional_costo), gratis_desde: numONulo(f.gratis_desde) },
        pagos: f.pagos, credito: f.credito, producto_insignia_id: f.producto_insignia_id, redes: f.redes,
      });
      alGuardar(x); toast('Ajustes de la tienda guardados', 'ok');
    } catch (err) { mostrarError(err); } finally { setOcupado(false); }
  };

  return (
    <form onSubmit={guardar} className="tw-ajustes">
      <fieldset disabled={!puede} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="card">
          <h2>General</h2>
          <label className="check"><input type="checkbox" checked={f.activa} onChange={(e) => set('activa', e.target.checked)} />La tienda recibe pedidos en línea</label>
          <label className="check"><input type="checkbox" checked={f.publicar_por_defecto} onChange={(e) => set('publicar_por_defecto', e.target.checked)} />Publicar automáticamente los productos nuevos con precio</label>
          <label className="check"><input type="checkbox" checked={f.mostrar_agotados} onChange={(e) => set('mostrar_agotados', e.target.checked)} />Mostrar productos agotados (con "Avísame cuando llegue")</label>
          <div className="grid2 mt">
            <div className="campo"><label>Dirección de la tienda</label><input type="text" value={f.url_tienda} onChange={(e) => set('url_tienda', e.target.value)} placeholder="https://segy.com.co" /><span className="ayuda">Para el botón "Ver tienda" y el enlace de seguimiento que se comparte con el cliente.</span></div>
            <div className="campo"><label>WhatsApp de la tienda</label><input type="tel" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder={a.whatsapp_efectivo || '573180000000'} /><span className="ayuda">Con indicativo de país. Vacío = se usa el teléfono del negocio ({a.whatsapp_efectivo || 'sin teléfono'}).</span></div>
            <div className="campo"><label>Horario</label><input type="text" value={f.horario} onChange={(e) => set('horario', e.target.value)} placeholder="Lunes a sábado de 9:00 a. m. a 7:00 p. m." /></div>
            <div className="campo"><label>Enlace del mapa (opcional)</label><input type="text" value={f.mapa_url} onChange={(e) => set('mapa_url', e.target.value)} placeholder="https://maps.app.goo.gl/…" /></div>
          </div>
          <div className="campo"><label>Mensajes de la barra superior (uno por línea, máximo 4)</label><textarea rows={3} value={f.mensajes} onChange={(e) => set('mensajes', e.target.value)} /></div>
        </div>

        <div className="card">
          <h2>Envíos</h2>
          <p className="muted small mb">Deja un valor vacío para que se confirme con el cliente por WhatsApp.</p>
          <div className="grid3">
            <div className="campo"><label>Nombre del domicilio local</label><input type="text" value={f.envio.local_nombre} onChange={(e) => set('envio', { ...f.envio, local_nombre: e.target.value })} /></div>
            <div className="campo"><label>Costo del domicilio local</label><input type="text" inputMode="numeric" data-money value={f.local_costo} onChange={(e) => set('local_costo', e.target.value)} placeholder="Por confirmar" /></div>
            <div className="campo"><label>Envío gratis desde</label><input type="text" inputMode="numeric" data-money value={f.gratis_desde} onChange={(e) => set('gratis_desde', e.target.value)} placeholder="Sin envío gratis" /></div>
          </div>
          <label className="check"><input type="checkbox" checked={f.envio.nacional} onChange={(e) => set('envio', { ...f.envio, nacional: e.target.checked })} />Enviamos a otras ciudades</label>
          {f.envio.nacional && <div className="campo" style={{ maxWidth: 280 }}><label>Costo del envío nacional</label><input type="text" inputMode="numeric" data-money value={f.nacional_costo} onChange={(e) => set('nacional_costo', e.target.value)} placeholder="Por confirmar" /></div>}
        </div>

        <div className="card">
          <h2>Formas de pago</h2>
          {Object.entries(PAGOS).map(([k, v]) => (
            <label key={k} className="check"><input type="checkbox" checked={f.pagos.includes(k)} onChange={(e) => set('pagos', e.target.checked ? [...f.pagos, k] : f.pagos.filter((x) => x !== k))} />{v}</label>
          ))}
        </div>

        <div className="card">
          <h2>Crédito SEGY</h2>
          <p className="muted small mb">Mismas reglas que el módulo Créditos: el interés es el porcentaje total sobre el saldo financiado. La página lo muestra como simulación referencial.</p>
          <label className="check"><input type="checkbox" checked={f.credito.activo} onChange={(e) => set('credito', { ...f.credito, activo: e.target.checked })} />Ofrecer crédito en la página</label>
          <div className="campo" style={{ maxWidth: 240 }}><label>Cuota inicial mínima (%)</label><input type="number" min={0} max={90} value={f.credito.cuota_inicial_min_pct} onChange={(e) => set('credito', { ...f.credito, cuota_inicial_min_pct: Number(e.target.value) })} /></div>
          <div className="tw-planes">
            {planes.map((p, i) => (
              <div key={i} className="row">
                <div className="campo"><label>Cuotas</label><input type="number" min={1} max={48} value={p.cuotas} onChange={(e) => setPlanes(planes.map((x, j) => (j === i ? { ...x, cuotas: Number(e.target.value) } : x)))} /></div>
                <div className="campo"><label>Interés total (%)</label><input type="number" min={0} max={100} step={0.1} value={p.interes_pct} onChange={(e) => setPlanes(planes.map((x, j) => (j === i ? { ...x, interes_pct: Number(e.target.value) } : x)))} /></div>
                <button type="button" className="btn icono chico fantasma" onClick={() => setPlanes(planes.filter((_, j) => j !== i))} aria-label="Quitar plan" disabled={planes.length <= 1}><Icono nombre="trash" tam={16} /></button>
              </div>
            ))}
            {planes.length < 8 && <button type="button" className="btn suave chico" onClick={() => setPlanes([...planes, { cuotas: (planes[planes.length - 1]?.cuotas || 0) + 6, interes_pct: 0 }])}><Icono nombre="plus" tam={16} /> Agregar plan</button>}
          </div>
        </div>

        <div className="card">
          <h2>Portada y redes</h2>
          <div className="campo"><label>Producto de la experiencia 3D de la portada</label>
            <select value={f.producto_insignia_id ?? ''} onChange={(e) => set('producto_insignia_id', e.target.value ? Number(e.target.value) : null)}>
              <option value="">Automático: {a.insignia && !a.producto_insignia_id ? a.insignia.nombre : 'el primero llamado "iPhone 17 Pro Max"'}</option>
              {celulares.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <span className="ayuda">Precio, cuotas y disponibilidad salen de este producto. Los textos de la experiencia están en tienda/src/contenido/insignia.ts.</span>
          </div>
          <div className="grid3">
            {(['instagram', 'facebook', 'tiktok'] as const).map((r) => <div key={r} className="campo"><label>{r === 'tiktok' ? 'TikTok' : r[0].toUpperCase() + r.slice(1)}</label><input type="text" value={f.redes[r]} onChange={(e) => set('redes', { ...f.redes, [r]: e.target.value })} placeholder="https://…" /></div>)}
          </div>
        </div>

        <div className={`alerta ${a.seguimiento_activo ? 'neutra' : 'aviso'} mt`}>
          {a.seguimiento_activo ? 'El seguimiento web está activo: visitas, productos vistos y clics de WhatsApp de la tienda llegan a Marketing.' : <>Activa el seguimiento web en <a href="#/marketing">Marketing › Integraciones</a> para medir las visitas de la tienda. Los pedidos y solicitudes llegan a Marketing de todos modos.</>}
        </div>
      </fieldset>
      {puede && <div className="form-pie"><button type="submit" className="btn primario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar ajustes'}</button></div>}
    </form>
  );
}

// ====================================================================================================================
// Pantalla
// ====================================================================================================================
const PESTANAS = [{ clave: 'pedidos', texto: 'Pedidos' }, { clave: 'productos', texto: 'Productos en la web' }, { clave: 'ajustes', texto: 'Ajustes' }];

export function Tienda({ ruta, setTopbar }: { ruta: Ruta; setTopbar: (t: Topbar) => void }) {
  const pestana = PESTANAS.some((p) => p.clave === ruta.partes[1]) ? ruta.partes[1] : 'pedidos';
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  useEffect(() => { api.get<Ajustes>('/api/tienda/ajustes').then(setAjustes).catch(mostrarError); }, []);
  const url = ajustes?.url_tienda || '';
  useEffect(() => {
    setTopbar({ titulo: 'Tienda web', acciones: url ? [{ icono: 'external', texto: 'Ver tienda', clase: 'suave chico', href: url }] : [] });
  }, [setTopbar, url]);
  const contenido = useMemo(() => {
    if (pestana === 'productos') return <Productos urlTienda={url} />;
    if (pestana === 'ajustes') return ajustes ? <AjustesTienda key={JSON.stringify(ajustes)} a={ajustes} alGuardar={setAjustes} /> : <div className="cargando">Cargando…</div>;
    return <Pedidos urlTienda={url} />;
  }, [pestana, url, ajustes]);
  return (
    <div className="tw">
      <div className="tabs" role="tablist">
        {PESTANAS.map((p) => <button key={p.clave} type="button" role="tab" aria-selected={pestana === p.clave} className={pestana === p.clave ? 'activo' : ''} onClick={() => { location.hash = `#/tienda/${p.clave}`; }}>{p.texto}</button>)}
      </div>
      {contenido}
    </div>
  );
}
