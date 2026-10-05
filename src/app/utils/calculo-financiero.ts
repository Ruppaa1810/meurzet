import type { PagoMovimiento } from '../models/database.types';

export interface CalculoFinanciero {
  montoAPagar: number;
  saldoBase: number;
  saldoConRecargo: number;
  totalFinal: number;
  montoPendiente: number;
  montoPorCuota: number;
  porcentajePagado: number;
}

export function calcularFinanciero(
  totalBase: number,
  porcentajePago: number,
  cuotas: number,
  recargo: number,
  montoPagado: number,
): CalculoFinanciero {
  const montoAPagar = Math.round(totalBase * porcentajePago / 100);
  const saldoBase = Math.max(0, totalBase - montoAPagar);
  const saldoConRecargo = cuotas > 1 ? Math.round(saldoBase * (1 + recargo / 100)) : saldoBase;
  const totalFinal = montoAPagar + saldoConRecargo;
  const montoPendiente = Math.max(0, totalFinal - montoPagado);
  const montoPorCuota = cuotas > 1 ? Math.round(saldoConRecargo / cuotas) : 0;
  const porcentajePagado = totalFinal > 0 ? Math.min(100, Math.round(montoPagado / totalFinal * 100)) : 0;

  return { montoAPagar, saldoBase, saldoConRecargo, totalFinal, montoPendiente, montoPorCuota, porcentajePagado };
}

export function montoPagadoConfirmado(pagos: PagoMovimiento[]): number {
  return pagos.filter(p => p.estado_pago === 'confirmado').reduce((s, p) => s + p.monto, 0);
}

/**
 * Precio al que se vendió el asiento. Se guarda en la reserva al vender: si después cambia el precio
 * del viaje, las reservas ya hechas no se modifican. El precio del viaje queda solo como respaldo.
 */
export function precioUnitario(pasajeroDatos: Record<string, unknown> | null | undefined, precioViaje: number): number {
  const p = pasajeroDatos?.['precio_unitario'];
  return typeof p === 'number' ? p : Number(p) || precioViaje;
}

/** Totales de una reserva (un asiento) según el precio y el plan de pago guardados en pasajero_datos. */
export function totalVentaReserva(precioViaje: number, pasajeroDatos: Record<string, unknown>, pagos: PagoMovimiento[]): CalculoFinanciero {
  const { porcentajePago, cuotas, recargo } = parsearPagoPasajero(pasajeroDatos);
  return calcularFinanciero(precioUnitario(pasajeroDatos, precioViaje), porcentajePago, cuotas, recargo, montoPagadoConfirmado(pagos));
}

export function parsearPagoPasajero(pasajeroDatos: Record<string, unknown>): {
  porcentajePago: number;
  metodoPago: string;
  cuotas: number;
  recargo: number;
  grupoId: string;
} {
  const pd = pasajeroDatos || {};
  return {
    porcentajePago: typeof pd['porcentaje_pago'] === 'number' ? pd['porcentaje_pago'] : 100,
    metodoPago: (pd['metodo_pago'] as string) || 'transferencia',
    cuotas: (pd['cuotas'] as number) || 0,
    recargo: (pd['recargo'] as number) || 0,
    grupoId: (pd['grupo_id'] as string) || '',
  };
}
