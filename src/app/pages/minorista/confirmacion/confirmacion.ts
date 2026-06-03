import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { SupabaseService } from '../../../services/supabase.service';
import { ReservaStateService } from '../../../services/reserva-state.service';

@Component({
  selector: 'app-confirmacion',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './confirmacion.html',
})
export class Confirmacion implements OnInit {
  subiendo = false;
  comprobanteSubido = false;
  mensaje = '';

  constructor(
    public reservaState: ReservaStateService,
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    if (!this.reservaState.viaje || this.reservaState.asientos.length === 0) {
      this.router.navigate(['/minorista/vender'], { replaceUrl: true });
    }
  }

  get total(): number {
    return this.reservaState.total;
  }

  get montoAPagar(): number {
    if (this.reservaState.tipoPagoMode === 'personalizado') return this.reservaState.montoPersonalizado;
    return Math.round(this.total * this.reservaState.porcentajePago / 100);
  }

  get pagoLabel(): string {
    if (this.reservaState.tipoPagoMode === 'total') return 'Pago Total';
    if (this.reservaState.tipoPagoMode === 'personalizado') return `Personalizado (${this.reservaState.porcentajePago}%)`;
    return `Seña (${this.reservaState.porcentajePago}%)`;
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }

  pisoLabel(piso: number): string {
    return piso === 1 ? 'Baja' : 'Alta';
  }

  async subirComprobante(event: Event, fileInput?: HTMLInputElement) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.reservaState.reservaIds.length === 0) return;

    this.subiendo = true;
    this.mensaje = '';
    this.comprobanteSubido = false;
    this.cdr.detectChanges();

    try {
      const userId = (await this.supabaseService.supabase.auth.getSession()).data.session?.user?.id;
      if (!userId) {
        this.mensaje = 'Sesión expirada';
        return;
      }

      const basePath = `${userId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await this.supabaseService.subirComprobante(basePath, file);
      if (uploadError) {
        this.mensaje = 'Error al subir el comprobante: ' + uploadError.message;
        return;
      }

      const { data: signedUrl, error: signedError } = await this.supabaseService.supabase.storage
        .from('comprobantes')
        .createSignedUrl(basePath, 60 * 60 * 24 * 365);
      if (signedError || !signedUrl?.signedUrl) {
        this.mensaje = 'Error al generar enlace del comprobante';
        return;
      }

      const { error: updateError } = await this.supabaseService.supabase
        .from('reservas')
        .update({ comprobante_url: signedUrl.signedUrl, estado: 'pendiente_validacion' })
        .in('id', this.reservaState.reservaIds);
      if (updateError) {
        this.mensaje = 'Error al actualizar reserva: ' + updateError.message;
        return;
      }

      this.comprobanteSubido = true;
      this.mensaje = '';
    } catch (e: any) {
      this.mensaje = e?.message || 'Error inesperado al subir el comprobante';
    } finally {
      this.subiendo = false;
      if (fileInput) fileInput.value = '';
      this.cdr.detectChanges();
    }
  }
}
