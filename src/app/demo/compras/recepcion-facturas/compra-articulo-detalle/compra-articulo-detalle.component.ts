import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RecepcionFacturasService } from '../recepcion-facturas.service';
import {
  CompraArticuloDetalleData,
  CompraArticuloDetalleEncabezado,
  CompraArticuloDetalleLinea,
  CompraArticuloPago
} from '../interfaces/compra-articulo-detalle.interface';

@Component({
  selector: 'app-compra-articulo-detalle',
  standalone: true,
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './compra-articulo-detalle.component.html',
  styleUrls: ['./compra-articulo-detalle.component.scss']
})
export class CompraArticuloDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recepcionFacturasService = inject(RecepcionFacturasService);

  loading = false;
  errorMessage = '';
  detalle: CompraArticuloDetalleData | null = null;

  get encabezado(): CompraArticuloDetalleEncabezado | null {
    return this.detalle?.encabezado ?? null;
  }

  get detalleLineas(): CompraArticuloDetalleLinea[] {
    return this.detalle?.detalle ?? [];
  }

  get pagos(): CompraArticuloPago[] {
    return this.detalle?.pagos ?? [];
  }

  ngOnInit(): void {
    const tipDocu = this.normalize(this.route.snapshot.paramMap.get('tipDocu'));
    const numDocu = this.normalize(this.route.snapshot.paramMap.get('numDocu'));

    if (!tipDocu || !numDocu) {
      this.errorMessage = 'No se recibieron los parámetros necesarios para consultar el detalle.';
      return;
    }

    if (tipDocu !== 'CMP') {
      this.errorMessage = `El detalle para el tipo ${tipDocu} aún no está implementado.`;
      return;
    }

    void this.loadDetalle(tipDocu, numDocu);
  }

  volver(): void {
    this.router.navigate(['/compras/recepcion-facturas']);
  }

  trackByLinea(index: number, item: CompraArticuloDetalleLinea): number | string {
    return item.orden || index;
  }

  trackByPago(index: number, item: CompraArticuloPago): number | string {
    return item.numInterno || `${item.tipDocu}-${item.numDocu}-${index}`;
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

  formatDateTime(dateValue?: string, timeValue?: string | null): string {
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
      this.detalle = await firstValueFrom(this.recepcionFacturasService.getCompraArticuloDetalle(tipDocu, numDocu));
      if (!this.detalle?.encabezado) {
        this.errorMessage = 'No se encontró información del documento solicitado.';
      }
    } catch (error) {
      console.error('No se pudo cargar el detalle de la compra de artículos.', error);
      this.errorMessage = 'No se pudo cargar el detalle de la compra de artículos.';
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
