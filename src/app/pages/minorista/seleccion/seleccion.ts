import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { SupabaseService } from '../../../services/supabase.service';
import { ReservaStateService } from '../../../services/reserva-state.service';
import type { Viaje, MapaAsientoViaje } from '../../../models/database.types';

interface SeatView extends MapaAsientoViaje {
  selected: boolean;
}

@Component({
  selector: 'app-seleccion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seleccion.html',
  styleUrl: './seleccion.css',
})
export class Seleccion implements OnInit, OnDestroy {
  viaje: Viaje | null = null;
  asientos: SeatView[] = [];
  loading = true;
  bloqueando = false;
  mensajeError = '';
  private userId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
    private reservaState: ReservaStateService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    try {
      const session = await this.supabaseService.supabase.auth.getSession();
      this.userId = session.data.session?.user?.id ?? null;

      const viajeId = Number(this.route.snapshot.paramMap.get('viajeId'));
      if (!viajeId) return;

      const [viajeRes, asientosRes] = await Promise.all([
        this.supabaseService.getViajePorId(viajeId),
        this.supabaseService.getAsientosPorViaje(viajeId),
      ]);

      if (viajeRes.data) this.viaje = viajeRes.data;
      if (asientosRes.data) {
        this.asientos = asientosRes.data.map(a => ({ ...a, selected: false }));
      }
    } catch (e: any) {
      console.error('Error al cargar selección:', e?.message);
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    for (const asiento of this.selectedList) {
      this.supabaseService.liberarAsiento(asiento.viaje_id!, asiento.nro_asiento);
    }
  }

  asientosPorPiso(piso: number): SeatView[] {
    return this.asientos.filter(a => a.piso === piso);
  }

  seatRowsIzq(piso: number): SeatView[][] {
    const seats = this.asientosPorPiso(piso);
    const rows: SeatView[][] = [];
    for (let i = 0; i + 1 < seats.length; i += 4) {
      rows.push([seats[i], seats[i + 1]]);
    }
    return rows;
  }

  seatRowsDer(piso: number): SeatView[][] {
    const seats = this.asientosPorPiso(piso);
    const rows: SeatView[][] = [];
    for (let i = 2; i + 1 < seats.length; i += 4) {
      rows.push([seats[i], seats[i + 1]]);
    }
    return rows;
  }

  get asientosLibres(): number {
    return this.asientos.filter(a => a.estado === 'libre' && !a.selected).length;
  }

  formatHora(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }

  private getSeat(id: number): SeatView | undefined {
    return this.asientos.find(a => a.id === id);
  }

  private patchSeat(id: number, patch: Partial<SeatView>) {
    this.asientos = this.asientos.map(a => a.id === id ? { ...a, ...patch } : a);
  }

  async toggleSeat(seatId: number) {
    if (!this.userId || this.bloqueando) return;

    const asiento = this.getSeat(seatId);
    if (!asiento) return;

    this.bloqueando = true;
    this.mensajeError = '';

    try {
      if (asiento.selected) {
        await this.supabaseService.liberarAsiento(asiento.viaje_id!, asiento.nro_asiento);
        this.patchSeat(seatId, { estado: 'libre', vendedor_bloqueo_id: null, bloqueado_hasta: null, selected: false });
        return;
      }

      if (asiento.estado !== 'libre') return;

      const { error } = await this.supabaseService.bloquearAsiento(
        asiento.viaje_id!,
        asiento.nro_asiento,
        this.userId,
      );

      if (error) {
        this.mensajeError = 'Este asiento ya no está disponible. Otro usuario lo reservó.';
        await this.cargarAsientos();
        return;
      }

      this.patchSeat(seatId, {
        estado: 'bloqueado',
        vendedor_bloqueo_id: this.userId,
        bloqueado_hasta: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        selected: true,
      });
    } catch (e: any) {
      this.mensajeError = e?.message || 'Error al seleccionar el asiento';
    } finally {
      this.bloqueando = false;
      this.cdr.detectChanges();
    }
  }

  private async cargarAsientos() {
    if (!this.viaje) return;
    try {
      const { data } = await this.supabaseService.getAsientosPorViaje(this.viaje.id);
      if (data) this.asientos = data.map(a => ({ ...a, selected: false }));
    } catch {
    }
  }

  seatClasses(asiento: SeatView): string {
    if (asiento.selected) return 'seat-selected';
    if (asiento.estado === 'bloqueado') return 'seat-blocked';
    if (asiento.estado === 'confirmado') return 'seat-occupied';
    return 'seat-free';
  }

  get selectedList(): SeatView[] {
    return this.asientos.filter(a => a.selected);
  }

  get seatLabel(): string {
    const count = this.selectedList.length;
    if (count === 0) return 'Ninguno';
    const total = count * (this.viaje?.precio_base ?? 0);
    return `${count} asiento${count > 1 ? 's' : ''} — ${this.formatPrecio(total)}`;
  }

  continuarReserva() {
    const sel = this.selectedList;
    if (sel.length === 0 || !this.viaje) return;
    this.reservaState.iniciar(this.viaje, sel);
    this.router.navigate(['/minorista/reserva'], { replaceUrl: true });
  }
}
