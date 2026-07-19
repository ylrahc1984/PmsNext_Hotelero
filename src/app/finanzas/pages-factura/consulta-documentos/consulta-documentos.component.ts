import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { BehaviorSubject, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { PuntoVentaUI } from 'src/app/demo/administracion/usuarios/usuario.models';
import { UsuarioService } from 'src/app/demo/administracion/usuarios/usuario.service';
import { ConsultaDocumentosService } from '../../services/consulta-documentos.service';
import { DocumentoDetalleService } from '../../services/documento-detalle.service';
import { ConsultaDocumentosFiltros, ConsultaDocumentosResponse, Documento } from './consulta-documentos.interface';

type ConsultaDocumentosForm = {
  fechaDesde: FormControl<string>;
  fechaHasta: FormControl<string>;
  pntVenta: FormControl<string>;
  busqueda: FormControl<string>;
};

interface ConsultaDocumentosViewModel {
  documentos: Documento[];
  totalRegistros: number;
  totalDocuVisible: number;
  totalNetoVisible: number;
  totalImpuestoVisible: number;
  totalPropinaVisible: number;
  monedaResumen: string;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
}

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-consulta-documentos',
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './consulta-documentos.component.html',
  styleUrls: ['./consulta-documentos.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConsultaDocumentosComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly consultaService = inject(ConsultaDocumentosService);
  private readonly detalleService = inject(DocumentoDetalleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly auth = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);

  readonly pageSizeOptions = [20, 50, 100];
  readonly origenConsulta = this.resolveOrigenConsulta();
  private readonly defaultDateRange = this.getDefaultDateRange();
  dateRangeError = '';
  puntosVenta: PuntoVentaUI[] = [];
  puntosVentaLoading = false;
  puntosVentaError = '';

  readonly filtrosForm: FormGroup<ConsultaDocumentosForm> = this.fb.group({
    fechaDesde: this.fb.control(this.defaultDateRange.fechaDesde, { validators: [Validators.required] }),
    fechaHasta: this.fb.control(this.defaultDateRange.fechaHasta, { validators: [Validators.required] }),
    pntVenta: this.fb.control(''),
    busqueda: this.fb.control('')
  });

  private readonly vmSubject = new BehaviorSubject<ConsultaDocumentosViewModel>({
    documentos: [],
    totalRegistros: 0,
    totalDocuVisible: 0,
    totalNetoVisible: 0,
    totalImpuestoVisible: 0,
    totalPropinaVisible: 0,
    monedaResumen: '',
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalPages: 1,
    pageStart: 0,
    pageEnd: 0,
    loading: false,
    error: null,
    hasSearched: false
  });

  readonly vm$ = this.vmSubject.asObservable();

  private filtrosBase!: Omit<ConsultaDocumentosFiltros, 'pageNumber' | 'pageSize'>;
  private activeRequest?: Subscription;
  private printingDocs = new Set<string>();

  ngOnInit(): void {
    this.cargarPuntosVenta();
    this.onBuscar();
  }

  onBuscar(): void {
    if (this.filtrosForm.invalid) {
      this.filtrosForm.markAllAsTouched();
      return;
    }

    const { fechaDesde, fechaHasta } = this.filtrosForm.getRawValue();
    if (fechaDesde > fechaHasta) {
      this.dateRangeError = 'La fecha desde no puede ser posterior a la fecha hasta.';
      this.cdr.markForCheck();
      return;
    }

    this.dateRangeError = '';

    this.updateFiltrosBase();
    const { pageSize } = this.vmSubject.getValue();
    this.cargarDocumentos(1, pageSize);
  }

  onLimpiar(): void {
    const { fechaDesde, fechaHasta } = this.getDefaultDateRange();
    this.filtrosForm.reset({
      fechaDesde,
      fechaHasta,
      pntVenta: '',
      busqueda: ''
    });
    this.dateRangeError = '';
    this.activeRequest?.unsubscribe();
    this.vmSubject.next({
      documentos: [],
      totalRegistros: 0,
      totalDocuVisible: 0,
      totalNetoVisible: 0,
      totalImpuestoVisible: 0,
      totalPropinaVisible: 0,
      monedaResumen: '',
      pageNumber: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      totalPages: 1,
      pageStart: 0,
      pageEnd: 0,
      loading: false,
      error: null,
      hasSearched: false
    });
  }

  changePage(delta: number): void {
    const { pageNumber, pageSize, totalPages, hasSearched } = this.vmSubject.getValue();
    if (!hasSearched) {
      return;
    }
    const next = Math.min(Math.max(pageNumber + delta, 1), totalPages);
    if (next === pageNumber) {
      return;
    }
    this.cargarDocumentos(next, pageSize);
  }

  onPageSizeChange(size: number | string): void {
    const pageSize = Number(size) || DEFAULT_PAGE_SIZE;
    const { hasSearched } = this.vmSubject.getValue();
    if (!hasSearched) {
      this.vmSubject.next({
        ...this.vmSubject.getValue(),
        pageSize
      });
      return;
    }
    this.cargarDocumentos(1, pageSize);
  }

  verDocumento(documento: Documento): void {
    const serie = documento.PPV00_Serie || '000';
    const operador = this.auth.getCurrentUser()?.usuario?.trim() || documento.operador?.trim() || '';
    this.router.navigate(['/finanzas/documento', documento.tipoDocu, serie, documento.numDocu], {
      queryParams: { operador }
    });
  }

  crearNotaCredito(documento: Documento): void {
    if (!this.canCrearNotaCredito(documento)) {
      return;
    }
    const serie = documento.PPV00_Serie || '000';
    this.router.navigate(['/finanzas/notas-credito/nueva'], {
      queryParams: {
        tipoDocu: documento.tipoDocu,
        serie,
        numero: documento.numDocu,
        origen: 'consulta-documentos'
      }
    });
  }

  canCrearNotaCredito(documento: Documento): boolean {
    const estadoDocumento = (documento.estDocu || '').toString().trim().toUpperCase();
    const estadoElectronico = (documento.PPV15_EstadoElectronico || '').toString().trim().toUpperCase();
    return !this.isDocumentoAnulado(estadoDocumento) && (estadoElectronico === 'ACEPTADO' || estadoElectronico === 'ABIERTO');
  }

  getNotaCreditoDisabledReason(documento: Documento): string {
    const estadoDocumento = (documento.estDocu || '').toString().trim().toUpperCase();
    const estadoElectronico = (documento.PPV15_EstadoElectronico || '').toString().trim().toUpperCase();
    if (this.isDocumentoAnulado(estadoDocumento)) {
      return 'No se puede aplicar nota de crédito a un documento anulado.';
    }
    if (estadoElectronico === 'RECHAZADO') {
      return 'No se puede aplicar nota de crédito a un documento rechazado.';
    }
    if (estadoElectronico !== 'ACEPTADO') {
      return 'La nota de crédito solo aplica para documentos aceptados.';
    }
    return 'Aplicar nota de crédito';
  }

  private isDocumentoAnulado(estadoDocumento: string): boolean {
    return estadoDocumento === 'A' || estadoDocumento.includes('ANU') || estadoDocumento.includes('CANCEL');
  }

  imprimirDocumento(documento: Documento): void {
    const tipo = documento.tipoDocu;
    const serie = documento.PPV00_Serie || '000';
    const numero = documento.numDocu;
    const consecutivo = (documento.numeroConsecutivo || '').trim();
    const key = this.getDocumentoKey(documento);
    if (this.printingDocs.has(key)) return;

    if (!consecutivo) {
      window.alert('No se encontró el número consecutivo para imprimir.');
      return;
    }

    this.printingDocs.add(key);
    this.cdr.markForCheck();

    this.detalleService
      .getPdf(tipo, serie, consecutivo)
      .pipe(
        finalize(() => {
          this.printingDocs.delete(key);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (blob) => {
          this.openPdfBlob(blob, `Factura_${tipo}_${serie}_${numero}.pdf`);
        },
        error: (error: unknown) => {
          window.alert(this.getErrorMessage(error));
        }
      });
  }

  isPrinting(documento: Documento): boolean {
    return this.printingDocs.has(this.getDocumentoKey(documento));
  }

  trackByDocumento(index: number, documento: Documento): string {
    return `${documento.tipoDocu}-${documento.numDocu}-${index}`;
  }

  estadoDocumentoClass(estado: string): string {
    const normalized = estado?.toUpperCase().trim();
    if (normalized === 'C') return 'estado-docu estado-docu--c';
    if (normalized === 'A') return 'estado-docu estado-docu--a';
    if (normalized === 'P') return 'estado-docu estado-docu--p';
    return 'estado-docu';
  }

  estadoElectronicoClass(estado: string): string {
    const normalized = estado?.toUpperCase().trim();
    if (normalized === 'ACEPTADO') return 'estado-elec estado-elec--aceptado';
    if (normalized === 'RECHAZADO') return 'estado-elec estado-elec--rechazado';
    if (normalized === 'PENDIENTE') return 'estado-elec estado-elec--pendiente';
    return 'estado-elec';
  }

  private cargarDocumentos(pageNumber: number, pageSize: number): void {
    const filtros = this.buildFiltros(pageNumber, pageSize);
    this.activeRequest?.unsubscribe();
    this.updateVmLoading(pageNumber, pageSize);

    this.activeRequest = this.consultaService
      .buscarDocumentos(filtros)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.updateVmSuccess(response, pageNumber, pageSize),
        error: (error: unknown) => this.updateVmError(error, pageNumber, pageSize)
      });
  }

  private updateFiltrosBase(): void {
    const value = this.filtrosForm.getRawValue();
    this.filtrosBase = {
      proceso: 90,
      fechaDocu: this.formatDateToApi(this.normalize(value.fechaDesde)) || '',
      fechaPago: this.formatDateToApi(this.normalize(value.fechaHasta)) || '',
      operador: this.auth.getCurrentUser()?.usuario?.trim() || 'charly',
      pntVenta: this.normalize(value.pntVenta) || '',
      nomClie: this.normalize(value.busqueda) || ''
    };
  }

  private cargarPuntosVenta(): void {
    this.puntosVentaLoading = true;
    this.puntosVentaError = '';
    this.usuarioService
      .getPuntosVenta()
      .pipe(
        finalize(() => {
          this.puntosVentaLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.puntosVenta = (response ?? [])
            .filter((item) => item.codigo)
            .sort((a, b) => a.orden - b.orden || a.descripcion.localeCompare(b.descripcion));
        },
        error: () => {
          this.puntosVenta = [];
          this.puntosVentaError = 'No se pudo cargar el catálogo de puntos de venta.';
        }
      });
  }

  private buildFiltros(pageNumber: number, pageSize: number): ConsultaDocumentosFiltros {
    return {
      ...this.filtrosBase,
      pageNumber,
      pageSize
    };
  }

  private updateVmLoading(pageNumber: number, pageSize: number): void {
    const prev = this.vmSubject.getValue();
    this.vmSubject.next({
      ...prev,
      loading: true,
      error: null,
      pageNumber,
      pageSize,
      hasSearched: true
    });
  }

  private updateVmSuccess(response: ConsultaDocumentosResponse, pageNumber: number, pageSize: number): void {
    const totalRegistros = response.paginacion.totalRegistros;
    const documentos = response.documentos;
    const totalDocuVisible = this.sumDocumentos(documentos, (documento) => documento.totalDocu);
    const totalNetoVisible = this.sumDocumentos(documentos, (documento) => documento.neto);
    const totalImpuestoVisible = this.sumDocumentos(documentos, (documento) => documento.impuesto);
    const totalPropinaVisible = this.sumDocumentos(documentos, (documento) => documento.propinas);
    const monedaResumen = this.resolveMonedaResumen(documentos);
    const resolvedPage = response.paginacion.paginaActual || pageNumber;
    const resolvedPageSize = response.paginacion.tamanoPagina || pageSize;
    const totalPages = Math.max(1, response.paginacion.totalPaginas || 1);
    const pageStart = totalRegistros === 0 ? 0 : (resolvedPage - 1) * resolvedPageSize + 1;
    const pageEnd = totalRegistros === 0 ? 0 : Math.min(pageStart + pageSize - 1, totalRegistros);

    this.vmSubject.next({
      documentos,
      totalRegistros,
      totalDocuVisible,
      totalNetoVisible,
      totalImpuestoVisible,
      totalPropinaVisible,
      monedaResumen,
      pageNumber: resolvedPage,
      pageSize: resolvedPageSize,
      totalPages,
      pageStart,
      pageEnd,
      loading: false,
      error: null,
      hasSearched: true
    });
  }

  private updateVmError(error: unknown, pageNumber: number, pageSize: number): void {
    const totalPages = 1;
    this.vmSubject.next({
      documentos: [],
      totalRegistros: 0,
      totalDocuVisible: 0,
      totalNetoVisible: 0,
      totalImpuestoVisible: 0,
      totalPropinaVisible: 0,
      monedaResumen: '',
      pageNumber,
      pageSize,
      totalPages,
      pageStart: 0,
      pageEnd: 0,
      loading: false,
      error: this.getErrorMessage(error),
      hasSearched: true
    });
  }

  private normalize(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private sumDocumentos(documentos: Documento[], accessor: (documento: Documento) => number): number {
    return documentos.reduce((sum, documento) => sum + (Number(accessor(documento)) || 0), 0);
  }

  private resolveMonedaResumen(documentos: Documento[]): string {
    const monedas = [...new Set(documentos.map((documento) => (documento.moneda ?? '').toString().trim()).filter(Boolean))];
    if (monedas.length === 0) return '';
    return monedas.length === 1 ? monedas[0] : 'Mixta';
  }

  private formatDateToApi(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    if (value.includes('/')) {
      return value;
    }
    const parts = value.split('-');
    if (parts.length !== 3) {
      return value;
    }
    const [year, month, day] = parts;
    if (!year || !month || !day) {
      return value;
    }
    return `${day}/${month}/${year}`;
  }

  private getDefaultDateRange(): { fechaDesde: string; fechaHasta: string } {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    return {
      fechaDesde: this.formatDateToInput(firstDayOfYear),
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
    return 'Ocurrió un error inesperado al consultar documentos';
  }

  private getDocumentoKey(documento: Documento): string {
    return `${documento.tipoDocu}-${documento.numDocu}`;
  }

  private resolveOrigenConsulta(): string {
    const origen = (this.route.snapshot.data['origenConsulta'] || '').toString().trim().toLowerCase();
    if (origen === 'restaurante') {
      return 'Restaurante';
    }
    if (origen === 'front-desk') {
      return 'Front Desk';
    }
    return 'Facturación';
  }

  private openPdfBlob(blob: Blob, filename: string): void {
    try {
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
    } catch (err) {
      console.error('Error abriendo PDF', err);
    }
  }
}
