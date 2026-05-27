import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../services/supabase.service';
import { AuthStore } from '../../../services/auth-store.service';
import type { Unidad } from '../../../models/database.types';

@Component({
  selector: 'app-flota',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './flota.html',
})
export class Flota implements OnInit {
  unidades: Unidad[] = [];
  loading = false;
  mensaje = '';
  modalAbierto = false;
  editando = false;
  editandoId: number | null = null;

  form = { patente: '', empresa: '', pisos: 1 as 1 | 2, asientos_totales: 0 };

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
    private authStore: AuthStore,
  ) { }

  get esAdmin(): boolean {
    return this.authStore.rol === 'admin_mayorista';
  }

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    this.loading = true;
    const { data, error } = await this.supabaseService.getUnidades();
    if (error) { this.mensaje = error.message; } else { this.unidades = data ?? []; }
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

  async guardar() {
    if (!this.esAdmin) return;
    if (!this.form.patente.trim() || this.form.asientos_totales < 1) return;

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
  }

  async eliminar(id: number) {
    if (!this.esAdmin) return;
    if (!confirm('¿Eliminar esta unidad?')) return;
    const { error } = await this.supabaseService.deleteUnidad(id);
    if (error) { this.mensaje = error.message; return; }
    await this.cargar();
  }
}
