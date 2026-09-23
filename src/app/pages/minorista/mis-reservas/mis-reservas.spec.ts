import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MisReservas } from './mis-reservas';
import type { PagoMovimiento, Comision } from '../../../models/database.types';

// Venta de $100.000: seña 30% ($30.000) + 3 cuotas con 10% de recargo ($25.667 c/u) = $107.000
const PLAN = { porcentaje_pago: 30, cuotas: 3, recargo: 10 };

let nextId = 1;
function pago(reservaId: number, tipo: 'seña' | 'cuota', estado: PagoMovimiento['estado_pago'], extra: Partial<PagoMovimiento> = {}): PagoMovimiento {
  return {
    id: nextId++, reserva_id: reservaId, tipo, estado_pago: estado,
    monto: tipo === 'seña' ? 30000 : 25667,
    cuota_numero: null, cuotas_totales: tipo === 'cuota' ? 3 : null,
    metodo_pago: 'transferencia', referencia: null, created_at: '2026-09-01', ...extra,
  };
}

function cuotas(reservaId: number, estados: [string, Partial<PagoMovimiento>?][]): PagoMovimiento[] {
  return estados.map(([estado, extra], i) => pago(reservaId, 'cuota', estado as any, { cuota_numero: i + 1, ...extra }));
}

function reserva(id: number, estado: string, pagos: PagoMovimiento[], datos: Record<string, unknown> = {}) {
  return {
    id, estado, viaje_id: 1, vendedor_id: 'v1', asiento_viaje_id: id, comprobante_url: null, tipo_pago: 'parcial',
    motivo_rechazo: estado === 'rechazado' ? 'Comprobante ilegible' : null, created_at: '2026-09-01',
    pasajero_datos: { nombre: `Cliente${id}`, apellido: 'Test', ...PLAN, grupo_id: `g${id}`, ...datos },
    viajeLabel: 'Paraná → Mendoza', pasajeroNombre: `Cliente${id} Test`, monto: 100000,
    uploading: false, uploadMsg: '', uploadOk: false, pagos,
    viaje: { fecha_salida: '2026-10-01T08:00:00Z' },
  } as any;
}

