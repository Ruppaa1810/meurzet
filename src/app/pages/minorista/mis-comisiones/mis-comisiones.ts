import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComisionService } from '../../../services/comision.service';
import { PerfilService } from '../../../services/perfil.service';
import { ReservaService } from '../../../services/reserva.service';
import { PagoService } from '../../../services/pago.service';
import type { Comision, PagoMovimiento } from '../../../models/database.types';
import { totalVentaReserva } from '../../../utils/calculo-financiero';

type ViajeResumen = { origen: string; destino: string; fecha_salida: string } | null;
type ComisionConReserva = Comision & { reserva: { pasajero_datos: Record<string, any>; viaje: ViajeResumen } | null };

/** Comisión que se va a generar cuando el cliente termine de pagar. */
interface ComisionProxima {
  reservaId: number;
  cliente: string;
  viaje: ViajeResumen;
  faltaCobrar: number;
  monto: number;
}

@Component({
  selector: 'app-mis-comisiones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mis-comisiones.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisComisiones implements OnInit {
  comisiones: ComisionConReserva[] = [];
  proximas: ComisionProxima[] = [];
  porcentaje = 0;
  loading = true;
  resumen = { totalGenerado: 0, totalPendiente: 0, totalPagado: 0 };

  constructor(
    private comisionService: ComisionService,
    private perfilService: PerfilService,
    private reservaService: ReservaService,
    private pagoService: PagoService,
    private cdr: ChangeDetectorRef,
  ) {}

  get totalProximas(): number {
    return this.proximas.reduce((s, p) => s + p.monto, 0);
  }

  async ngOnInit() {
    const { data: perfil } = await this.perfilService.getCurrentProfile();
    if (perfil?.id) {
      const [{ data }, resumen, { data: config }, { data: reservas }] = await Promise.all([
        this.comisionService.getComisionesByVendedor(perfil.id),
        this.comisionService.getResumenByVendedor(perfil.id),
        this.comisionService.getConfigByVendedor(perfil.id),
        this.reservaService.getReservasPorVendedorConViaje(perfil.id),
      ]);
      this.comisiones = (data || []) as ComisionConReserva[];
      this.resumen = resumen;
      this.porcentaje = config?.activo ? config.porcentaje : 0;

      const conComision = new Set(this.comisiones.map(c => c.reserva_id));
      const enCurso = (reservas || []).filter(r => r.estado !== 'rechazado' && !conComision.has(r.id));
      if (this.porcentaje > 0 && enCurso.length) {
        const { data: pagos } = await this.pagoService.getPagosPorReservas(enCurso.map(r => r.id));
        this.proximas = enCurso.map(r => {
          const viaje = (r as any).viaje;
          const calc = totalVentaReserva(viaje?.precio_base || 0, r.pasajero_datos, (pagos || []).filter((p: PagoMovimiento) => p.reserva_id === r.id));
          return {
            reservaId: r.id,
            cliente: this.nombrePasajero(r.pasajero_datos),
            viaje,
            faltaCobrar: calc.montoPendiente,
            monto: Math.round(calc.totalFinal * this.porcentaje / 100),
          };
        });
      }
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  formatPrecio(v: number): string {
    return `$ ${v.toLocaleString('es-AR')}`;
  }

  formatFecha(f: string): string {
    return new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  nombrePasajero(d: Record<string, any> | undefined): string {
    return [d?.['nombre'], d?.['apellido']].filter(Boolean).join(' ') || '-';
  }

  viajeLabel(v: ViajeResumen): string {
    return v ? `${v.origen} → ${v.destino} · ${this.formatFecha(v.fecha_salida)}` : '-';
  }
}
