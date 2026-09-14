import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComisionService } from '../../../services/comision.service';

interface ConfigConPerfil {
  id: number;
  vendedor_id: string;
  porcentaje: number;
  activo: boolean;
  perfiles?: { nombre: string; email: string | null } | null;
}

@Component({
  selector: 'app-comisiones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comisiones.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Comisiones implements OnInit {
  configs: ConfigConPerfil[] = [];
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
    const { data, error } = await this.comisionService.getConfigsAll();
    if (error) { this.mensaje = error.message; this.loading = false; this.cdr.detectChanges(); return; }
    this.configs = (data || []) as ConfigConPerfil[];
    this.loading = false;
    this.cdr.detectChanges();
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
