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
  private userId: string | null = null;
  private viajeId: number = 0;
  private realtimeChannel: ReturnType<SupabaseService['supabase']['channel']> | null = null;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

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

      this.viajeId = Number(this.route.snapshot.paramMap.get('viajeId'));
      if (!this.viajeId) return;

      const [viajeRes, asientosRes] = await Promise.all([
        this.supabaseService.getViajePorId(this.viajeId),
        this.supabaseService.getAsientosPorViaje(this.viajeId),
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

    this.initRealtime();
    this.pollingInterval = setInterval(() => this.cargarAsientos(), 15000);
  }

  private initRealtime() {
    this.realtimeChannel = this.supabaseService.supabase
      .channel(`seats-viaje-${this.viajeId}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mapa_asientos_viaje',
          filter: `viaje_id=eq.${this.viajeId}`,
        },
        () => { this.cargarAsientos(); }
      )
      .subscribe();
  }

  ngOnDestroy() {
    if (this.realtimeChannel) {
      this.supabaseService.supabase.removeChannel(this.realtimeChannel);
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
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

  private getSeat(id: number): SeatView | undefined {
    return this.asientos.find(a => a.id === id);
  }

  private patchSeat(id: number, patch: Partial<SeatView>) {
    this.asientos = this.asientos.map(a => a.id === id ? { ...a, ...patch } : a);
  }

  canToggle(asiento: SeatView | undefined): boolean {
    if (!asiento) return false;
    if (asiento.estado === 'libre') return true;
    return asiento.estado === 'bloqueado' && asiento.vendedor_bloqueo_id === this.userId;
  }

  async toggleSeat(seatId: number) {
    console.log('toggleSeat llamado con id:', seatId);
    if (this.bloqueando) { console.log('bloqueando, return'); return; }

    const asiento = this.getSeat(seatId);
    console.log('asiento:', asiento);
    if (!asiento || !this.canToggle(asiento)) { console.log('no puede togglear, return'); return; }

    this.bloqueando = true;

    try {
      if (asiento.estado === 'bloqueado' && asiento.vendedor_bloqueo_id === this.userId) {
        console.log('liberando asiento');
        await this.supabaseService.liberarAsiento(asiento.viaje_id!, asiento.nro_asiento);
        this.patchSeat(seatId, { estado: 'libre', vendedor_bloqueo_id: null, bloqueado_hasta: null, selected: false });
      } else if (asiento.estado === 'libre') {
        console.log('bloqueando asiento, userId:', this.userId);
        if (!this.userId) { console.log('sin userId, return'); return; }
        await this.supabaseService.bloquearAsiento(asiento.viaje_id!, asiento.nro_asiento, this.userId);
        console.log('bloqueo exitoso, patchSeat antes');
        this.patchSeat(seatId, { estado: 'bloqueado', vendedor_bloqueo_id: this.userId, selected: true });
        console.log('patchSeat despues, estado ahora:', this.getSeat(seatId)?.estado);
        this.cdr.detectChanges();
        console.log('detectChanges ok');
      }
    } catch (e) {
      console.error('toggleSeat error:', e);
      await this.cargarAsientos();
    } finally {
      this.bloqueando = false;
      this.cdr.detectChanges();
    }
  }

  private async cargarAsientos() {
    if (!this.viaje) return;
    try {
      const { data } = await this.supabaseService.getAsientosPorViaje(this.viaje.id);
      if (!data) return;

      const prevSelected = new Map(this.selectedList.map(a => [a.id, a]));

      this.asientos = data.map(a => {
        const wasSelected = prevSelected.has(a.id);
        return {
          ...a,
          selected: !!wasSelected && a.estado === 'bloqueado',
        };
      });

    } catch {
    } finally {
      this.cdr.detectChanges();
    }
  }

  seatClasses(asiento: SeatView): string {
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
    this.router.navigate(['/minorista/reserva']);
  }

  async volver() {
    const misBloqueados = this.asientos.filter(a => a.estado === 'bloqueado' && a.vendedor_bloqueo_id === this.userId);
    await Promise.allSettled(
      misBloqueados.map(a => this.supabaseService.liberarAsiento(a.viaje_id!, a.nro_asiento))
    );
    this.router.navigate(['/minorista/vender']);
  }
}
