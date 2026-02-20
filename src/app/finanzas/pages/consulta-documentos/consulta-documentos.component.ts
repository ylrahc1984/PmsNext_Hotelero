import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { BehaviorSubject, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ConsultaDocumentosService } from '../../services/consulta-documentos.service';
import { ConsultaDocumentosFiltros, ConsultaDocumentosResponse, Documento } from './consulta-documentos.interface';

type ConsultaDocumentosForm = {
  tipoDocu: FormControl<string>;
  fechaDesde: FormControl<string>;
  fechaHasta: FormControl<string>;
  nombreCliente: FormControl<string>;
  condicionVenta: FormControl<string>;
  estadoDocu: FormControl<string>;
};

interface ConsultaDocumentosViewModel {
  documentos: Documento[];
  totalRegistros: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
}

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-consulta-documentos',
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './consulta-documentos.component.html',
  styleUrls: ['./consulta-documentos.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConsultaDocumentosComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly consultaService = inject(ConsultaDocumentosService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSizeOptions = [10, 25, 50];
  private readonly defaultDateRange = this.getDefaultDateRange();

  readonly filtrosForm: FormGroup<ConsultaDocumentosForm> = this.fb.group({
    tipoDocu: this.fb.control(''),
    fechaDesde: this.fb.control(this.defaultDateRange.fechaDesde, { validators: [Validators.required] }),
    fechaHasta: this.fb.control(this.defaultDateRange.fechaHasta),
    nombreCliente: this.fb.control(''),
    condicionVenta: this.fb.control(''),
    estadoDocu: this.fb.control('')
  });

  private readonly vmSubject = new BehaviorSubject<ConsultaDocumentosViewModel>({
    documentos: [],
    totalRegistros: 0,
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

  private filtrosBase: Omit<ConsultaDocumentosFiltros, 'pageNumber' | 'pageSize'> = {};
  private activeRequest?: Subscription;

  onBuscar(): void {
    if (this.filtrosForm.invalid) {
      this.filtrosForm.markAllAsTouched();
      return;
    }

    this.updateFiltrosBase();
    const { pageSize } = this.vmSubject.getValue();
    this.cargarDocumentos(1, pageSize);
  }

  onLimpiar(): void {
    const { fechaDesde, fechaHasta } = this.getDefaultDateRange();
    this.filtrosForm.reset({
      tipoDocu: '',
      fechaDesde,
      fechaHasta,
      nombreCliente: '',
      condicionVenta: '',
      estadoDocu: ''
    });
    this.filtrosBase = {};
    this.activeRequest?.unsubscribe();
    this.vmSubject.next({
      documentos: [],
      totalRegistros: 0,
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
    this.router.navigate(['/finanzas/documento', documento.PPV00_TipoDocu, documento.PPV00_NumDocu]);
  }

  trackByDocumento(index: number, documento: Documento): string {
    return `${documento.PPV00_TipoDocu}-${documento.PPV00_NumDocu}-${index}`;
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
      tipoDocu: this.normalize(value.tipoDocu),
      fechaDesde: this.formatDateToApi(this.normalize(value.fechaDesde)),
      fechaHasta: this.formatDateToApi(this.normalize(value.fechaHasta)),
      nombreCliente: this.normalize(value.nombreCliente),
      condicionVenta: this.normalize(value.condicionVenta),
      estadoDocu: this.normalize(value.estadoDocu)
    };
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
    const totalRegistros = response?.totalRegistros ?? 0;
    const documentos = response?.detalle ?? [];
    const totalPages = Math.max(1, Math.ceil(totalRegistros / pageSize));
    const pageStart = totalRegistros === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
    const pageEnd = totalRegistros === 0 ? 0 : Math.min(pageStart + pageSize - 1, totalRegistros);

    this.vmSubject.next({
      documentos,
      totalRegistros,
      pageNumber,
      pageSize,
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
    return 'Ocurrió un error inesperado al consultar documentos';
  }
}
