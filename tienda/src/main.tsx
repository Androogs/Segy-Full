// Entrada de la tienda (React + TypeScript, servida por Vite).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/inter/wght.css';
import './estilos/base.css';
import './estilos/componentes.css';
import './estilos/experiencia.css';
import './estilos/paginas.css';
import { App } from './App';
import { prepararOrigen } from './lib/seguimiento';

prepararOrigen();
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
createRoot(document.getElementById('raiz')!).render(<StrictMode><App /></StrictMode>);
