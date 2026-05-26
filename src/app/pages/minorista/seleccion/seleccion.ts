import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { SupabaseService } from '../../../services/supabase.service';
import type { Viaje, MapaAsientoViaje, Perfil } from '../../../models/database.types';

@Component({
  selector: 'app-seleccion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seleccion.html',
  styleUrl: './seleccion.css',
})
export class Seleccion implements OnInit, AfterViewInit {
  viaje: Viaje | null = null;
  asientos: MapaAsientoViaje[] = [];
  selectedSeat: MapaAsientoViaje | null = null;
  loading = true;
  perfil: Perfil | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
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

      const viajeId = Number(this.route.snapshot.paramMap.get('viajeId'));
      if (!viajeId) return;

      const [viajeRes, asientosRes] = await Promise.all([
        this.supabaseService.getViajePorId(viajeId),
        this.supabaseService.getAsientosPorViaje(viajeId),
      ]);

      if (viajeRes.data) this.viaje = viajeRes.data;
      if (asientosRes.data) this.asientos = asientosRes.data;
    } catch (e) {
      console.error('Error en ngOnInit de seleccion:', e);
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

  async logout() {
    await this.supabaseService.signOut();
    this.router.navigate(['/']);
  }

  asientosPorPiso(piso: number): MapaAsientoViaje[] {
    return this.asientos.filter(a => a.piso === piso);
  }

  seatRowsIzq(piso: number): MapaAsientoViaje[][] {
    const seats = this.asientosPorPiso(piso);
    const rows: MapaAsientoViaje[][] = [];
    for (let i = 0; i + 1 < seats.length; i += 4) {
      rows.push([seats[i], seats[i + 1]]);
    }
    return rows;
  }

  seatRowsDer(piso: number): MapaAsientoViaje[][] {
    const seats = this.asientosPorPiso(piso);
    const rows: MapaAsientoViaje[][] = [];
    for (let i = 2; i + 1 < seats.length; i += 4) {
      rows.push([seats[i], seats[i + 1]]);
    }
    return rows;
  }

  get asientosLibres(): number {
    return this.asientos.filter(a => a.estado === 'libre').length;
  }

  formatHora(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }

  toggleSeat(asiento: MapaAsientoViaje) {
    if (asiento.estado !== 'libre') return;
    this.selectedSeat = this.selectedSeat?.id === asiento.id ? null : asiento;
  }

  get seatLabel(): string {
    if (!this.selectedSeat) return 'Ninguno';
    const piso = this.selectedSeat.piso === 1 ? 'Baja' : 'Alta';
    return `${this.selectedSeat.nro_asiento} — Planta ${piso} · ${this.selectedSeat.categoria}`;
  }

  seatClasses(asiento: MapaAsientoViaje): string {
    if (this.selectedSeat?.id === asiento.id) return 'seat-selected';
    if (asiento.estado === 'bloqueado') return 'seat-blocked';
    if (asiento.estado === 'confirmado') return 'seat-occupied';
    return 'seat-free';
  }

  continuarReserva() {
    if (!this.selectedSeat || !this.viaje) return;
    this.router.navigate(['/minorista/reserva'], {
      queryParams: {
        viajeId: this.viaje.id,
        asientoId: this.selectedSeat.id,
        nroAsiento: this.selectedSeat.nro_asiento,
        piso: this.selectedSeat.piso,
        categoria: this.selectedSeat.categoria,
        precio: this.viaje.precio_base,
        origen: this.viaje.origen,
        destino: this.viaje.destino,
        fechaSalida: this.viaje.fecha_salida,
      }
    });
  }
}

