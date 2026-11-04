// Raíz de la tienda: proveedores (datos del negocio y carrito), estructura y rutas.
import { Component, useEffect, type ReactNode } from 'react';
import { ProveedorNegocio } from './lib/negocio';
import { ProveedorCarrito, useCarrito } from './lib/carrito';
import { useRuta } from './lib/ruta';
import { Encabezado } from './componentes/Encabezado';
import { PieDePagina } from './componentes/PieDePagina';
import { CarritoLateral } from './componentes/CarritoLateral';
import { AstroFlotante } from './componentes/AstroFlotante';
import { Inicio } from './paginas/Inicio';
import { Catalogo } from './paginas/Catalogo';
import { Producto } from './paginas/Producto';
import { Carrito } from './paginas/Carrito';
import { Pagar } from './paginas/Pagar';
import { Pedido } from './paginas/Pedido';
import { Retoma } from './paginas/Retoma';
import { Credito } from './paginas/Credito';
import { ServicioTecnico } from './paginas/ServicioTecnico';
import { Visitanos } from './paginas/Visitanos';
import { Legal } from './paginas/Legal';
import { NoEncontrada } from './paginas/NoEncontrada';

function Pagina() {
  const { partes } = useRuta();
  switch (partes[0] || '') {
    case '': return <Inicio />;
    case 'catalogo': return <Catalogo />;
    case 'producto': return partes[1] ? <Producto /> : <NoEncontrada />;
    case 'carrito': return <Carrito />;
    case 'pagar': return <Pagar />;
    case 'pedido': return partes[1] ? <Pedido /> : <NoEncontrada titulo="Falta el enlace del pedido" texto="Abre el enlace completo que te enviamos al hacer el pedido." />;
    case 'retoma': return <Retoma />;
    case 'credito': return <Credito />;
    case 'servicio-tecnico': return <ServicioTecnico />;
    case 'tienda': return <Visitanos />;
    case 'legal': return <Legal />;
    default: return <NoEncontrada />;
  }
}

// Al cambiar de página se cierra el carrito lateral y el foco vuelve al contenido (lectores de pantalla).
function Navegacion() {
  const { camino } = useRuta();
  const { cerrar } = useCarrito();
  useEffect(() => { cerrar(); document.getElementById('contenido')?.focus({ preventScroll: true }); }, [camino, cerrar]);
  return null;
}

class LimiteErrores extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(e: unknown) { console.error('[SEGY] Error en la página', e); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="contenedor error-carga" role="alert">
        <h1 className="titulo-2">Algo salió mal al mostrar esta página</h1>
        <p className="secundario">Recarga para intentarlo de nuevo. Si sigue pasando, escríbenos por WhatsApp.</p>
        <button type="button" className="boton boton--claro" onClick={() => location.reload()}>Recargar</button>
      </div>
    );
  }
}

export function App() {
  return (
    <ProveedorNegocio>
      <ProveedorCarrito>
        <a className="saltar" href="#contenido">Saltar al contenido</a>
        <Encabezado />
        <main id="contenido" tabIndex={-1} style={{ outline: 'none' }}>
          <LimiteErrores><Pagina /></LimiteErrores>
        </main>
        <PieDePagina />
        <CarritoLateral />
        <AstroFlotante />
        <Navegacion />
      </ProveedorCarrito>
    </ProveedorNegocio>
  );
}
