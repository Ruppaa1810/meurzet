import { describe, it, expect } from 'vitest';
import { calcularFinanciero, montoPagadoConfirmado, parsearPagoPasajero, totalVentaReserva } from './calculo-financiero';
import type { PagoMovimiento } from '../models/database.types';

const pago = (monto: number, estado_pago: PagoMovimiento['estado_pago'] = 'confirmado'): PagoMovimiento =>
  ({ id: 1, reserva_id: 1, monto, estado_pago, metodo_pago: 'transferencia', referencia: null, tipo: 'cuota', cuota_numero: 1, cuotas_totales: 1, created_at: '' });

describe('calcularFinanciero', () => {
  it('seña del 30% y saldo en 3 cuotas con 10% de recargo', () => {
    const c = calcularFinanciero(100000, 30, 3, 10, 0);
    expect(c.montoAPagar).toBe(30000);
    expect(c.saldoBase).toBe(70000);
    expect(c.saldoConRecargo).toBe(77000);
    expect(c.totalFinal).toBe(107000);
    expect(c.montoPorCuota).toBe(25667);
  });

  it('con una sola cuota no aplica recargo', () => {
    const c = calcularFinanciero(100000, 30, 1, 10, 0);
    expect(c.saldoConRecargo).toBe(70000);
    expect(c.totalFinal).toBe(100000);
  });

  it('pago total: sin saldo', () => {
    const c = calcularFinanciero(50000, 100, 0, 0, 50000);
    expect(c.totalFinal).toBe(50000);
    expect(c.montoPendiente).toBe(0);
    expect(c.porcentajePagado).toBe(100);
  });

  it('el pendiente nunca es negativo aunque el redondeo de cuotas pague de más', () => {
    const c = calcularFinanciero(100000, 30, 3, 10, 30000 + 25667 * 3);
    expect(c.montoPendiente).toBe(0);
    expect(c.porcentajePagado).toBe(100);
  });
});

describe('montoPagadoConfirmado', () => {
  it('solo suma pagos confirmados', () => {
    expect(montoPagadoConfirmado([pago(1000), pago(500, 'pendiente'), pago(200, 'rechazado'), pago(300)])).toBe(1300);
  });
});

describe('parsearPagoPasajero', () => {
  it('usa valores por defecto si faltan datos (reservas viejas)', () => {
    expect(parsearPagoPasajero({})).toEqual({ porcentajePago: 100, metodoPago: 'transferencia', cuotas: 0, recargo: 0, grupoId: '' });
  });

  it('respeta porcentaje 0 guardado explícitamente', () => {
    expect(parsearPagoPasajero({ porcentaje_pago: 0 }).porcentajePago).toBe(0);
  });
});

describe('totalVentaReserva', () => {
  it('calcula el total con el plan guardado en pasajero_datos', () => {
    const datos = { porcentaje_pago: 30, cuotas: 3, recargo: 10 };
    const c = totalVentaReserva(100000, datos, [pago(30000), pago(25667)]);
    expect(c.totalFinal).toBe(107000);
    expect(c.montoPendiente).toBe(107000 - 55667);
  });
});
