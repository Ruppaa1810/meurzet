import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigGeneralService, BancoConfig } from '../../../services/config-general.service';

/** Datos que la agencia muestra a sus clientes en los comprobantes: cuenta para transferir y contacto. */
@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './configuracion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configuracion implements OnInit {
  banco: BancoConfig = { alias: '', cbu: '', titular: '', banco: '' };
  contacto = '';
  loading = true;
  guardando = false;
  error = '';
  exito = '';

  constructor(private config: ConfigGeneralService, private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    this.config.invalidate();
    [this.banco, this.contacto] = await Promise.all([this.config.getBanco(), this.config.getContacto()]);
    this.banco = { ...this.banco };
    this.loading = false;
    this.cdr.detectChanges();
  }

  /** CBU y CVU tienen 22 dígitos. */
  get cbuValido(): boolean {
    return /^\d{22}$/.test(this.banco.cbu.trim());
  }

  get completo(): boolean {
    return !!(this.banco.alias.trim() && this.banco.titular.trim() && this.banco.banco.trim() && this.contacto.trim() && this.cbuValido);
  }

  async guardar() {
    if (!this.completo) return;
    this.guardando = true;
    this.error = '';
    this.exito = '';
    this.cdr.detectChanges();

    const banco: BancoConfig = {
      alias: this.banco.alias.trim().toUpperCase(),
      cbu: this.banco.cbu.trim(),
      titular: this.banco.titular.trim(),
      banco: this.banco.banco.trim(),
    };
    const [rb, rc] = await Promise.all([this.config.setBanco(banco), this.config.setContacto(this.contacto.trim())]);
    const err = rb.error || rc.error;
    if (err) {
      this.error = 'No se pudo guardar: ' + err.message;
    } else {
      this.banco = banco;
      this.exito = 'Datos guardados. Ya aparecen en los comprobantes nuevos.';
      setTimeout(() => { this.exito = ''; this.cdr.detectChanges(); }, 5000);
    }
    this.guardando = false;
    this.cdr.detectChanges();
  }
}
