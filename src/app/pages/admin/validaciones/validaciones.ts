import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../../services/supabase.service';
import type { Reserva, Viaje } from '../../../models/database.types';

type ReservaConViaje = Reserva & { viaje?: Viaje };

@Component({
  selector: 'app-validaciones',
  standalone: true,
  imports: [],
  templateUrl: './validaciones.html',
})
export class Validaciones implements OnInit {
  reservas: ReservaConViaje[] = [];
  loading = true;
  error = '';

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    this.loading = true;
    this.error = '';
    const { data, error } = await this.supabaseService.getReservasPendientes();
    if (error) {
      this.error = 'Error al cargar reservas';
    } else if (data) {
      this.reservas = data;
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  async aprobar(reserva: ReservaConViaje) {
    if (!reserva.asiento_viaje_id) return;
    const { error } = await this.supabaseService.aprobarReserva(reserva.id, reserva.asiento_viaje_id);
    if (!error) {
      this.reservas = this.reservas.filter(r => r.id !== reserva.id);
    }
  }

  async rechazar(reserva: ReservaConViaje, motivo: string) {
    if (!reserva.asiento_viaje_id) return;
    const { error } = await this.supabaseService.rechazarReserva(reserva.id, reserva.asiento_viaje_id, motivo);
    if (!error) {
      this.reservas = this.reservas.filter(r => r.id !== reserva.id);
    }
  }
}
