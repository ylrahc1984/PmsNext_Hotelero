import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { CierreCajaService } from './cierre-caja.service';
import {
  CierreCajaDenominacionReporte,
  CierreCajaDocumento,
  CierreCajaFormaPagoReporte,
  CierreCajaPosConsumoColaborador,
  CierreCajaPosPlatoEliminado,
  CierreCajaReporteDetalle,
  CierreCajaResumenFormaPago
} from './models/cierre-caja.model';

type CierreCajaDetalleTab = 'documentos' | 'consumos' | 'pagos' | 'denominaciones' | 'platosEliminados';

@Component({
  selector: 'app-cierre-caja-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: './cierre-caja-detalle.component.html',
  styleUrls: ['./cierre-caja-detalle.component.scss']
})
export class CierreCajaDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cierreCajaService = inject(CierreCajaService);

  reporte: CierreCajaReporteDetalle | null = null;
  numCierre = '';
  isLoading = false;
  isPrinting = false;
  errorMessage = '';
  activeTab: CierreCajaDetalleTab = 'documentos';

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.numCierre = this.cleanText(params.get('numCierre'));
      this.loadDetalle();
    });
  }

  setTab(tab: CierreCajaDetalleTab): void {
    this.activeTab = tab;
  }

  volver(): void {
    let route = '/operaciones/cierre-caja';
    if (this.router.url.startsWith('/restaurante/cierre-caja')) {
      route = '/restaurante/cierre-caja';
    } else if (this.router.url.startsWith('/front-desk/cierre-caja')) {
      route = '/front-desk/cierre-caja';
    }
    void this.router.navigate([route]);
  }

  imprimirPdf(): void {
    if (!this.numCierre || this.isPrinting) {
      return;
    }

    this.isPrinting = true;
    this.cierreCajaService
      .getCierreCajaPdf(this.numCierre)
      .pipe(
        finalize(() => (this.isPrinting = false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (blob) => this.openPdfBlob(blob, `Cierre_Caja_${this.numCierre}.pdf`),
        error: (error: unknown) => {
          window.alert(error instanceof Error ? error.message : 'No se pudo generar el PDF del cierre de caja.');
        }
      });
  }

  get documentos(): CierreCajaDocumento[] {
    return this.reporte?.documentos ?? [];
  }

  get notasCredito(): CierreCajaDocumento[] {
    return this.reporte?.notasCredito ?? [];
  }

  get pagosDocumentos(): CierreCajaFormaPagoReporte[] {
    return this.reporte?.formasPagoDocumentos ?? [];
  }

  get pagosNotasPedido(): CierreCajaFormaPagoReporte[] {
    return this.reporte?.formasPagoNotasPedido ?? [];
  }

  get resumenFormasPago(): CierreCajaResumenFormaPago[] {
    return this.reporte?.resumenFormasPago ?? [];
  }

  get denominaciones(): CierreCajaDenominacionReporte[] {
    return this.reporte?.denominaciones ?? [];
  }

  get consumosColaborador(): CierreCajaPosConsumoColaborador[] {
    return this.reporte?.consumosColaborador ?? [];
  }

  get platosEliminados(): CierreCajaPosPlatoEliminado[] {
    return this.reporte?.platosEliminados ?? [];
  }

  get totalesPorFormaPago(): Array<{ descripcion: string; total: number }> {
    return Object.entries(this.reporte?.resumen?.totalesPorFormaPago ?? {}).map(([descripcion, total]) => ({
      descripcion,
      total
    }));
  }

  get totalPagosDocumentos(): number {
    return this.sum(this.pagosDocumentos.map((item) => item.monto));
  }

  get totalPagosNotasPedido(): number {
    return this.sum(this.pagosNotasPedido.map((item) => item.monto));
  }

  get totalDenominacionesMN(): number {
    return this.sum(this.denominaciones.map((item) => item.totalMonedaNacional));
  }

  get totalDenominacionesME(): number {
    return this.sum(this.denominaciones.map((item) => item.totalMonedaExtranjera));
  }

  estadoClass(estado: string): string {
    const value = this.cleanText(estado).toUpperCase();
    if (value === 'C' || value === 'CER' || value === 'CERRADO') return 'cc-status cc-status--closed';
    if (value === 'P' || value === 'ABI' || value === 'ABIERTO') return 'cc-status cc-status--open';
    if (value === 'A' || value.includes('ANU')) return 'cc-status cc-status--void';
    return 'cc-status';
  }

  trackByDocumento(index: number, item: CierreCajaDocumento): string {
    return `${item.tipoDocumento}-${item.serie}-${item.numeroDocumento}-${index}`;
  }

  trackByPago(index: number, item: CierreCajaFormaPagoReporte): string {
    return `${item.codFormaPago}-${item.moneda}-${item.monto}-${index}`;
  }

  trackByResumenPago(index: number, item: CierreCajaResumenFormaPago): string {
    return `${item.codFormaPago}-${item.moneda}-${item.total}-${index}`;
  }

  trackByDenominacion(index: number, item: CierreCajaDenominacionReporte): string {
    return `${item.codDenominacion}-${item.moneda}-${index}`;
  }

  trackByConsumo(index: number, item: CierreCajaPosConsumoColaborador): string {
    return `${item.tipo}-${item.numero}-${index}`;
  }

  trackByPlatoEliminado(index: number, item: CierreCajaPosPlatoEliminado): string {
    return `${item.tipNdp}-${item.numNdp}-${item.codProducto}-${index}`;
  }

  private loadDetalle(): void {
    if (!this.numCierre) {
      this.errorMessage = 'No se recibió el número de cierre.';
      this.reporte = null;
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cierreCajaService
      .getCierreCajaReporte(this.numCierre)
      .pipe(
        finalize(() => (this.isLoading = false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (reporte) => {
          this.reporte = reporte;
        },
        error: (error: unknown) => {
          this.reporte = null;
          this.errorMessage = error instanceof Error ? error.message : 'No se pudo consultar el detalle del cierre de caja.';
        }
      });
  }

  private sum(values: unknown[]): number {
    return this.round(values.reduce<number>((total, value) => total + this.toNumber(value), 0));
  }

  private cleanText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round(value: number): number {
    return Math.round((this.toNumber(value) + Number.EPSILON) * 100) / 100;
  }

  private openPdfBlob(blob: Blob, filename: string): void {
    const pdfBlob = new Blob([blob], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(pdfBlob);
    const opened = window.open(objectUrl, '_blank', 'noopener');

    if (!opened) {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}
