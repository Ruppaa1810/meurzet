import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComisionService } from '../../../services/comision.service';
import { PerfilService } from '../../../services/perfil.service';
import type { Comision, ComisionConfig } from '../../../models/database.types';

interface ComisionConPerfil extends Comision {
  perfil?: { nombre: string; email: string | null } | null;
  reserva?: { id: number; pasajero_datos: Record<string, unknown> } | null;
  pago?: { monto: number; metodo_pago: string } | null;
}

@Component({
  selector: 'app-comisiones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comisiones.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Comisiones implements OnInit {
  comisiones: ComisionConPerfil[] = [];
  loading = true;
  mensaje = '';
  successMensaje = '';
  private successTimeout: any = null;

  filtroEstado: '' | 'pendiente' | 'pagado' = '';
  seleccionadas: Set<number> = new Set();
  procesando = false;

  resumen = { totalGenerado: 0, totalPendiente: 0, totalPagado: 0 };

  mostrarModalConfig = false;
  configTarget: any = null;
  configPorcentaje = 0;
  guardandoConfig = false;

  Math = Math;

  constructor(
    private comisionService: ComisionService,
    private perfilService: PerfilService,
    public cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.loading = true;
    this.mensaje = '';
    const { data, error } = await this.comisionService.getComisionesAll();
    if (error) { this.mensaje = error.message; this.loading = false; this.cdr.detectChanges(); return; }
    this.comisiones = (data || []) as ComisionConPerfil[];
    this.resumen = await this.comisionService.getResumenAll();
    this.seleccionadas.clear();
    this.loading = false;
    this.cdr.detectChanges();
  }

  get comisionesFiltradas() {
    if (!this.filtroEstado) return this.comisiones;
    return this.comisiones.filter(c => c.estado === this.filtroEstado);
  }

  toggleSeleccion(id: number) {
    if (this.seleccionadas.has(id)) this.seleccionadas.delete(id);
    else this.seleccionadas.add(id);
    this.cdr.detectChanges();
  }

  toggleTodas() {
    const filtradas = this.comisionesFiltradas.filter(c => c.estado === 'pendiente');
    if (this.seleccionadas.size === filtradas.length) {
      this.seleccionadas.clear();
    } else {
      filtradas.forEach(c => this.seleccionadas.add(c.id));
    }
    this.cdr.detectChanges();
  }

  async marcarPagadas() {
    if (this.seleccionadas.size === 0) return;
    this.procesando = true;
    const ids = Array.from(this.seleccionadas);
    const { error } = await this.comisionService.marcarComoPagada(ids);
    if (error) { this.mensaje = error.message; this.procesando = false; this.cdr.detectChanges(); return; }
    this.mostrarSuccess(`${ids.length} comisión(es) marcada(s) como pagada(s)`);
    await this.cargar();
    this.procesando = false;
    this.cdr.detectChanges();
  }

  nombreVendedor(c: ComisionConPerfil): string {
    return c.perfil?.nombre || '-';
  }

  pasajeroLabel(c: ComisionConPerfil): string {
    const d = (c.reserva?.pasajero_datos || {}) as Record<string, any>;
    return [d['nombre'], d['apellido']].filter(Boolean).join(' ') || '-';
  }

  formatPrecio(v: number): string {
    return `$ ${v.toLocaleString('es-AR')}`;
  }

  formatFecha(f: string): string {
    return new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  dismissSuccess() {
    this.successMensaje = '';
    if (this.successTimeout) { clearTimeout(this.successTimeout); this.successTimeout = null; }
  }

  private mostrarSuccess(msg: string) {
    this.dismissSuccess();
    this.successMensaje = msg;
    this.cdr.detectChanges();
    this.successTimeout = setTimeout(() => this.dismissSuccess(), 5000);
  }
}
