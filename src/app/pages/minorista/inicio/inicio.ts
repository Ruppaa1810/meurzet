import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';


import { SupabaseService } from '../../../services/supabase.service';
import type { Viaje } from '../../../models/database.types';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inicio.html',
})
export class Inicio implements OnInit {
  todosViajes: Viaje[] = [];
  viajesFiltrados: Viaje[] = [];
  loading = true;

  filtroOrigen = '';
  filtroDestino = '';
  filtroFecha = '';
  filtroHorario = 'todos';

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    try {
      const { data, error } = await this.supabaseService.getViajes();
      if (!error && data) {
        this.todosViajes = data;
        this.viajesFiltrados = data;
      }
    } catch (e: any) {
      console.error('Error al cargar inicio:', e?.message);
    }
    this.loading = false;
    this.cdr.detectChanges();
  }
  buscarViajes() {
    this.viajesFiltrados = this.todosViajes.filter(v => {
      if (this.filtroOrigen && !v.origen.toLowerCase().includes(this.filtroOrigen.toLowerCase())) return false;
      if (this.filtroDestino && !v.destino.toLowerCase().includes(this.filtroDestino.toLowerCase())) return false;
      if (this.filtroFecha) {
        const fechaViaje = new Date(v.fecha_salida).toISOString().split('T')[0];
        if (fechaViaje !== this.filtroFecha) return false;
      }
      if (this.filtroHorario !== 'todos') {
        const hora = new Date(v.fecha_salida).getHours();
        if (this.filtroHorario === 'manana' && (hora < 6 || hora >= 12)) return false;
        if (this.filtroHorario === 'tarde' && (hora < 12 || hora >= 19)) return false;
        if (this.filtroHorario === 'noche' && (hora < 19 || hora >= 24)) return false;
      }
      return true;
    });
    this.cdr.detectChanges();
  }

  formatHora(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  formatFechaCorta(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: 'numeric', month: 'short',
    });
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }
}