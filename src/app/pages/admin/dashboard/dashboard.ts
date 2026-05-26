import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { SupabaseService } from '../../../services/supabase.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class AdminDashboard implements OnInit {
  viajesActivos = 0;
  totalUnidades = 0;
  reservasHoy = 0;
  bloqueadosPorVendedor = 0;
  actividadReciente: any[] = [];

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    const [viajesRes, unidadesRes, confirmadasRes, bloqueadosRes, actividadRes] = await Promise.all([
      this.supabaseService.getViajes(),
      this.supabaseService.getUnidadesCount(),
      this.supabaseService.getReservasConfirmadasHoy(),
      this.supabaseService.getBloqueadosPorVendedor(),
      this.supabaseService.getActividadReciente(),
    ]);

    if (viajesRes.data) this.viajesActivos = viajesRes.data.length;
    this.totalUnidades = unidadesRes.count ?? 0;
    this.reservasHoy = confirmadasRes.count ?? 0;
    this.bloqueadosPorVendedor = bloqueadosRes.count ?? 0;
    if (actividadRes.data) this.actividadReciente = actividadRes.data;
    this.cdr.detectChanges();
  }

  irA(ruta: string) {
    this.router.navigate([`/admin/${ruta}`]);
  }
}
