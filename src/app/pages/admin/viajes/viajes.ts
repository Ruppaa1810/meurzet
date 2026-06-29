import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PerfilService } from '../../../services/perfil.service';
import { ViajeService } from '../../../services/viaje.service';
import { UnidadService } from '../../../services/unidad.service';
import type { Viaje, Unidad, UserRole } from '../../../models/database.types';
import { Paginacion } from '../../../utils/paginacion';
import { PaginacionComponent } from '../../../components/paginacion';

@Component({
  selector: 'app-admin-viajes',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginacionComponent],
  templateUrl: './viajes.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Viajes implements OnInit {
  viajes: Viaje[] = [];
  unidades: Unidad[] = [];
  loading = false;
  guardando = false;
  mensaje = '';
  successMensaje = '';
  modalAbierto = false;
  editando = false;
  editandoId: number | null = null;

  // Modal eliminar
  mostrarModalEliminar = false;
  eliminarId: number | null = null;
  eliminando = false;

  paginacion = new Paginacion(6);

  get paginatedViajes(): Viaje[] {
    return this.paginacion.getPaginated(this.viajes);
  }

  rol: UserRole | null = null;

  form = {
    origen: '',
    destino: '',
    fecha_salida: '',
    fecha_llegada: '',
    unidad_id: null as number | null,
    precio_base: 0,
    activo: true,
  };

  constructor(
    private perfilService: PerfilService,
    private viajeService: ViajeService,
    private unidadService: UnidadService,
    private cdr: ChangeDetectorRef,
  ) { }

  get esAdmin(): boolean {
    return this.rol === 'admin_mayorista';
  }

  async ngOnInit() {
    try {
      const { data } = await this.perfilService.getCurrentProfile();
      if (data) this.rol = data.rol;
    } catch {
    }
    this.cargar();
  }

  async cargar() {
    this.loading = true;
    this.mensaje = '';
    this.paginacion.irAPagina(1);
    try {
      const [viajesRes, unidadesRes] = await Promise.all([
        this.viajeService.getViajesAdmin(),
        this.unidadService.getUnidades(),
      ]);
      if (viajesRes.error) { this.mensaje = viajesRes.error.message; }
      else { this.viajes = viajesRes.data ?? []; }
      if (!unidadesRes.error) { this.unidades = unidadesRes.data ?? []; }
    } catch (e: any) {
      this.mensaje = e?.message || 'Error al cargar viajes';
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  abrirModal(viaje?: Viaje) {
    if (viaje) {
      this.editando = true;
      this.editandoId = viaje.id;
      this.form = {
        origen: viaje.origen,
        destino: viaje.destino,
        fecha_salida: viaje.fecha_salida.slice(0, 16),
        fecha_llegada: viaje.fecha_llegada.slice(0, 16),
        unidad_id: viaje.unidad_id,
        precio_base: viaje.precio_base,
        activo: viaje.activo ?? true,
      };
    } else {
      this.editando = false;
      this.editandoId = null;
      this.form = { origen: '', destino: '', fecha_salida: '', fecha_llegada: '', unidad_id: null, precio_base: 0, activo: true };
    }
    this.modalAbierto = true;
  }

  cerrarModal() {
    this.modalAbierto = false;
  }

  mostrarSuccess(msg: string) {
    this.successMensaje = msg;
    setTimeout(() => this.successMensaje = '', 5000);
  }

  unidadLabel(viaje: Viaje): string {
    const u = this.unidades.find(u => u.id === viaje.unidad_id);
    return u ? `${u.patente} (${u.asientos_totales} as.)` : 'Sin asignar';
  }

  async guardar() {
    if (!this.esAdmin) return;
    if (!this.form.origen.trim() || !this.form.destino.trim() || !this.form.fecha_salida || !this.form.fecha_llegada) return;

    this.guardando = true;
    this.mensaje = '';

    try {
      const payload = {
        origen: this.form.origen,
        destino: this.form.destino,
        fecha_salida: new Date(this.form.fecha_salida).toISOString(),
        fecha_llegada: new Date(this.form.fecha_llegada).toISOString(),
        unidad_id: this.form.unidad_id,
        precio_base: this.form.precio_base,
        activo: this.form.activo,
      };

      if (this.editando && this.editandoId != null) {
        const { error } = await this.viajeService.updateViaje(this.editandoId, payload);
        if (error) { this.mensaje = error.message; return; }
      } else {
        const { data: viajeCreado, error } = await this.viajeService.crearViajeConAsientos({
          p_origen: payload.origen,
          p_destino: payload.destino,
          p_fecha_salida: payload.fecha_salida,
          p_fecha_llegada: payload.fecha_llegada,
          p_precio_base: payload.precio_base,
          p_activo: payload.activo,
          p_unidad_id: payload.unidad_id,
        });
        if (error) { this.mensaje = error.message; return; }
      }

      this.modalAbierto = false;
      await this.cargar();
      if (!this.mensaje) {
        this.mostrarSuccess(this.editando ? 'Viaje actualizado correctamente' : 'Viaje creado correctamente');
      }
    } catch (e: any) {
      this.mensaje = e?.message || 'Error inesperado al guardar';
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  confirmarEliminar(id: number) {
    this.eliminarId = id;
    this.mostrarModalEliminar = true;
  }

  cerrarModalEliminar() {
    this.mostrarModalEliminar = false;
    this.eliminarId = null;
    this.eliminando = false;
  }

  async ejecutarEliminar() {
    if (!this.esAdmin || this.eliminarId == null) return;
    this.eliminando = true;
    this.mensaje = '';

    try {
      const { error } = await this.viajeService.deleteViaje(this.eliminarId);
      if (error) { this.mensaje = error.message; this.cerrarModalEliminar(); return; }
      this.cerrarModalEliminar();
      await this.cargar();
      if (!this.mensaje) {
        this.mostrarSuccess('Viaje eliminado correctamente');
      }
    } catch (e: any) {
      this.mensaje = e?.message || 'Error inesperado al eliminar';
    } finally {
      this.eliminando = false;
      this.cdr.detectChanges();
    }
  }
}
