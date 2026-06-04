import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import type { MetodoPago } from '../../../models/database.types';
import type { ConfigCuota } from '../../../models/config-pagos.types';
import { AuthService } from '../../../services/auth.service';
import { ReservaService } from '../../../services/reserva.service';
import { PagoService } from '../../../services/pago.service';
import { ConfigPagosService } from '../../../services/config-pagos.service';
import { ReservaStateService } from '../../../services/reserva-state.service';

@Component({
  selector: 'app-reserva',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './reserva.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reserva implements OnInit {
  loading = false;
  message = '';
  metodoPago: string = 'transferencia';
  opcionesCuotas: ConfigCuota[] = [];
  cuotasSeleccionadas: number = 1;

  constructor(
    private router: Router,
    private authService: AuthService,
    private reservaService: ReservaService,
    private pagoService: PagoService,
    private configPagosService: ConfigPagosService,
    public reservaState: ReservaStateService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    if (!this.reservaState.viaje || this.reservaState.asientos.length === 0) {
      this.router.navigate(['/minorista/vender'], { replaceUrl: true });
    }
    this.opcionesCuotas = await this.configPagosService.getOpcionesCuotas();
    this.cuotasSeleccionadas = 1;
  }

  volver() {
    const viajeId = this.reservaState.viaje?.id;
    if (viajeId) {
      this.router.navigate(['/minorista/seleccion', viajeId]);
    } else {
      this.router.navigate(['/minorista/vender']);
    }
  }

  get total(): number {
    return this.reservaState.total;
  }

  get totalConRecargo(): number {
    if (this.metodoPago !== 'tarjeta_credito' || this.cuotasSeleccionadas <= 1) return this.total;
    const cuota = this.opcionesCuotas.find(c => c.cuotas === this.cuotasSeleccionadas);
    const recargo = cuota?.recargo || 0;
    return Math.round(this.total * (1 + recargo / 100));
  }

  get montoMinimo(): number {
    return Math.round(this.totalConRecargo * 0.3);
  }

  get recargoPorcentaje(): number {
    if (this.metodoPago !== 'tarjeta_credito' || this.cuotasSeleccionadas <= 1) return 0;
    const cuota = this.opcionesCuotas.find(c => c.cuotas === this.cuotasSeleccionadas);
    return cuota?.recargo || 0;
  }

  get montoAPagar(): number {
    if (this.reservaState.tipoPagoMode === 'personalizado') return this.reservaState.montoPersonalizado;
    return Math.round(this.totalConRecargo * this.reservaState.porcentajePago / 100);
  }

  get montoError(): string {
    const monto = this.reservaState.montoPersonalizado;
    if (this.reservaState.tipoPagoMode !== 'personalizado' || !monto) return '';
    if (monto < this.montoMinimo) return `El mínimo es ${this.formatPrecio(this.montoMinimo)}`;
    if (monto > this.totalConRecargo) return `El máximo es ${this.formatPrecio(this.totalConRecargo)}`;
    return '';
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }

  async confirmarReserva() {
    const { viaje, asientos, pasajeros, porcentajePago, tipoPagoMode } = this.reservaState;

    if (!viaje) return;

    if (this.montoError) {
      this.message = this.montoError;
      return;
    }

    for (let i = 0; i < pasajeros.length; i++) {
      if (!pasajeros[i].nombre || !pasajeros[i].apellido || !pasajeros[i].documento) {
        this.message = `Completá nombre, apellido y documento del pasajero ${i + 1}`;
        return;
      }
    }

    this.loading = true;
    this.message = '';

    try {
      const session = await this.authService.getSession();
      const vendedorId = session.data.session?.user?.id;
      if (!vendedorId) {
        this.message = 'Sesión expirada';
        return;
      }

      const ids: number[] = [];

      for (let i = 0; i < asientos.length; i++) {
        const { data: existente } = await this.reservaService.checkAsientoTieneReserva(asientos[i].asientoId);

        if (existente) {
          this.message = `El asiento ${asientos[i].nroAsiento} ya tiene una reserva activa`;
          return;
        }

        const pasajeroConPago = {
          ...pasajeros[i],
          porcentaje_pago: porcentajePago,
          metodo_pago: this.metodoPago,
          cuotas: this.metodoPago === 'tarjeta_credito' ? this.cuotasSeleccionadas : null,
          recargo: this.recargoPorcentaje,
        };
        const { data, error } = await this.reservaService.crearReserva({
          viaje_id: viaje.id,
          vendedor_id: vendedorId,
          asiento_viaje_id: asientos[i].asientoId,
          pasajero_datos: pasajeroConPago as unknown as Record<string, unknown>,
          tipo_pago: tipoPagoMode === 'total' ? 'total' : 'parcial',
          estado: 'pendiente_comprobante',
          comprobante_url: null,
          motivo_rechazo: null,
        });

        if (error) {
          this.message = error.message;
          return;
        }

        if (data) {
          ids.push(data.id);

          const { error: pagoError } = await this.pagoService.crearPago({
            reserva_id: data.id,
            monto: Math.round(this.montoAPagar / asientos.length),
            metodo_pago: this.metodoPago as MetodoPago,
            referencia: null,
            estado_pago: 'pendiente',
          });

          if (pagoError) {
            this.message = pagoError.message;
            return;
          }

          const { error: recalError } = await this.pagoService.recalcularEstadoFinanciero(data.id, this.total);
          if (recalError) {
            console.warn('Error al recalcular estado financiero:', recalError.message);
          }
        }
      }

      this.reservaState.reservaIds = ids;
      this.reservaState.metodoPago = this.metodoPago;
      this.reservaState.cuotasSeleccionadas = this.cuotasSeleccionadas;
      this.reservaState.recargoAplicado = this.recargoPorcentaje;
      this.router.navigate(['/minorista/confirmacion']);
    } catch (e: any) {
      this.message = e?.message || 'Error inesperado al confirmar la reserva';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}
