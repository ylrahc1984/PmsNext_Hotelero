import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RecepcionFacturasService } from '../recepcion-facturas.service';
import {
  CompraServicioDetalleData,
  CompraServicioDetalleEncabezado,
  CompraServicioDetalleLinea,
  CompraServicioPagoProveedor
} from '../interfaces/compra-servicio-detalle.interface';

@Component({
  selector: 'app-compra-servicio-detalle',
  standalone: true,
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './compra-servicio-detalle.component.html',
  styleUrls: ['./compra-servicio-detalle.component.scss']
})
export class CompraServicioDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recepcionFacturasService = inject(RecepcionFacturasService);

  loading = false;
  errorMessage = '';
  detalle: CompraServicioDetalleData | null = null;

  get encabezado(): CompraServicioDetalleEncabezado | null {
    return this.detalle?.encabezado ?? null;
  }

  get detalleLineas(): CompraServicioDetalleLinea[] {
    return this.detalle?.detalle ?? [];
  }

  get pagosProveedor(): CompraServicioPagoProveedor[] {
    return this.detalle?.pagosProveedor ?? [];
  }

  ngOnInit(): void {
    const tipDocu = this.normalize(this.route.snapshot.paramMap.get('tipDocu'));
    const numDocu = this.normalize(this.route.snapshot.paramMap.get('numDocu'));

    if (!tipDocu || !numDocu) {
      this.errorMessage = 'No se recibieron los parámetros necesarios para consultar el detalle.';
      return;
    }

    if (tipDocu !== 'SRV') {
      this.errorMessage = `El detalle para el tipo ${tipDocu} aún no está implementado.`;
      return;
    }

    void this.loadDetalle(tipDocu, numDocu);
  }

  volver(): void {
    this.router.navigate(['/compras/recepcion-facturas']);
  }

  trackByLinea(index: number, item: CompraServicioDetalleLinea): number | string {
    return item.PAC02_Orden || index;
  }

  trackByPago(index: number, item: CompraServicioPagoProveedor): number | string {
    return item.PAC05_NumInterno || `${item.PAC05_TipDocu}-${item.PAC05_NumDocu}-${index}`;
  }

  formatDate(value?: string): string {
    const trimmed = this.normalize(value);
    if (!trimmed) {
      return 'N/D';
    }

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return trimmed;
    }

    return new Intl.DateTimeFormat('es-CR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  formatDateTime(dateValue?: string, timeValue?: string): string {
    const date = this.formatDate(dateValue);
    const time = this.normalize(timeValue);
    return time ? `${date} ${time}` : date;
  }

  formatMoney(value?: number): string {
    return new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(this.toNumber(value));
  }

  estadoBadgeClass(estado?: string): string {
    const normalized = this.normalize(estado).toUpperCase();
    switch (normalized) {
      case 'ABI':
        return 'badge-soft badge-soft-primary';
      case 'PAG':
        return 'badge-soft badge-soft-success';
      case 'ANU':
        return 'badge-soft badge-soft-danger';
      default:
        return 'badge-soft badge-soft-neutral';
    }
  }

  private async loadDetalle(tipDocu: string, numDocu: string): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      this.detalle = await firstValueFrom(this.recepcionFacturasService.getCompraServicioDetalle(tipDocu, numDocu));
      if (!this.detalle?.encabezado) {
        this.errorMessage = 'No se encontró información del documento solicitado.';
      }
    } catch (error) {
      console.error('No se pudo cargar el detalle de la compra de servicios.', error);
      this.errorMessage = 'No se pudo cargar el detalle de la compra de servicios.';
    } finally {
      this.loading = false;
    }
  }

  private normalize(value?: string | null): string {
    return (value ?? '').toString().trim();
  }

  private toNumber(value?: number | null): number {
    return Number.isFinite(value as number) ? Number(value) : 0;
  }
}
