import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { catchError, finalize, timeout } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ConsultaDocumentosService } from 'src/app/finanzas/services/consulta-documentos.service';
import { Documento } from 'src/app/finanzas/pages-factura/consulta-documentos/consulta-documentos.interface';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-buscar-documento-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './buscar-documento-modal.component.html',
  styleUrls: ['./buscar-documento-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BuscarDocumentoModalComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Output() close = new EventEmitter<void>();
  @Output() documentoSelected = new EventEmitter<Documento>();

  searchTerm = '';
  fechaDesde = '';
  fechaHasta = '';

  documentosLoading = false;
  documentos: Documento[] = [];

  pageNumber = 1;
  pageSize = 10;
  totalPages = 1;
  totalRegistros = 0;

  errorMsg = '';

  private readonly consultaService = inject(ConsultaDocumentosService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly auth = inject(AuthService);
  private requestId = 0;
  private loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    const openChange = changes['open'];
    if (openChange?.currentValue === true && openChange?.previousValue !== true) {
      this.resetFechas();
      this.pageNumber = 1;
      this.buscarDocumentos();
    }
    if (openChange?.currentValue === false) {
      this.cancelPending();
    }
  }

  onClose(): void {
    this.cancelPending();
    this.close.emit();
  }

  buscarDocumentos(): void {
    const currentRequest = ++this.requestId;
    this.documentosLoading = true;
    this.errorMsg = '';
    this.cdr.markForCheck();

    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
    }
    this.loadingTimeoutId = setTimeout(() => {
      if (currentRequest === this.requestId) {
        this.documentosLoading = false;
        this.cdr.markForCheck();
      }
    }, 12000);

    const fechaDesde = this.formatDateToApi(this.fechaDesde);
    const fechaHasta = this.formatDateToApi(this.fechaHasta);

    this.consultaService
      .buscarDocumentos({
        proceso: 90,
        pageNumber: this.pageNumber,
        pageSize: this.pageSize,
        fechaDocu: fechaDesde || '',
        fechaPago: fechaHasta || '',
        fechaVen: fechaHasta || '',
        operador: this.auth.getCurrentUser()?.usuario?.trim() || 'ADMIN',
        nomClie: this.searchTerm.trim(),
        tipDocu: ''
      })
      .pipe(
        timeout(10000),
        catchError((error: unknown) => {
          this.errorMsg = this.getErrorMessage(error);
          return of({
            documentos: [],
            paginacion: {
              paginaActual: 1,
              tamanoPagina: this.pageSize,
              totalRegistros: 0,
              totalPaginas: 0,
              tienePaginaAnterior: false,
              tienePaginaSiguiente: false
            },
            mensaje: ''
          });
        }),
        finalize(() => {
          if (currentRequest === this.requestId) {
            this.documentosLoading = false;
            if (this.loadingTimeoutId) {
              clearTimeout(this.loadingTimeoutId);
              this.loadingTimeoutId = null;
            }
            this.cdr.markForCheck();
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          if (currentRequest !== this.requestId) {
            return;
          }
          this.documentos = res.documentos ?? [];
          this.totalRegistros = res.paginacion.totalRegistros ?? 0;
          this.totalPages = Math.max(1, res.paginacion.totalPaginas || 1);
          this.documentosLoading = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          if (currentRequest !== this.requestId) {
            return;
          }
          this.documentos = [];
          this.totalRegistros = 0;
          this.totalPages = 1;
          this.errorMsg = this.getErrorMessage(error);
          this.documentosLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  limpiarBusqueda(): void {
    this.searchTerm = '';
    this.pageNumber = 1;
    this.buscarDocumentos();
  }

  seleccionarDocumento(documento: Documento): void {
    this.documentosLoading = false;
    this.documentoSelected.emit(documento);
    this.close.emit();
  }

  paginaAnterior(): void {
    if (this.pageNumber > 1) {
      this.pageNumber -= 1;
      this.buscarDocumentos();
    }
  }

  paginaSiguiente(): void {
    if (this.pageNumber < this.totalPages) {
      this.pageNumber += 1;
      this.buscarDocumentos();
    }
  }

  ngOnDestroy(): void {
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
      this.loadingTimeoutId = null;
    }
  }

  private resetFechas(): void {
    const { fechaDesde, fechaHasta } = this.getDefaultDateRange();
    this.fechaDesde = fechaDesde;
    this.fechaHasta = fechaHasta;
  }

  private formatDateToApi(value: string): string {
    const trimmed = (value ?? '').toString().trim();
    if (!trimmed) return '';
    if (trimmed.includes('/')) {
      return trimmed;
    }
    const parts = trimmed.split('-');
    if (parts.length !== 3) {
      return trimmed;
    }
    const [year, month, day] = parts;
    if (!year || !month || !day) {
      return trimmed;
    }
    return `${day}/${month}/${year}`;
  }

  private getDefaultDateRange(): { fechaDesde: string; fechaHasta: string } {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      fechaDesde: this.formatDateToInput(firstDayOfMonth),
      fechaHasta: this.formatDateToInput(today)
    };
  }

  private formatDateToInput(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'No se pudo cargar los documentos.';
  }

  private cancelPending(): void {
    this.requestId += 1;
    this.documentosLoading = false;
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
      this.loadingTimeoutId = null;
    }
    this.cdr.markForCheck();
  }
}
