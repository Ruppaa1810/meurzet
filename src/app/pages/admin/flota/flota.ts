import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PerfilService } from '../../../services/perfil.service';
import { UnidadService } from '../../../services/unidad.service';
import type { Unidad, UserRole } from '../../../models/database.types';

@Component({
  selector: 'app-admin-flota',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './flota.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Flota implements OnInit {
  unidades: Unidad[] = [];
  loading = false;
  guardando = false;
  mensaje = '';
  successMensaje = '';
  modalAbierto = false;
  editando = false;
  editandoId: number | null = null;

  // Estadísticas
  get totalUnidades(): number {
    return this.unidades.length;
  }

  get totalAsientos(): number {
    return this.unidades.reduce((sum, u) => sum + u.asientos_totales, 0);
  }

  get unidades1Piso(): number {
    return this.unidades.filter(u => u.pisos === 1).length;
  }

  get unidades2Pisos(): number {
    return this.unidades.filter(u => u.pisos === 2).length;
  }

  // Paginación
  currentPage = 1;
  readonly itemsPerPage = 6;

  get paginatedUnidades(): Unidad[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.unidades.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.unidades.length / this.itemsPerPage));
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  irAPagina(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  // Modal eliminar
  mostrarModalEliminar = false;
  eliminarId: number | null = null;
  eliminando = false;

  rol: UserRole | null = null;

  form = { patente: '', empresa: '', pisos: 1 as 1 | 2, asientos_totales: 0 };

  constructor(
    private perfilService: PerfilService,
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
    try {
      const { data, error } = await this.unidadService.getUnidades();
      if (error) { this.mensaje = error.message; } else { this.unidades = data ?? []; }
    } catch (e: any) {
      this.mensaje = e?.message || 'Error al cargar unidades';
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  abrirModal(unidad?: Unidad) {
    if (unidad) {
      this.editando = true;
      this.editandoId = unidad.id;
      this.form = { patente: unidad.patente, empresa: (unidad.layout_config?.['empresa'] as string) || '', pisos: unidad.pisos, asientos_totales: unidad.asientos_totales };
    } else {
      this.editando = false;
      this.editandoId = null;
      this.form = { patente: '', empresa: '', pisos: 1, asientos_totales: 0 };
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

  async guardar() {
    if (!this.esAdmin) return;
    if (!this.form.patente.trim() || this.form.asientos_totales < 1) return;

    this.guardando = true;
    this.mensaje = '';

    try {
      const payload = {
        patente: this.form.patente,
        pisos: this.form.pisos,
        asientos_totales: this.form.asientos_totales,
        layout_config: { empresa: this.form.empresa },
      };

      if (this.editando && this.editandoId != null) {
        const { error } = await this.unidadService.updateUnidad(this.editandoId, payload);
        if (error) { this.mensaje = error.message; return; }
      } else {
        const { error } = await this.unidadService.createUnidad(payload);
        if (error) { this.mensaje = error.message; return; }
      }

      this.modalAbierto = false;
      await this.cargar();
      if (!this.mensaje) {
        this.mostrarSuccess(this.editando ? 'Unidad actualizada correctamente' : 'Unidad creada correctamente');
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
      const { error } = await this.unidadService.deleteUnidad(this.eliminarId);
      if (error) { this.mensaje = error.message; this.cerrarModalEliminar(); return; }
      this.cerrarModalEliminar();
      await this.cargar();
      if (!this.mensaje) {
        this.mostrarSuccess('Unidad eliminada correctamente');
      }
    } catch (e: any) {
      this.mensaje = e?.message || 'Error inesperado al eliminar';
    } finally {
      this.eliminando = false;
      this.cdr.detectChanges();
    }
  }
}
