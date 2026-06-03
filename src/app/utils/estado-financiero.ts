import type { EstadoValidacion, TipoPago, EstadoFinanciero } from '../models/database.types';

export function derivarEstadoFinanciero(estado: EstadoValidacion | null | undefined, tipoPago: TipoPago | null | undefined): EstadoFinanciero {
  if (estado === 'aprobado') {
    return tipoPago === 'total' ? 'pagado_total' : 'pagado_parcial';
  }
  if (estado === 'rechazado') return 'reembolso_pendiente';
  return 'pendiente';
}

export function estadoFinancieroLabel(estado: EstadoFinanciero | null | undefined): string {
  const map: Record<string, string> = {
    pendiente: 'Pendiente',
    pagado_parcial: 'Pagado parcial',
    pagado_total: 'Pagado total',
    reembolso_pendiente: 'Reembolso pendiente',
    reembolsado: 'Reembolsado',
  };
  return estado ? map[estado] || estado : 'Pendiente';
}

export function estadoFinancieroClass(estado: EstadoFinanciero | null | undefined): string {
  const map: Record<string, string> = {
    pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
    pagado_parcial: 'bg-blue-50 text-blue-700 border-blue-200',
    pagado_total: 'bg-green-50 text-green-700 border-green-200',
    reembolso_pendiente: 'bg-orange-50 text-orange-700 border-orange-200',
    reembolsado: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return estado ? map[estado] || map['pendiente'] : map['pendiente'];
}

export function estadoFinancieroDot(estado: EstadoFinanciero | null | undefined): string {
  const map: Record<string, string> = {
    pendiente: 'bg-amber-500',
    pagado_parcial: 'bg-blue-500',
    pagado_total: 'bg-green-500',
    reembolso_pendiente: 'bg-orange-500',
    reembolsado: 'bg-slate-400',
  };
  return estado ? map[estado] || map['pendiente'] : map['pendiente'];
}
