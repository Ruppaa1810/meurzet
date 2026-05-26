import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { SupabaseService } from '../../../services/supabase.service';
import { ReservaStateService } from '../../../services/reserva-state.service';

@Component({
  selector: 'app-reserva',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reserva.html',
  styleUrl: './reserva.css',
})
export class Reserva implements OnInit {
  loading = false;
  message = '';

  constructor(
    private router: Router,
    private supabaseService: SupabaseService,
    public reservaState: ReservaStateService,
  ) {}

  ngOnInit() {
    if (!this.reservaState.viaje || this.reservaState.asientos.length === 0) {
      this.router.navigate(['/minorista/inicio']);
    }
  }

  get total(): number {
    return this.reservaState.precio * this.reservaState.asientos.length;
  }

  get montoAPagar(): number {
    return Math.round(this.total * this.reservaState.porcentajePago / 100);
  }

  get montoMinimo(): number {
    return Math.round(this.total * 0.3);
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }

  async confirmarReserva() {
    const { viaje, asientos, pasajeros, porcentajePago } = this.reservaState;

    if (!viaje) return;

    for (let i = 0; i < pasajeros.length; i++) {
      if (!pasajeros[i].nombre || !pasajeros[i].apellido || !pasajeros[i].documento) {
        this.message = `Completá nombre, apellido y documento del pasajero ${i + 1}`;
        return;
      }
    }

    this.loading = true;
    this.message = '';

    const session = await this.supabaseService.supabase.auth.getSession();
    const vendedorId = session.data.session?.user?.id;
    if (!vendedorId) {
      this.message = 'Sesión expirada';
      this.loading = false;
      return;
    }

    const ids: number[] = [];

    for (let i = 0; i < asientos.length; i++) {
      const pasajeroConPago = {
        ...pasajeros[i],
        porcentaje_pago: porcentajePago,
      };
      const { data, error } = await this.supabaseService.crearReserva({
        viaje_id: viaje.id,
        vendedor_id: vendedorId,
        asiento_viaje_id: asientos[i].asientoId,
        pasajero_datos: pasajeroConPago as unknown as Record<string, unknown>,
        tipo_pago: porcentajePago === 100 ? 'total' : 'parcial',
        estado: 'pendiente_comprobante',
        comprobante_url: null,
        motivo_rechazo: null,
      });

      if (error) {
        this.message = error.message;
        this.loading = false;
        return;
      }

      if (data) ids.push(data.id);
    }

    this.reservaState.reservaIds = ids;
    this.loading = false;
    this.router.navigate(['/minorista/confirmacion']);
  }
}
