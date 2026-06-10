import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { PerfilService } from '../../../services/perfil.service';
import { ViajeService } from '../../../services/viaje.service';
import { ReservaService } from '../../../services/reserva.service';
import { UnidadService } from '../../../services/unidad.service';
import type { Perfil } from '../../../models/database.types';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard implements OnInit {
  perfil: Perfil | null = null;
  viajesActivos = 0;
  totalUnidades = 0;
  reservasHoy = 0;
  bloqueadosPorVendedor = 0;
  actividadReciente: any[] = [];
  loading = true;

  get esAdmin(): boolean {
    return this.perfil?.rol === 'admin_mayorista';
  }

  constructor(
    private perfilService: PerfilService,
    private viajeService: ViajeService,
    private reservaService: ReservaService,
    private unidadService: UnidadService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    try {
      const { data: perfil } = await this.perfilService.getCurrentProfile();
      this.perfil = perfil;

      const [viajesRes, unidadesRes, confirmadasRes, bloqueadosRes, actividadRes] = await Promise.all([
        this.viajeService.getViajes(),
        this.unidadService.getUnidadesCount(),
        this.reservaService.getReservasConfirmadasHoy(),
        this.unidadService.getBloqueadosPorVendedor(),
        this.reservaService.getActividadReciente(),
      ]);

      if (viajesRes.data) this.viajesActivos = viajesRes.data.length;
      this.totalUnidades = unidadesRes.count ?? 0;
      this.reservasHoy = confirmadasRes.count ?? 0;
      this.bloqueadosPorVendedor = bloqueadosRes.count ?? 0;
      if (actividadRes.data) this.actividadReciente = actividadRes.data;
    } catch {
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  irA(ruta: string) {
    this.router.navigate([`/admin/${ruta}`]);
  }

  labelEstado(estado: string): string {
    const map: Record<string, string> = {
      aprobado: 'Aprobado',
      pendiente_validacion: 'Pendiente de validación',
      pendiente_comprobante: 'Esperando comprobante',
      rechazado: 'Rechazado',
    };
    return map[estado] ?? estado;
  }
}
