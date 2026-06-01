import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { SupabaseService } from '../../../services/supabase.service';
import type { Reserva, Viaje } from '../../../models/database.types';

interface ReservaView extends Reserva {
  viajeLabel: string;
  pasajeroNombre: string;
  monto: number;
}

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './mis-reservas.html',
})
export class MisReservas implements OnInit {
  reservas: ReservaView[] = [];
  loading = true;

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    try {
      const { data: perfil } = await this.supabaseService.getCurrentProfile();
      if (!perfil?.id) return;

      const { data: raw } = await this.supabaseService.getReservasPorVendedor(perfil.id);
      if (!raw) return;

      const viajeIds = [...new Set(raw.map(r => r.viaje_id).filter(Boolean))] as number[];
      const viajesMap = new Map<number, { label: string; precio: number }>();

      for (const id of viajeIds) {
        const { data } = await this.supabaseService.getViajePorId(id);
        if (data) viajesMap.set(id, { label: `${data.origen} → ${data.destino}`, precio: data.precio_base });
      }

      this.reservas = raw.map(r => {
        const d = (r.pasajero_datos || {}) as Record<string, any>;
        const nom = [d['nombre'], d['apellido']].filter(Boolean).join(' ') || '-';
        const viajeInfo = viajesMap.get(r.viaje_id!);
        const pct = typeof d['porcentaje_pago'] === 'number' ? d['porcentaje_pago'] : 1;
        const monto = viajeInfo ? Math.round(viajeInfo.precio * pct) : 0;
        return { ...r, viajeLabel: viajeInfo?.label || `Viaje #${r.viaje_id}`, pasajeroNombre: nom, monto };
      });
    } catch (e: any) {
      console.error('Error al cargar reservas:', e?.message);
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  estadoLabel(estado: string | null): string {
    const map: Record<string, string> = {
      pendiente_comprobante: 'Pendiente de comprobante',
      pendiente_validacion: 'Pendiente de validación',
      aprobado: 'Aprobado',
      rechazado: 'Rechazado',
    };
    return estado ? map[estado] || estado : 'Desconocido';
  }

  formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }
}
