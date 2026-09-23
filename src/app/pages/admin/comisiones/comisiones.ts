import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComisionService } from '../../../services/comision.service';
import type { Comision } from '../../../models/database.types';

interface ConfigConPerfil {
  id: number;
  vendedor_id: string;
  porcentaje: number;
  activo: boolean;
  perfiles?: { nombre: string; email: string | null } | null;
}

type ComisionAPagar = Comision & {
  perfiles: { nombre: string } | null;
  reservas: { pasajero_datos: Record<string, any>; viaje: { origen: string; destino: string; fecha_salida: string } | null } | null;
};

@Component({
  selector: 'app-comisiones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comisiones.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Comisiones implements OnInit {
  configs: ConfigConPerfil[] = [];
  aPagar: ComisionAPagar[] = [];
  seleccionadas = new Set<number>();
  pagando = false;
  loading = true;
  mensaje = '';
  successMensaje = '';
  private successTimeout: any = null;

  mostrarModal = false;
  configEditando: ConfigConPerfil | null = null;
  formPorcentaje = 0;
  guardando = false;

  constructor(
    private comisionService: ComisionService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.loading = true;
    this.mensaje = '';
    const [{ data, error }, pendientes] = await Promise.all([
      this.comisionService.getConfigsAll(),
      this.comisionService.getComisionesAll('pendiente'),
    ]);
    if (error || pendientes.error) {
      this.mensaje = (error || pendientes.error)!.message;
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }
    this.configs = (data || []) as ConfigConPerfil[];
    this.aPagar = (pendientes.data || []) as ComisionAPagar[];
    this.seleccionadas.clear();
    this.loading = false;
    this.cdr.detectChanges();
  }

  toggleSeleccion(id: number) {
    if (!this.seleccionadas.delete(id)) this.seleccionadas.add(id);
  }

  toggleTodas() {
    if (this.seleccionadas.size === this.aPagar.length) this.seleccionadas.clear();
    else this.aPagar.forEach(c => this.seleccionadas.add(c.id));
  }

  get totalSeleccionado(): number {
    return this.aPagar.filter(c => this.seleccionadas.has(c.id)).reduce((s, c) => s + c.monto_comision, 0);
  }

  async marcarPagadas() {
    if (!this.seleccionadas.size) return;
    this.pagando = true;
    this.mensaje = '';
    const cantidad = this.seleccionadas.size;
    const { error } = await this.comisionService.marcarComoPagada([...this.seleccionadas]);
    this.pagando = false;
    if (error) { this.mensaje = error.message; this.cdr.detectChanges(); return; }
    await this.cargar();
    this.mostrarSuccess(`${cantidad} comisi${cantidad === 1 ? 'ón marcada' : 'ones marcadas'} como pagada${cantidad === 1 ? '' : 's'}`);
  }

  clienteLabel(c: ComisionAPagar): string {
    const d = c.reservas?.pasajero_datos;
    return [d?.['nombre'], d?.['apellido']].filter(Boolean).join(' ') || `Reserva #${c.reserva_id}`;
  }

  viajeLabel(c: ComisionAPagar): string {
    const v = c.reservas?.viaje;
    return v ? `${v.origen} → ${v.destino} · ${new Date(v.fecha_salida).toLocaleDateString('es-AR')}` : '';
  }

  formatPrecio(v: number): string {
    return `$ ${v.toLocaleString('es-AR')}`;
  }

  nombreVendedor(c: ConfigConPerfil): string {
    return c.perfiles?.nombre || '-';
  }

  emailVendedor(c: ConfigConPerfil): string {
    return c.perfiles?.email || '';
  }

  abrirEditar(c: ConfigConPerfil) {
    this.configEditando = c;
    this.formPorcentaje = c.porcentaje;
    this.mensaje = '';
    this.mostrarModal = true;
    this.cdr.detectChanges();
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.configEditando = null;
    this.guardando = false;
  }

  async guardar() {
    if (!this.configEditando) return;
    this.guardando = true;
    this.mensaje = '';
    const { error } = await this.comisionService.upsertConfig(this.configEditando.vendedor_id, this.formPorcentaje);
    if (error) { this.mensaje = error.message; this.guardando = false; this.cdr.detectChanges(); return; }
    this.cerrarModal();
    await this.cargar();
    this.mostrarSuccess('Porcentaje actualizado correctamente');
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
