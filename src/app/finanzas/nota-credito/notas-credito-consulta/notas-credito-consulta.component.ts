import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { NotasCreditoService } from 'src/app/finanzas/nota-credito/services/notas-credito.service';
import { NotaCredito, NotaCreditoResponse } from 'src/app/finanzas/nota-credito/interfaces/notas-credito.interface';
import { environment } from 'src/environments/environment';

type NotasCreditoForm = {
  fechaDesde: FormControl<string>;
  fechaHasta: FormControl<string>;
  buscar: FormControl<string>;
};

interface NotasCreditoViewModel {
  notas: NotaCredito[];
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

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-notas-credito-consulta',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './notas-credito-consulta.component.html',
  styleUrls: ['./notas-credito-consulta.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotasCreditoConsultaComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notasService = inject(NotasCreditoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly pageSizeOptions = [10, 20, 50];
  private readonly defaultDateRange = this.getDefaultDateRange();

  readonly filtrosForm: FormGroup<NotasCreditoForm> = this.fb.group({
    fechaDesde: this.fb.control(this.defaultDateRange.fechaDesde, { validators: [Validators.required] }),
    fechaHasta: this.fb.control(this.defaultDateRange.fechaHasta, { validators: [Validators.required] }),
    buscar: this.fb.control('')
  });

  private readonly vmSubject = new BehaviorSubject<NotasCreditoViewModel>({
    notas: [],
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

  private filtrosBase: { fecha: string; fechaFin: string; buscar?: string } = {
    fecha: this.formatDateToApi(this.defaultDateRange.fechaDesde),
    fechaFin: this.formatDateToApi(this.defaultDateRange.fechaHasta)
  };

  private activeRequest?: Subscription;

  ngOnInit(): void {
    this.onBuscar();
  }

  onBuscar(): void {
    if (this.filtrosForm.invalid) {
      this.filtrosForm.markAllAsTouched();
      return;
    }

    this.updateFiltrosBase();
    const { pageSize } = this.vmSubject.getValue();
    this.cargarNotas(1, pageSize);
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
    this.cargarNotas(next, pageSize);
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
    this.cargarNotas(1, pageSize);
  }

  verPdf(_nota: NotaCredito): void {
    const tipo = this.normalize(_nota.PFD07_TipNotaCredito);
    const serie = this.normalize(_nota.PFD07_SerieNotaCredito);
    const numero = this.normalize(_nota.PFD07_NumNotaCredito);

    if (!tipo || !serie || !numero) {
      window.alert('No se pudo generar el PDF. Datos incompletos.');
      return;
    }

    const url = `${environment.baseUrl}/notas-credito/${encodeURIComponent(tipo)}/${encodeURIComponent(
      serie
    )}/${encodeURIComponent(numero)}/pdf`;
    const opened = window.open(url, '_blank', 'noopener');
    if (!opened) {
      window.location.href = url;
    }
  }

  anularNota(_nota: NotaCredito): void {
    window.alert('Funcionalidad de anulación pendiente.');
  }

  trackByNota(index: number, nota: NotaCredito): string {
    return `${nota.PFD07_TipNotaCredito}-${nota.PFD07_SerieNotaCredito}-${nota.PFD07_NumNotaCredito}-${index}`;
  }

  private cargarNotas(pageNumber: number, pageSize: number): void {
    this.activeRequest?.unsubscribe();
    this.updateVmLoading(pageNumber, pageSize);

    this.activeRequest = this.notasService
      .consultarNotasCredito(
        this.filtrosBase.fecha,
        this.filtrosBase.fechaFin,
        pageNumber,
        pageSize,
        this.filtrosBase.buscar
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.updateVmSuccess(response, pageNumber, pageSize),
        error: (error: unknown) => this.updateVmError(error, pageNumber, pageSize)
      });
  }

  private updateFiltrosBase(): void {
    const value = this.filtrosForm.getRawValue();
    this.filtrosBase = {
      fecha: this.formatDateToApi(this.normalize(value.fechaDesde)),
      fechaFin: this.formatDateToApi(this.normalize(value.fechaHasta)),
      buscar: this.normalize(value.buscar)
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
    this.cdr.markForCheck();
  }

  private updateVmSuccess(response: NotaCreditoResponse, pageNumber: number, pageSize: number): void {
    const totalRegistros = response?.paginacion?.totalRegistros ?? 0;
    const notas = response?.datos ?? [];
    const size = response?.paginacion?.pageSize ?? pageSize;
    const totalPages = Math.max(1, Math.ceil(totalRegistros / size));
    const pageStart = totalRegistros === 0 ? 0 : (pageNumber - 1) * size + 1;
    const pageEnd = totalRegistros === 0 ? 0 : Math.min(pageStart + size - 1, totalRegistros);

    this.vmSubject.next({
      notas,
      totalRegistros,
      pageNumber,
      pageSize: size,
      totalPages,
      pageStart,
      pageEnd,
      loading: false,
      error: null,
      hasSearched: true
    });
    this.cdr.markForCheck();
  }

  private updateVmError(error: unknown, pageNumber: number, pageSize: number): void {
    const totalPages = 1;
    this.vmSubject.next({
      notas: [],
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
    this.cdr.markForCheck();
  }

  private normalize(value: string): string {
    return (value ?? '').toString().trim();
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
    return 'Ocurrió un error inesperado al consultar notas de crédito.';
  }
}
