import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { environment } from 'src/environments/environment';
import { OrdenPedidoListadoItem } from '../../interfaces/orden-pedido.interface';
import { OrdenPedidoService } from '../../services/orden-pedido.service';

@Component({
  selector: 'app-orden-pedido-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './orden-pedido-list.component.html',
  styleUrls: ['./orden-pedido-list.component.scss']
})
export class OrdenPedidoListComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly ordenPedidoService = inject(OrdenPedidoService);

  readonly tiposOrden = [
    { value: 'NDP', label: 'Recibo Comercial' },
    { value: 'COT', label: 'Proforma' },
    { value: '', label: 'Todos' }
  ];

  readonly filtrosForm = this.fb.group({
    tipOrden: this.fb.control(this.tiposOrden[0].value),
    fechaDesde: this.fb.control(this.getFirstDayOfMonth()),
    fechaHasta: this.fb.control(this.getTodayIsoDate()),
    nomCliente: this.fb.control('')
  });

  readonly pageSizeOptions = [10, 20, 50];

  ordenes: OrdenPedidoListadoItem[] = [];
  isLoading = false;
  errorMessage = '';

  pageNumber = 1;
  pageSize = 10;
  totalRecords = 0;
  totalPages = 1;
  pageStart = 0;
  pageEnd = 0;
  totalItemsVisible = 0;
  totalSubtotalVisible = 0;
  totalImpuestoVisible = 0;
  totalGeneralVisible = 0;
  anulatingKeys = new Set<string>();
  printingKeys = new Set<string>();

  ngOnInit(): void {
    this.loadOrdenes();
  }

  get isFrontDeskContext(): boolean {
    return this.router.url.startsWith('/front-desk/recibos-comerciales');
  }

  get pageTitle(): string {
    return this.isFrontDeskContext ? 'Recibos Comerciales' : 'Órdenes de Pedido';
  }

  get pageDescription(): string {
    return this.isFrontDeskContext
      ? 'Consulta y administración de los recibos comerciales emitidos desde Front Desk.'
      : 'Consulta órdenes de pedido y proformas emitidas desde el área comercial.';
  }

  applyFilters(): void {
    this.pageNumber = 1;
    this.loadOrdenes();
  }

  resetFilters(): void {
    this.filtrosForm.reset({
      tipOrden: this.tiposOrden[0].value,
      fechaDesde: this.getFirstDayOfMonth(),
      fechaHasta: this.getTodayIsoDate(),
      nomCliente: ''
    });
    this.pageNumber = 1;
    this.loadOrdenes();
  }

  onPageSizeChange(size: string): void {
    const nextSize = Number(size);
    if (!Number.isFinite(nextSize) || nextSize <= 0) {
      return;
    }
    this.pageSize = nextSize;
    this.pageNumber = 1;
    this.loadOrdenes();
  }

  goToPageRelative(delta: number): void {
    const nextPage = this.pageNumber + delta;
    if (nextPage < 1 || nextPage > this.totalPages || this.isLoading) {
      return;
    }
    this.pageNumber = nextPage;
    this.loadOrdenes();
  }

  nuevaOrden(): void {
    void this.router.navigate([this.isFrontDeskContext ? '/front-desk/recibos-comerciales/nuevo' : '/demo/ordenes-pedido/nuevo'], {
      queryParams: {
        origen: this.isFrontDeskContext ? 'front-desk-recibos' : 'orden-pedido-list'
      }
    });
  }

  verDetalle(item: OrdenPedidoListadoItem): void {
    const tipOrden = (item.tipOrden ?? '').toString().trim();
    const serie = (item.serie ?? '').toString().trim() || '000';
    const numero = (item.numero ?? '').toString().trim();

    if (!tipOrden || !numero) {
      return;
    }

    const route = this.isFrontDeskContext
      ? '/front-desk/recibos-comerciales/detalle'
      : '/demo/ordenes-pedido/detalle';
    void this.router.navigate([route, tipOrden, serie, numero]);
  }

  async anularOrden(item: OrdenPedidoListadoItem): Promise<void> {
    const tipOrden = (item.tipOrden ?? '').toString().trim();
    const serie = (item.serie ?? '').toString().trim() || '000';
    const numero = (item.numero ?? '').toString().trim();
    const key = this.getRowKey(item);
    const documento = numero.includes('-') ? numero : `${serie}-${numero}`;

    if (!tipOrden || !numero || this.isAnulando(item) || this.isOrdenAnulada(item)) {
      return;
    }

    const result = await Swal.fire({
      title: this.isFrontDeskContext ? 'Anular Recibo Comercial' : 'Anular orden de pedido',
      html: `Esta acción anulará ${this.isFrontDeskContext ? 'el recibo' : 'la orden'} <strong>${tipOrden} ${documento}</strong>.<br>No continúe si no está seguro.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      reverseButtons: true,
      focusCancel: true
    });

    if (!result.isConfirmed) {
      return;
    }

    const baseApiUrl = (environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '');
    const endpoint = `${baseApiUrl}/nota-pedido/${encodeURIComponent(tipOrden)}/${encodeURIComponent(documento)}`;

    console.groupCollapsed('[OrdenPedidoList] Solicitud para anular documento');
    console.log('Método:', 'DELETE');
    console.log('URL:', endpoint);
    console.log('Parámetros:', { tipOrden, serie, numero, documento });
    console.log('Body:', null);
    console.groupEnd();

    this.anulatingKeys.add(key);

    this.ordenPedidoService
      .anularOrden(tipOrden, serie, numero)
      .pipe(
        finalize(() => {
          this.anulatingKeys.delete(key);
        })
      )
      .subscribe({
        next: (response) => {
          console.log('[OrdenPedidoList] Respuesta de anulación:', response);
          void Swal.fire({
            title: this.isFrontDeskContext ? 'Recibo anulado' : 'Orden anulada',
            text: response?.mensaje || response?.respuesta || (
              this.isFrontDeskContext
                ? 'El Recibo Comercial fue anulado correctamente.'
                : 'La orden de pedido fue anulada correctamente.'
            ),
            icon: 'success',
            timer: 1800,
            showConfirmButton: false
          });
          this.loadOrdenes();
        },
        error: (error: Error) => {
          void Swal.fire({
            title: 'No se pudo anular',
            text: error.message || 'No se pudo anular la orden de pedido.',
            icon: 'error'
          });
        }
      });
  }

  isAnulando(item: OrdenPedidoListadoItem): boolean {
    return this.anulatingKeys.has(this.getRowKey(item));
  }

  imprimirReciboComercial(item: OrdenPedidoListadoItem): void {
    const tipOrden = (item.tipOrden ?? '').toString().trim();
    const serie = (item.serie ?? '').toString().trim() || '000';
    const numero = (item.numero ?? '').toString().trim();
    const key = this.getRowKey(item);

    if (!this.canPrintCommercialReceipt(item) || this.printingKeys.has(key)) {
      return;
    }

    this.printingKeys.add(key);
    this.ordenPedidoService
      .getReciboComercialPdf(tipOrden, serie, numero)
      .pipe(finalize(() => this.printingKeys.delete(key)))
      .subscribe({
        next: (blob) => this.openPdfBlob(blob, `Recibo_Comercial_${this.getDocumentNumber(item)}.pdf`),
        error: (error: Error) => {
          console.error('No se pudo obtener el Recibo Comercial PDF.', error);
          void Swal.fire({
            title: 'No se pudo imprimir',
            text: error.message || 'No se pudo obtener el Recibo Comercial en PDF.',
            icon: 'error'
          });
        }
      });
  }

  canPrintCommercialReceipt(item: OrdenPedidoListadoItem): boolean {
    return (item.tipOrden || '').trim().toUpperCase() === 'NDP' && Boolean((item.numero || '').trim());
  }

  isPrinting(item: OrdenPedidoListadoItem): boolean {
    return this.printingKeys.has(this.getRowKey(item));
  }

  getDocumentNumber(item: OrdenPedidoListadoItem): string {
    const serie = (item.serie ?? '').toString().trim() || '000';
    const numero = (item.numero ?? '').toString().trim();
    return numero.includes('-') ? numero : `${serie}-${numero}`;
  }

  isOrdenAnulada(item: OrdenPedidoListadoItem): boolean {
    const estado = (item.estado || '').toUpperCase();
    return estado.includes('ANU') || estado.includes('CANCEL');
  }

  getEstadoBadgeClass(item: OrdenPedidoListadoItem): string {
    const estado = (item.estado || '').toUpperCase();
    if (estado.includes('ANU') || estado.includes('CANCEL')) {
      return 'badge bg-danger-subtle text-danger border border-danger-subtle';
    }
    if (estado.includes('APR') || estado.includes('CONF') || estado.includes('EMI')) {
      return 'badge bg-success-subtle text-success border border-success-subtle';
    }
    if (estado.includes('PEN') || estado.includes('BOR')) {
      return 'badge bg-warning-subtle text-warning border border-warning-subtle';
    }
    return 'badge bg-primary-subtle text-primary border border-primary-subtle';
  }

  readonly trackByOrden = (_index: number, item: OrdenPedidoListadoItem): string => this.getRowKey(item);

  formatFecha(value: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return 'N/D';
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      return raw;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split('-');
      return `${day}/${month}/${year}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return raw;
  }

  private loadOrdenes(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const filters = {
      ...this.filtrosForm.getRawValue(),
      pageNumber: this.pageNumber,
      pageSize: this.pageSize
    };

    this.ordenPedidoService
      .getOrdenes(filters)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          this.ordenes = response.datos;
          this.updateVisibleTotals();
          this.totalRecords = response.paginacion.totalRegistros;
          this.pageNumber = response.paginacion.paginaActual || this.pageNumber;
          this.pageSize = response.paginacion.pageSize || this.pageSize;
          this.totalPages = Math.max(1, response.paginacion.totalPaginas || Math.ceil(this.totalRecords / this.pageSize) || 1);
          this.pageStart = this.totalRecords === 0 ? 0 : (this.pageNumber - 1) * this.pageSize + 1;
          this.pageEnd = this.totalRecords === 0 ? 0 : Math.min(this.pageNumber * this.pageSize, this.totalRecords);
        },
        error: (error: Error) => {
          this.ordenes = [];
          this.totalRecords = 0;
          this.totalPages = 1;
          this.pageStart = 0;
          this.pageEnd = 0;
          this.updateVisibleTotals();
          this.errorMessage = error.message || 'No se pudieron cargar las ordenes de pedido.';
        }
      });
  }

  private updateVisibleTotals(): void {
    this.totalItemsVisible = this.sumOrdenes((item) => item.items);
    this.totalSubtotalVisible = this.sumOrdenes((item) => item.subtotal);
    this.totalImpuestoVisible = this.sumOrdenes((item) => item.impuesto);
    this.totalGeneralVisible = this.sumOrdenes((item) => item.total);
  }

  private sumOrdenes(accessor: (item: OrdenPedidoListadoItem) => number): number {
    return this.ordenes.reduce((sum, item) => sum + (Number(accessor(item)) || 0), 0);
  }

  private getRowKey(item: OrdenPedidoListadoItem): string {
    return [item.tipOrden, item.serie, item.numero, item.fecha].join('|');
  }

  private openPdfBlob(blob: Blob, filename: string): void {
    const pdfBlob = blob.type === 'application/pdf'
      ? blob
      : new Blob([blob], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(pdfBlob);
    const pdfWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer');

    if (!pdfWindow) {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  private getTodayIsoDate(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private getFirstDayOfMonth(): string {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return new Date(firstDay.getTime() - firstDay.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
}
