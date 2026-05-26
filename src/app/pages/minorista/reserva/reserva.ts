import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { SupabaseService } from '../../../services/supabase.service';

@Component({
  selector: 'app-reserva',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reserva.html',
  styleUrl: './reserva.css',
})
export class Reserva implements OnInit {
  viajeId = 0;
  asientoId = 0;
  nroAsiento = 0;
  piso = 1;
  categoria = '';
  precio = 0;
  origen = '';
  destino = '';
  fechaSalida = '';

  pasajero = {
    nombre: '',
    apellido: '',
    documento: '',
    email: '',
    telefono: '',
  };

  tipoPago: 'total' | 'parcial' = 'total';
  loading = false;
  message = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
  ) {}

  ngOnInit() {
    const q = this.route.snapshot.queryParams;
    this.viajeId = Number(q['viajeId']);
    this.asientoId = Number(q['asientoId']);
    this.nroAsiento = Number(q['nroAsiento']);
    this.piso = Number(q['piso']);
    this.categoria = q['categoria'] || '';
    this.precio = Number(q['precio']);
    this.origen = q['origen'] || '';
    this.destino = q['destino'] || '';
    this.fechaSalida = q['fechaSalida'] || '';

    if (!this.viajeId || !this.asientoId) {
      this.router.navigate(['/minorista/inicio']);
    }
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }

  formatHora(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  async confirmarReserva() {
    if (!this.pasajero.nombre || !this.pasajero.apellido || !this.pasajero.documento) {
      this.message = 'Completá nombre, apellido y documento del pasajero';
      return;
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

    const { error } = await this.supabaseService.crearReserva({
      viaje_id: this.viajeId,
      vendedor_id: vendedorId,
      pasajero_datos: this.pasajero as unknown as Record<string, unknown>,
      tipo_pago: this.tipoPago,
      estado: 'pendiente_comprobante',
      comprobante_url: null,
      motivo_rechazo: null,
    });

    if (error) {
      this.message = error.message;
      this.loading = false;
      return;
    }

    this.loading = false;
    this.router.navigate(['/minorista/confirmacion'], {
      queryParams: {
        origen: this.origen,
        destino: this.destino,
        fecha: this.fechaSalida,
        asiento: this.nroAsiento,
        piso: this.piso,
        categoria: this.categoria,
        precio: this.precio,
        pasajero: `${this.pasajero.nombre} ${this.pasajero.apellido}`,
        tipoPago: this.tipoPago,
      }
    });
  }
}
