import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { SupabaseService } from '../../services/supabase.service';
import type { MapaAsientoViaje, Viaje } from '../../models/database.types';

@Component({
  selector: 'app-mapa-asientos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-asientos.html',
  styleUrl: './mapa-asientos.css',
})
export class MapaAsientos implements OnInit {
  viaje: Viaje | null = null;
  asientos: MapaAsientoViaje[] = [];
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
  ) {}

  async ngOnInit() {
    const viajeId = Number(this.route.snapshot.paramMap.get('viajeId'));

    if (!viajeId) {
      this.error = 'Viaje no especificado';
      this.loading = false;
      return;
    }

    const [viajeRes, asientosRes] = await Promise.all([
      this.supabaseService.getViajePorId(viajeId),
      this.supabaseService.getAsientosPorViaje(viajeId),
    ]);

    if (viajeRes.error) {
      this.error = viajeRes.error.message;
    } else {
      this.viaje = viajeRes.data;
    }

    if (asientosRes.error) {
      this.error = asientosRes.error.message;
    } else {
      this.asientos = asientosRes.data ?? [];
    }

    this.loading = false;
  }

  get asientosLibres(): number {
    return this.asientos.filter(a => a.estado === 'libre').length;
  }

  get pisos(): number[] {
    if (this.asientos.length === 0) return [];
    const maxPiso = Math.max(...this.asientos.map(a => a.piso));
    return Array.from({ length: maxPiso }, (_, i) => i + 1);
  }

  asientosPorPiso(piso: number): MapaAsientoViaje[] {
    return this.asientos.filter(a => a.piso === piso);
  }
}
