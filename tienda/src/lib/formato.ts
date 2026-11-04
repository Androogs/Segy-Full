// Formato colombiano (pesos sin decimales) y cálculo de cuotas con la misma regla del módulo Créditos del panel:
// saldo financiado = (precio − cuota inicial) × (1 + interés total %) y cuota = saldo financiado ÷ número de cuotas.
import type { PlanCredito } from './tipos';

const fmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
export const pesos = (n: number | null | undefined): string => `$ ${fmt.format(Math.round(Number(n) || 0))}`;
export const numero = (n: number): string => fmt.format(n);

export interface Simulacion { inicial: number; financiado: number; cuota: number; cuotas: number; interes_pct: number }
export function simular(precio: number, plan: PlanCredito, inicialPct: number): Simulacion {
  const inicial = Math.ceil((precio * inicialPct) / 100 / 1000) * 1000;
  const saldo = Math.max(0, precio - inicial);
  const financiado = Math.round(saldo * (1 + (Number(plan.interes_pct) || 0) / 100));
  const cuota = Math.ceil(financiado / Math.max(1, plan.cuotas) / 100) * 100;
  return { inicial, financiado, cuota, cuotas: plan.cuotas, interes_pct: Number(plan.interes_pct) || 0 };
}
// El plan de más cuotas da la cuota más baja: es la que se anuncia como "desde".
export function cuotaDesde(precio: number, planes: PlanCredito[], inicialPct: number): Simulacion | null {
  if (!planes.length || precio <= 0) return null;
  const largo = [...planes].sort((a, b) => b.cuotas - a.cuotas)[0];
  return simular(precio, largo, inicialPct);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function fechaLarga(t: string): string {
  const [f, h = ''] = String(t).split(' ');
  const [y, m, d] = f.split('-').map(Number);
  if (!y || !m || !d) return t;
  const hora = h ? `, ${h.slice(0, 5)}` : '';
  return `${d} de ${MESES[m - 1]} de ${y}${hora}`;
}
export const plural = (n: number, uno: string, varios: string): string => `${numero(n)} ${n === 1 ? uno : varios}`;
