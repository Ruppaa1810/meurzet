import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { SupabaseService } from '../../services/supabase.service';
import type { Viaje } from '../../models/database.types';

@Component({
  selector: 'app-lista-viajes',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './lista-viajes.html',
  styleUrl: './lista-viajes.css',
})
export class ListaViajes implements OnInit {
  viajes: Viaje[] = [];
  loading = true;
  error = '';

  constructor(private supabaseService: SupabaseService) {}

  async ngOnInit() {
    this.loading = true;
    const { data, error } = await this.supabaseService.getViajes();

    if (error) {
      this.error = error.message;
    } else if (data) {
      this.viajes = data;
    }

    this.loading = false;
  }

  formatPrecio(precio: number): string {
    return `$${precio.toLocaleString('es-AR')}`;
  }

  formatHora(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  }

  duracion(fechaSalida: string, fechaLlegada: string): string {
    const diff = new Date(fechaLlegada).getTime() - new Date(fechaSalida).getTime();
    const horas = Math.floor(diff / 3600000);
    const minutos = Math.floor((diff % 3600000) / 60000);
    return `${horas}h ${minutos}m`;
  }
}
