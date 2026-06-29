import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ViajeService } from '../../../services/viaje.service';
import { ReservaService } from '../../../services/reserva.service';
import { UnidadService } from '../../../services/unidad.service';
import { PerfilService } from '../../../services/perfil.service';
import { PagoService } from '../../../services/pago.service';
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

  totalVendido = 0;
  totalCobrado = 0;
  totalPendiente = 0;
  eficienciaCobro = 0;
  pagosPendientes = 0;

  deltaConfirmados = 0;
  ultimaActualizacion = '';

  get esAdmin(): boolean {
    return this.perfil?.rol === 'admin_mayorista';
  }

  constructor(
    private perfilService: PerfilService,
    private viajeService: ViajeService,
    private reservaService: ReservaService,
    private unidadService: UnidadService,
    private pagoService: PagoService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    try {
      const { data: perfil } = await this.perfilService.getCurrentProfile();
      this.perfil = perfil;

      const hoyIni = new Date(); hoyIni.setHours(0,0,0,0);
      const ayerIni = new Date(hoyIni); ayerIni.setDate(ayerIni.getDate() - 1);
      const mananaIni = new Date(hoyIni); mananaIni.setDate(mananaIni.getDate() + 1);

      const [viajesRes, unidadesRes, bloqueadosRes, actividadRes, totalVendido, totalCobrado, pagosPendientes, confirmadasHoy, confirmadasAyer] = await Promise.all([
        this.viajeService.getViajes(),
        this.unidadService.getUnidadesCount(),
        this.unidadService.getBloqueadosPorVendedor(),
        this.reservaService.getActividadReciente(),
        this.reservaService.getTotalVendido(),
        this.pagoService.getTotalCobrado(),
        this.pagoService.countPagosPendientes(),
        this.reservaService.getReservasConfirmadasEnRango(hoyIni, mananaIni),
        this.reservaService.getReservasConfirmadasEnRango(ayerIni, hoyIni),
      ]);

      if (viajesRes.data) this.viajesActivos = viajesRes.data.length;
      this.totalUnidades = unidadesRes.count ?? 0;
      this.bloqueadosPorVendedor = bloqueadosRes.count ?? 0;
      this.reservasHoy = confirmadasHoy.count ?? 0;
      if (actividadRes.data) this.actividadReciente = actividadRes.data;
      this.totalVendido = totalVendido;
      this.totalCobrado = totalCobrado;
      this.totalPendiente = Math.max(0, totalVendido - totalCobrado);
      this.eficienciaCobro = totalVendido > 0 ? Math.round((totalCobrado / totalVendido) * 100) : 0;
      this.pagosPendientes = pagosPendientes;

      const ayer = confirmadasAyer.count ?? 0;
      this.deltaConfirmados = ayer > 0 ? Math.round(((this.reservasHoy - ayer) / ayer) * 100) : this.reservasHoy > 0 ? 100 : 0;
    } catch {
    }
    this.ultimaActualizacion = new Date().toLocaleString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
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
