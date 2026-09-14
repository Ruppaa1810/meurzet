import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LugarEmbarqueService } from '../../../services/lugar-embarque.service';
import type { LugarEmbarque } from '../../../models/database.types';

@Component({
  selector: 'app-lugares-embarque',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lugares-embarque.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LugaresEmbarque implements OnInit {
  lugares: LugarEmbarque[] = [];
  loading = true;
  mensaje = '';
  successMensaje = '';
  private successTimeout: any = null;

  modalAbierto = false;
  editando: LugarEmbarque | null = null;
  guardando = false;
  form = { nombre: '', direccion: '', ciudad: '' };

  mostrarModalEliminar = false;
  eliminarId: number | null = null;
  eliminando = false;

  constructor(
    private lugarService: LugarEmbarqueService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.loading = true;
    this.mensaje = '';
    const { data, error } = await this.lugarService.getLugaresAll();
    if (error) { this.mensaje = error.message; this.loading = false; this.cdr.detectChanges(); return; }
    this.lugares = data || [];
    this.loading = false;
    this.cdr.detectChanges();
  }

  abrirModal(lugar?: LugarEmbarque) {
    this.mensaje = '';
    if (lugar) {
      this.editando = lugar;
      this.form = { nombre: lugar.nombre, direccion: lugar.direccion || '', ciudad: lugar.ciudad || '' };
    } else {
      this.editando = null;
      this.form = { nombre: '', direccion: '', ciudad: '' };
    }
    this.modalAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModal() {
    this.modalAbierto = false;
    this.editando = null;
    this.guardando = false;
  }

  async guardar() {
    if (!this.form.nombre.trim()) {
      this.mensaje = 'El nombre es obligatorio';
      this.cdr.detectChanges();
      return;
    }
    this.mensaje = '';
    this.guardando = true;

    if (this.editando) {
      const { error } = await this.lugarService.updateLugar(this.editando.id, {
        nombre: this.form.nombre.trim(),
        direccion: this.form.direccion.trim() || null,
        ciudad: this.form.ciudad.trim() || null,
      });
      if (error) { this.mensaje = error.message; this.guardando = false; this.cdr.detectChanges(); return; }
    } else {
      const { error } = await this.lugarService.createLugar({
        nombre: this.form.nombre.trim(),
        direccion: this.form.direccion.trim() || null,
        ciudad: this.form.ciudad.trim() || null,
      });
      if (error) { this.mensaje = error.message; this.guardando = false; this.cdr.detectChanges(); return; }
    }

    this.cerrarModal();
    await this.cargar();
    this.mostrarSuccess(this.editando ? 'Lugar actualizado' : 'Lugar creado correctamente');
  }

  async toggleActivo(lugar: LugarEmbarque) {
    const { error } = await this.lugarService.updateLugar(lugar.id, { activo: !lugar.activo });
    if (error) { this.mensaje = error.message; this.cdr.detectChanges(); return; }
    lugar.activo = !lugar.activo;
    this.cdr.detectChanges();
  }

  confirmarEliminar(id: number) {
    this.eliminarId = id;
    this.mostrarModalEliminar = true;
    this.mensaje = '';
    this.cdr.detectChanges();
  }

  cerrarModalEliminar() {
    this.mostrarModalEliminar = false;
    this.eliminarId = null;
    this.eliminando = false;
  }

  async ejecutarEliminar() {
    if (!this.eliminarId) return;
    this.eliminando = true;
    const { error } = await this.lugarService.deleteLugar(this.eliminarId);
    if (error) { this.mensaje = error.message; this.eliminando = false; this.cdr.detectChanges(); return; }
    this.cerrarModalEliminar();
    await this.cargar();
    this.mostrarSuccess('Lugar eliminado correctamente');
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
