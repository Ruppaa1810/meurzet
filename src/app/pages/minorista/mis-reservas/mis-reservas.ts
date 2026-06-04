import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../services/auth.service';
import { PerfilService } from '../../../services/perfil.service';
import { ReservaService } from '../../../services/reserva.service';
import { ViajeService } from '../../../services/viaje.service';
import { StorageService } from '../../../services/storage.service';
import { PagoService } from '../../../services/pago.service';
import { ComprobanteService, DatosComprobante } from '../../../services/comprobante.service';
import type { Reserva, Viaje, PagoMovimiento } from '../../../models/database.types';
import { derivarEstadoFinanciero, estadoFinancieroLabel, estadoFinancieroClass, estadoFinancieroDot } from '../../../utils/estado-financiero';

interface ReservaView extends Reserva {
  viajeLabel: string;
  pasajeroNombre: string;
  monto: number;
  uploading: boolean;
  uploadMsg: string;
  uploadOk: boolean;
  pagos: PagoMovimiento[];
  mostrandoPagos: boolean;
}

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './mis-reservas.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisReservas implements OnInit {
  Math = Math;
  reservas: ReservaView[] = [];
  loading = true;

  constructor(
    private authService: AuthService,
    private perfilService: PerfilService,
    private reservaService: ReservaService,
    private viajeService: ViajeService,
    private storageService: StorageService,
    private pagoService: PagoService,
    private comprobanteService: ComprobanteService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    try {
      const { data: perfil } = await this.perfilService.getCurrentProfile();
      if (!perfil?.id) return;

      const { data: raw } = await this.reservaService.getReservasPorVendedor(perfil.id);
      if (!raw) return;

      const viajeIds = [...new Set(raw.map(r => r.viaje_id).filter(Boolean))] as number[];
      const viajesMap = new Map<number, { label: string; precio: number }>();

      for (const id of viajeIds) {
        const { data } = await this.viajeService.getViajePorId(id);
        if (data) viajesMap.set(id, { label: `${data.origen} → ${data.destino}`, precio: data.precio_base });
      }

      this.reservas = await Promise.all(raw.map(async r => {
        const d = (r.pasajero_datos || {}) as Record<string, any>;
        const nom = [d['nombre'], d['apellido']].filter(Boolean).join(' ') || '-';
        const viajeInfo = viajesMap.get(r.viaje_id!);
        const pct = typeof d['porcentaje_pago'] === 'number' ? d['porcentaje_pago'] : 1;
        const monto = viajeInfo ? Math.round(viajeInfo.precio * pct) : 0;
        const { data: pagos } = await this.pagoService.getPagosPorReserva(r.id);
        return { ...r, viajeLabel: viajeInfo?.label || `Viaje #${r.viaje_id}`, pasajeroNombre: nom, monto, uploading: false, uploadMsg: '', uploadOk: false, pagos: pagos || [], mostrandoPagos: false };
      }));
    } catch {
    }
    this.loading = false;
    this.cdr.detectChanges();
  }

  efLabel(r: ReservaView): string {
    return estadoFinancieroLabel(derivarEstadoFinanciero(r.estado, r.tipo_pago));
  }

  efClass(r: ReservaView): string {
    return estadoFinancieroClass(derivarEstadoFinanciero(r.estado, r.tipo_pago));
  }

  efDot(r: ReservaView): string {
    return estadoFinancieroDot(derivarEstadoFinanciero(r.estado, r.tipo_pago));
  }

  get montoTotalPagado(): number {
    return this.reservas.reduce((sum, r) => sum + (r.pagos?.filter(p => p.estado_pago === 'confirmado').reduce((s, p) => s + p.monto, 0) || 0), 0);
  }

  togglePagos(r: ReservaView) {
    r.mostrandoPagos = !r.mostrandoPagos;
  }

  verComprobante(r: ReservaView) {
    const viajeInfo = { origen: '', destino: '', fecha_salida: '', fecha_llegada: '' };
    const datos: DatosComprobante = {
      codigo: `MEU-${String(r.id).padStart(6, '0')}`,
      viaje: { ...viajeInfo, ...r, precio_base: r.monto } as any,
      asientos: [{ asientoId: r.asiento_viaje_id || 0, nroAsiento: 0, piso: 1, categoria: '' }],
      pasajeros: [{ nombre: r.pasajeroNombre, apellido: '', documento: '', email: '', telefono: '' }],
      total: r.monto,
      montoPagado: r.pagos?.filter(p => p.estado_pago === 'confirmado').reduce((s, p) => s + p.monto, 0) || 0,
      pagoLabel: this.estadoLabel(r.estado || ''),
      fecha: new Date().toLocaleString('es-AR'),
    };
    this.comprobanteService.abrirParaImprimir(datos);
  }

  estadoLabel(estado: string | null): string {
    const map: Record<string, string> = {
      pendiente_comprobante: 'Pendiente de comprobante',
      pendiente_validacion: 'Pendiente de validación',
      aprobado: 'Aprobado',
      rechazado: 'Rechazado',
    };
    return estado ? map[estado] || estado : 'Desconocido';
  }

  formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatPrecio(precio: number): string {
    return `$ ${precio.toLocaleString('es-AR')}`;
  }

  async subirComprobante(reserva: ReservaView, event: Event, fileInput?: HTMLInputElement) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    reserva.uploading = true;
    reserva.uploadMsg = '';
    reserva.uploadOk = false;
    this.cdr.detectChanges();

    try {
      const userId = (await this.authService.getSession()).data.session?.user?.id;
      if (!userId) {
        reserva.uploadMsg = 'Sesión expirada';
        return;
      }

      const basePath = `${userId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await this.storageService.subirComprobante(basePath, file);
      if (uploadError) {
        reserva.uploadMsg = 'Error al subir: ' + uploadError.message;
        return;
      }

      const { data: signedUrl, error: signedError } = await this.storageService.getComprobanteUrl(basePath);
      if (signedError || !signedUrl?.signedUrl) {
        reserva.uploadMsg = 'Error al generar enlace del comprobante';
        return;
      }

      const { error: updateError } = await this.reservaService.actualizarComprobanteSingle(reserva.id, signedUrl.signedUrl);

      if (updateError) {
        reserva.uploadMsg = 'Error al actualizar: ' + updateError.message;
        return;
      }

      reserva.estado = 'pendiente_validacion';
      reserva.uploadOk = true;
      reserva.uploadMsg = '';
    } catch (e: any) {
      reserva.uploadMsg = e?.message || 'Error inesperado';
    } finally {
      reserva.uploading = false;
      if (fileInput) fileInput.value = '';
      this.cdr.detectChanges();
    }
  }
}
