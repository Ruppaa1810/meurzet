import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ViajeService } from '../../../services/viaje.service';
import { ReservaService } from '../../../services/reserva.service';
import { PerfilService } from '../../../services/perfil.service';
import { PagoService } from '../../../services/pago.service';
import { totalVentaReserva } from '../../../utils/calculo-financiero';
import { seccionesPara } from '../menu-admin';
import type { Perfil, PagoMovimiento } from '../../../models/database.types';

type Periodo = 'hoy' | 'semana' | 'mes';

interface ReservaPanel {
  id: number;
  estado: string;
  created_at: string;
  vendedor_id: string | null;
  pasajero_datos: Record<string, unknown>;
  viaje: { origen: string; destino: string; precio_base: number } | null;
}

interface FilaRanking { nombre: string; agencia: string; pasajes: number; vendido: number }

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard implements OnInit {
  perfil: Perfil | null = null;
  loading = true;
  periodo: Periodo = 'mes';
  ultimaActualizacion = '';

  pagosPorValidar = 0;
  esperandoComprobante = 0;
  viajesALaVenta = 0;
  pasajesVendidos = 0;
  totalVendido = 0;
  totalCobrado = 0;
  pendienteCobro = 0;
  porcentajeCobrado = 0;
  ranking: FilaRanking[] = [];
  actividad: (ReservaPanel & { vendedor: string })[] = [];
  sinVendedores = false;

  /** null = toda la empresa (admin); lista = vendedores que dio de alta el operador. */
  private vendedorIds: string[] | null = null;
  private perfiles = new Map<string, Perfil>();

  constructor(
    private perfilService: PerfilService,
    private viajeService: ViajeService,
    private reservaService: ReservaService,
    private pagoService: PagoService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  get esAdmin(): boolean {
    return this.perfil?.rol === 'admin_mayorista';
  }

  get secciones() {
    return seccionesPara(this.perfil?.rol);
  }

  get textoPeriodo(): string {
    return { hoy: 'hoy', semana: 'últimos 7 días', mes: 'este mes' }[this.periodo];
  }

  async ngOnInit() {
    try {
      const [{ data: perfil }, { data: perfiles }, viajes] = await Promise.all([
        this.perfilService.getCurrentProfile(),
        this.perfilService.getVendedoresMinoristas(),
        this.viajeService.getViajes(),
      ]);
      this.perfil = perfil;
      for (const p of perfiles ?? []) this.perfiles.set(p.id, p);
      if (perfil && !this.esAdmin) {
        this.vendedorIds = (perfiles ?? [])
          .filter(p => p.created_by === perfil.id && p.rol === 'vendedor_minorista')
          .map(p => p.id);
        this.sinVendedores = this.vendedorIds.length === 0;
      }
      this.viajesALaVenta = viajes.data?.length ?? 0;
      this.pagosPorValidar = await this.pagoService.countPagosPendientes(this.vendedorIds);
      await this.cargarPeriodo();
    } catch {
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  async cambiarPeriodo(periodo: Periodo) {
    this.periodo = periodo;
    await this.cargarPeriodo();
    this.cdr.detectChanges();
  }

  private async cargarPeriodo() {
    const vacio = this.vendedorIds?.length === 0;
    const [reservasRes, esperando] = vacio
      ? [{ data: [] }, 0]
      : await Promise.all([
          this.reservaService.getReservasPanel(this.inicioPeriodo(), this.vendedorIds),
          this.reservaService.contarEsperandoComprobante(this.vendedorIds),
        ]);
    const reservas = (reservasRes.data ?? []) as unknown as ReservaPanel[];
    this.esperandoComprobante = esperando;

    const aprobadas = reservas.filter(r => r.estado === 'aprobado');
    const { data: pagos } = await this.pagoService.getPagosPorReservas(aprobadas.map(r => r.id));
    const pagosPorReserva = new Map<number, PagoMovimiento[]>();
    for (const p of pagos ?? []) pagosPorReserva.set(p.reserva_id, [...(pagosPorReserva.get(p.reserva_id) ?? []), p]);

    let vendido = 0;
    let pendiente = 0;
    const porVendedor = new Map<string, FilaRanking>();
    for (const r of aprobadas) {
      const { totalFinal, montoPendiente } = totalVentaReserva(r.viaje?.precio_base ?? 0, r.pasajero_datos, pagosPorReserva.get(r.id) ?? []);
      vendido += totalFinal;
      pendiente += montoPendiente;
      const id = r.vendedor_id ?? '';
      const fila = porVendedor.get(id) ?? { nombre: this.nombre(id), agencia: this.perfiles.get(id)?.agencia_nombre ?? '', pasajes: 0, vendido: 0 };
      fila.pasajes++;
      fila.vendido += totalFinal;
      porVendedor.set(id, fila);
    }

    this.pasajesVendidos = aprobadas.length;
    this.totalVendido = vendido;
    this.pendienteCobro = pendiente;
    this.totalCobrado = vendido - pendiente;
    this.porcentajeCobrado = vendido > 0 ? Math.round(this.totalCobrado / vendido * 100) : 0;
    this.ranking = [...porVendedor.values()].sort((a, b) => b.vendido - a.vendido).slice(0, 5);
    this.actividad = reservas.slice(0, 10).map(r => ({ ...r, vendedor: this.nombre(r.vendedor_id ?? '') }));
    this.ultimaActualizacion = new Date().toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  private nombre(id: string): string {
    const p = this.perfiles.get(id);
    return p?.nombre || p?.email || 'Vendedor';
  }

  private inicioPeriodo(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (this.periodo === 'semana') d.setDate(d.getDate() - 6);
    if (this.periodo === 'mes') d.setDate(1);
    return d;
  }

  irA(ruta: string) {
    this.router.navigate([`/admin/${ruta}`]);
  }

  labelEstado(estado: string): string {
    const map: Record<string, string> = {
      aprobado: 'Aprobada',
      pendiente_validacion: 'Por validar',
      pendiente_comprobante: 'Esperando comprobante',
      rechazado: 'Rechazada',
    };
    return map[estado] ?? estado;
  }
}
