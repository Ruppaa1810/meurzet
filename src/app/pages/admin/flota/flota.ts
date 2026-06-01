import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../services/supabase.service';
import type { Unidad, UserRole } from '../../../models/database.types';

@Component({
  selector: 'app-flota',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './flota.html',
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

  // Modal eliminar
  mostrarModalEliminar = false;
  eliminarId: number | null = null;
  eliminando = false;

  rol: UserRole | null = null;

  form = { patente: '', empresa: '', pisos: 1 as 1 | 2, asientos_totales: 0 };

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
  ) { }

  get esAdmin(): boolean {
    return this.rol === 'admin_mayorista';
  }

  async ngOnInit() {
    try {
      const { data } = await this.supabaseService.getCurrentProfile();
      if (data) this.rol = data.rol;
    } catch {
    }
    this.cargar();
  }

  async cargar() {
    this.loading = true;
    this.mensaje = '';
    try {
      const { data, error } = await this.supabaseService.getUnidades();
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
        const { error } = await this.supabaseService.updateUnidad(this.editandoId, payload);
        if (error) { this.mensaje = error.message; return; }
      } else {
        const { error } = await this.supabaseService.createUnidad(payload);
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
      const { error } = await this.supabaseService.deleteUnidad(this.eliminarId);
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
