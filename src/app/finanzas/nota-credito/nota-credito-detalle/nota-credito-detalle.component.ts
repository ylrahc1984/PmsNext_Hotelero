import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  NotaCreditoDetalleEncabezado,
  NotaCreditoDetalleImpuesto,
  NotaCreditoDetalleLinea,
  NotaCreditoDetalleResponse
} from '../interfaces/notas-credito.interface';
import { NotasCreditoService } from '../services/notas-credito.service';

@Component({
  selector: 'app-nota-credito-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: './nota-credito-detalle.component.html',
  styleUrls: ['./nota-credito-detalle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotaCreditoDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notasCreditoService = inject(NotasCreditoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  tipo = '';
  serie = '';
  numero = '';
  loading = false;
  generandoPdf = false;
  errorMsg: string | null = null;

  encabezado: NotaCreditoDetalleEncabezado | null = null;
  detalle: NotaCreditoDetalleLinea[] = [];
  impuestos: NotaCreditoDetalleImpuesto[] = [];

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.tipo = (params.get('tipo') ?? '').toString().trim();
      this.serie = (params.get('serie') ?? '').toString().trim();
      this.numero = (params.get('numero') ?? '').toString().trim();

      if (!this.tipo || !this.serie || !this.numero) {
        this.router.navigate([this.notasCreditoRoute]);
        return;
      }

      this.fetchDetalle();
    });
  }

  get documentoCodigo(): string {
    const h = this.encabezado;
    const tipo = (h?.PFD07_TipNotaCredito || this.tipo || '').toString().trim().toUpperCase();
    const serie = (h?.PFD07_SerieNotaCredito || this.serie || '').toString().trim();
    const numero = (h?.PFD07_NumNotaCredito || this.numero || '').toString().trim();
    return [tipo, serie, numero].filter(Boolean).join('-');
  }

  get documentoRelacionado(): string {
    const h = this.encabezado;
    if (!h) return '-';
    return [h.PFD07_TipDocCli, h.PFD07_SerieDocCli, h.PFD07_NumDocCli].map((value) => this.text(value)).filter(Boolean).join('-') || '-';
  }

  get moneda(): string {
    return this.text(this.encabezado?.PFD07_Moneda) || this.text(this.detalle[0]?.PFD08_Moneda) || 'USD';
  }

  get currencyCode(): string {
    const code = this.moneda.toUpperCase();
    if (code === 'COL' || code === 'CRC') return 'CRC';
    if (code === 'DOL') return 'USD';
    return code || 'USD';
  }

  get subtotal(): number {
    return this.number(this.encabezado?.PFD07_SubTotal);
  }

  get impuesto(): number {
    return this.number(this.encabezado?.PFD07_Impuesto);
  }

  get total(): number {
    return this.number(this.encabezado?.PFD07_Total);
  }

  volver(): void {
    this.router.navigate([this.notasCreditoRoute]);
  }

  private get notasCreditoRoute(): string {
    return this.router.url.startsWith('/front-desk/notas-credito') ? '/front-desk/notas-credito' : '/finanzas/notas-credito';
  }

  imprimir(): void {
    window.alert('Impresión pendiente de implementar.');
  }

  descargarPdf(): void {
    const tipo = this.normalizeDocumentPart(this.encabezado?.PFD07_TipNotaCredito || this.tipo).toLowerCase();
    const serie = this.normalizeDocumentPart(this.encabezado?.PFD07_SerieNotaCredito || this.serie);
    const numero = this.normalizeDocumentPart(this.encabezado?.PFD07_NumNotaCredito || this.numero);

    if (!tipo || !serie || !numero) {
      window.alert('No se pudo generar el PDF. Datos incompletos.');
      return;
    }

    this.generandoPdf = true;
    this.cdr.markForCheck();

    this.notasCreditoService
      .getNotaCreditoPdf(tipo, serie, numero)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.openPdfBlob(blob, `Nota_Credito_${tipo}_${serie}_${numero}.pdf`);
          this.generandoPdf = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.generandoPdf = false;
          this.cdr.markForCheck();
          window.alert(this.getErrorMessage(error));
        }
      });
  }

  trackByDetalle(index: number, item: NotaCreditoDetalleLinea): string {
    return `${item.PFD08_Orden ?? index}-${item.PFD08_Codigo ?? ''}-${index}`;
  }

  trackByImpuesto(index: number, item: NotaCreditoDetalleImpuesto): string {
    return `${item.PFD09_Descripcion ?? 'impuesto'}-${index}`;
  }

  isGravado(item: NotaCreditoDetalleLinea): boolean {
    return (item.PFD08_Grabado ?? '').toString().trim() === '1';
  }

  text(value: unknown): string {
    return (value ?? '').toString().trim();
  }

  number(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private normalizeDocumentPart(value: unknown): string {
    return (value ?? '').toString().trim();
  }

  private fetchDetalle(): void {
    this.loading = true;
    this.errorMsg = null;
    this.encabezado = null;
    this.detalle = [];
    this.impuestos = [];
    this.cdr.markForCheck();

    this.notasCreditoService
      .getDetalleNotaCredito(this.tipo, this.serie, this.numero)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.applyResponse(response);
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.errorMsg = this.getErrorMessage(error);
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private applyResponse(response: NotaCreditoDetalleResponse): void {
    const data = response?.data ?? response?.datos ?? response ?? {};
    const encabezadoRaw = data.encabezado;
    this.encabezado = Array.isArray(encabezadoRaw) ? encabezadoRaw[0] ?? null : encabezadoRaw ?? null;
    this.detalle = Array.isArray(data.detalle) ? data.detalle : [];
    this.impuestos = Array.isArray(data.impuestos) ? data.impuestos : [];
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }
    return 'No se pudo cargar el detalle de la nota de crédito.';
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