describe('MisReservas', () => {
  let comp: MisReservas;
  const pagoService = { informarPagoCuotas: vi.fn().mockResolvedValue({ error: null }) };
  const storageService = {
    subirComprobante: vi.fn().mockResolvedValue({ error: null }),
    getComprobanteUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://x/comprobante.jpg' }, error: null }),
  };
  const authService = { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'v1' } } } }) };

  function cargar(...reservas: any[]) {
    comp.reservas = reservas;
    (comp as any).armarGrupos();
    return comp.grupos;
  }

  beforeEach(() => {
    nextId = 1;
    vi.clearAllMocks();
    comp = new MisReservas(authService as any, null as any, null as any, storageService as any, pagoService as any, null as any, null as any, { detectChanges: () => {} } as any);
    comp.porcentajeComision = 10;
  });

  describe('etapa', () => {
    it('falta subir el comprobante de la seña → requiere acción', () => {
      const [g] = cargar(reserva(1, 'pendiente_comprobante', [pago(1, 'seña', 'pendiente')]));
      expect(comp.etapa(g)).toBe('falta_comprobante');
      expect(comp.etapaInfo(g).accion).toBe(true);
    });

    it('seña subida esperando al admin', () => {
      const [g] = cargar(reserva(1, 'pendiente_validacion', [pago(1, 'seña', 'pendiente')]));
      expect(comp.etapa(g)).toBe('en_validacion');
      expect(comp.etapaInfo(g).accion).toBe(false);
    });

    it('seña aprobada y cuotas sin informar → pagando', () => {
      const [g] = cargar(reserva(1, 'aprobado', [pago(1, 'seña', 'confirmado'), ...cuotas(1, [['confirmado'], ['pendiente'], ['pendiente']])]));
      expect(comp.etapa(g)).toBe('pagando');
      expect(comp.etapaDetalle(g)).toContain('Cuota 2/3');
    });

    it('cuota con comprobante subido → en validación', () => {
      const [g] = cargar(reserva(1, 'aprobado', [pago(1, 'seña', 'confirmado'), ...cuotas(1, [['pendiente', { comprobante_url: 'x' }], ['pendiente'], ['pendiente']])]));
      expect(comp.etapa(g)).toBe('cuota_en_validacion');
    });

    it('comprobante de cuota rechazado → muestra el motivo y pide uno nuevo', () => {
      const [g] = cargar(reserva(1, 'aprobado', [pago(1, 'seña', 'confirmado'), ...cuotas(1, [['pendiente', { motivo_rechazo: 'Monto incorrecto' }], ['pendiente'], ['pendiente']])]));
      expect(comp.etapa(g)).toBe('cuota_rechazada');
      expect(comp.etapaInfo(g).accion).toBe(true);
      expect(comp.etapaDetalle(g)).toContain('Monto incorrecto');
    });

    it('todo pagado', () => {
      const [g] = cargar(reserva(1, 'aprobado', [pago(1, 'seña', 'confirmado'), ...cuotas(1, [['confirmado'], ['confirmado'], ['confirmado']])]));
      expect(comp.etapa(g)).toBe('pagada');
    });

    it('rechazada muestra el motivo', () => {
      const [g] = cargar(reserva(1, 'rechazado', [pago(1, 'seña', 'rechazado')]));
      expect(comp.etapa(g)).toBe('rechazada');
      expect(comp.etapaDetalle(g)).toBe('Comprobante ilegible');
    });
  });

  describe('cuotasGrupo', () => {
    it('junta la cuota N de cada asiento del grupo', () => {
      const datos = { grupo_id: 'familia' };
      const [g] = cargar(
        reserva(1, 'aprobado', [pago(1, 'seña', 'confirmado'), ...cuotas(1, [['confirmado'], ['pendiente'], ['pendiente']])], datos),
        reserva(2, 'aprobado', [pago(2, 'seña', 'confirmado'), ...cuotas(2, [['confirmado'], ['pendiente'], ['pendiente']])], datos),
      );
      const c = comp.cuotasGrupo(g);
      expect(c.map(x => x.estado)).toEqual(['pagada', 'pendiente', 'pendiente']);
      expect(c[1].monto).toBe(25667 * 2);
      expect(c[1].idsAInformar).toHaveLength(2);
    });
  });

  describe('comisionGrupo', () => {
    it('proyecta la comisión sobre el total de la venta mientras se paga', () => {
      const [g] = cargar(reserva(1, 'aprobado', [pago(1, 'seña', 'confirmado'), ...cuotas(1, [['pendiente'], ['pendiente'], ['pendiente']])]));
      expect(comp.comisionGrupo(g)).toEqual({ estado: 'proxima', monto: 10700 });
    });

    it('usa la comisión generada y su estado', () => {
      comp.comisionesPorReserva = new Map([[1, { reserva_id: 1, monto_comision: 10700, estado: 'pagado' } as Comision]]);
      const [g] = cargar(reserva(1, 'aprobado', [pago(1, 'seña', 'confirmado')]));
      expect(comp.comisionGrupo(g)).toEqual({ estado: 'cobrada', monto: 10700 });
    });

    it('sin comisión en reservas rechazadas', () => {
      const [g] = cargar(reserva(1, 'rechazado', []));
      expect(comp.comisionGrupo(g)).toBeNull();
    });
  });

  describe('filtros y resumen', () => {
    beforeEach(() => {
      cargar(
        reserva(1, 'pendiente_comprobante', [pago(1, 'seña', 'pendiente')]),
        reserva(2, 'pendiente_validacion', [pago(2, 'seña', 'pendiente')]),
        reserva(3, 'aprobado', [pago(3, 'seña', 'confirmado'), ...cuotas(3, [['confirmado'], ['confirmado'], ['confirmado']])]),
        reserva(4, 'rechazado', []),
      );
    });

    it('cuenta por filtro', () => {
      expect(comp.cantidadPorFiltro('accion')).toBe(1);
      expect(comp.cantidadPorFiltro('curso')).toBe(2);
      expect(comp.cantidadPorFiltro('pagadas')).toBe(1);
      expect(comp.cantidadPorFiltro('rechazadas')).toBe(1);
    });

    it('lo que requiere acción aparece primero', () => {
      expect(comp.gruposFiltrados[0].reservas[0].id).toBe(1);
    });

    it('busca por nombre de cliente', () => {
      comp.busqueda = 'cliente3';
      expect(comp.gruposFiltrados.map(g => g.reservas[0].id)).toEqual([3]);
    });

    it('el saldo de clientes no cuenta las rechazadas', () => {
      expect(comp.resumen.saldoClientes).toBe(107000 * 2);
    });
  });

  it('informar cuota sube el comprobante, lo asocia a la cuota de cada asiento y limpia el motivo anterior', async () => {
    const [g] = cargar(reserva(1, 'aprobado', [pago(1, 'seña', 'confirmado'), ...cuotas(1, [['pendiente', { motivo_rechazo: 'Borroso' }], ['pendiente'], ['pendiente']])]));
    comp.abrirInformarCuota(g);
    const cuota = comp.cuotaSeleccionada!;
    const archivo = new File(['x'], 'pago.jpg');
    await comp.informarCuota({ target: { files: [archivo] } } as any);

    expect(pagoService.informarPagoCuotas).toHaveBeenCalledWith(cuota.idsAInformar, 'https://x/comprobante.jpg');
    expect(comp.etapa(g)).toBe('cuota_en_validacion');
    expect(comp.grupoCuota).toBeNull();
  });
});
