import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

import { SupabaseService } from '../../../services/supabase.service';
import type { Viaje, Perfil } from '../../../models/database.types';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio implements OnInit, AfterViewInit {
  todosViajes: Viaje[] = [];
  viajesFiltrados: Viaje[] = [];
  loading = true;
  perfil: Perfil | null = null;

  filtroOrigen = '';
  filtroDestino = '';
  filtroFecha = '';
  filtroHorario = 'todos';

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    try {
      const session = await this.supabaseService.supabase.auth.getSession();
      const userId = session.data.session?.user?.id;
      if (userId) {
        const { data } = await this.supabaseService.getPerfil(userId);
        this.perfil = data;
      }

      const { data, error } = await this.supabaseService.getViajes();
      if (!error && data) {
        this.todosViajes = data;
        this.viajesFiltrados = data;
      }
    } catch {
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  ngAfterViewInit() {
    const menuBtn = document.querySelector('.menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    menuBtn?.addEventListener('click', () => {
      sidebar?.classList.toggle('open');
      overlay?.classList.toggle('show');
    });

    overlay?.addEventListener('click', () => {
      sidebar?.classList.remove('open');
      overlay?.classList.remove('show');
    });
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

  async logout() {
    await this.supabaseService.signOut();
    this.router.navigate(['/']);
  }

  formatHora(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }
}