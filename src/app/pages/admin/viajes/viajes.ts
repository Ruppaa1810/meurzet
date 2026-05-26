import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../services/supabase.service';
import { AuthStore } from '../../../services/auth-store.service';
import type { Viaje, Unidad } from '../../../models/database.types';

@Component({
  selector: 'app-viajes-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './viajes.html',
})
export class Viajes implements OnInit {
  viajes: Viaje[] = [];
  unidades: Unidad[] = [];
  loading = false;
  mensaje = '';
  modalAbierto = false;
  editando = false;
  editandoId: number | null = null;

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
    const [viajesRes, unidadesRes] = await Promise.all([
      this.supabaseService.getViajesAdmin(),
      this.supabaseService.getUnidades(),
    ]);
    if (viajesRes.error) { this.mensaje = viajesRes.error.message; }
    else { this.viajes = viajesRes.data ?? []; }
    if (!unidadesRes.error) { this.unidades = unidadesRes.data ?? []; }
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

  async guardar() {
    if (!this.esAdmin) return;
    if (!this.form.origen.trim() || !this.form.destino.trim() || !this.form.fecha_salida || !this.form.fecha_llegada) return;

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
      const { error } = await this.supabaseService.updateViaje(this.editandoId, payload);
      if (error) { this.mensaje = error.message; return; }
    } else {
      const { error } = await this.supabaseService.createViaje(payload);
      if (error) { this.mensaje = error.message; return; }
    }

    this.modalAbierto = false;
    await this.cargar();
  }

  async eliminar(id: number) {
    if (!this.esAdmin) return;
    if (!confirm('¿Eliminar este viaje?')) return;
    const { error } = await this.supabaseService.deleteViaje(id);
    if (error) { this.mensaje = error.message; return; }
    await this.cargar();
  }
}
