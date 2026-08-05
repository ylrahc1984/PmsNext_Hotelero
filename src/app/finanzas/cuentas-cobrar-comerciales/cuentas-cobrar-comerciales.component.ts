import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { ToastService } from 'src/app/core/services/toast.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { CuentasCobrarComercialesService } from './cuentas-cobrar-comerciales.service';
import { CuentaCobrarComercial, CuentasCobrarComercialesQuery, CuentasCobrarComercialesResponse } from './interfaces';

type FiltrosComercialesForm = {
  fechaInicial: FormControl<string>;
  fechaFinal: FormControl<string>;
};

const DEFAULT_PAGE_SIZE = 50;

@Component({
  selector: 'app-cuentas-cobrar-comerciales',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule],
  templateUrl: './cuentas-cobrar-comerciales.component.html',
  styleUrls: ['./cuentas-cobrar-comerciales.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CuentasCobrarComercialesComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(CuentasCobrarComercialesService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly defaultDateRange = this.getDefaultDateRange();

  readonly pageSizes = [10, 20, 50, 100, 150, 200];
  readonly filtrosForm: FormGroup<FiltrosComercialesForm> = this.fb.group({
    fechaInicial: this.fb.control(this.defaultDateRange.fechaInicial, { validators: [Validators.required] }),
    fechaFinal: this.fb.control(this.defaultDateRange.fechaFinal, { validators: [Validators.required] })
  });

  readonly loading = signal(false);
  readonly records = signal<CuentaCobrarComercial[]>([]);
  readonly pageNumber = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly totalRecords = signal(0);
  readonly selectedKeys = signal<Set<string>>(new Set<string>());

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalRecords() / (this.pageSize() || DEFAULT_PAGE_SIZE))));
  readonly canPrev = computed(() => this.pageNumber() > 1);
  readonly canNext = computed(() => this.pageNumber() < this.totalPages());
  readonly selectedCount = computed(() => this.selectedKeys().size);
  readonly selectableRecords = computed(() => this.records().filter((item) => this.isDocumentoSeleccionable(item)));
  readonly allCurrentRecordsSelected = computed(() => {
    const selectable = this.selectableRecords();
    return selectable.length > 0 && selectable.every((item) => this.isDocumentoSeleccionado(item));
  });
  readonly someCurrentRecordsSelected = computed(() => {
    const selectable = this.selectableRecords();
    return selectable.some((item) => this.isDocumentoSeleccionado(item)) && !this.allCurrentRecordsSelected();
  });

  ngOnInit(): void {
    this.onBuscar();
  }

  onBuscar(): void {
    if (this.filtrosForm.invalid) {
      this.filtrosForm.markAllAsTouched();
      return;
    }

    const { fechaInicial, fechaFinal } = this.filtrosForm.getRawValue();
    if (fechaInicial > fechaFinal) {
      this.toast.warning('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    this.cargar(1, this.pageSize());
  }

  onLimpiar(): void {
    this.filtrosForm.reset(this.defaultDateRange);
    this.cargar(1, this.pageSize());
  }

  changePage(delta: number): void {
    const next = Math.min(Math.max(this.pageNumber() + delta, 1), this.totalPages());
    if (next !== this.pageNumber()) {
      this.cargar(next, this.pageSize());
    }
  }

  onPageSizeChange(size: number | string): void {
    const parsed = Number(size) || DEFAULT_PAGE_SIZE;
    if (parsed !== this.pageSize()) {
      this.cargar(1, parsed);
    }
  }

  registrarCobranza(): void {
    if (!this.selectedCount()) {
      this.toast.warning('Selecciona documentos comerciales con saldo pendiente.');
      return;
    }
    this.toast.featurePending('La pantalla de registro de cobranza comercial se implementará en la siguiente etapa.');
  }

  imprimir(): void {
    window.print();
  }

  trackByRow(_: number, item: CuentaCobrarComercial): string {
    return this.getDocumentoKey(item);
  }

  isDocumentoSeleccionable(item: CuentaCobrarComercial): boolean {
    return this.number(item.Saldo) > 0.009;
  }

  isDocumentoSeleccionado(item: CuentaCobrarComercial): boolean {
    return this.selectedKeys().has(this.getDocumentoKey(item));
  }

  toggleDocumentoSeleccion(item: CuentaCobrarComercial, checked: boolean): void {
    if (!this.isDocumentoSeleccionable(item)) {
      return;
    }
    const next = new Set(this.selectedKeys());
    const key = this.getDocumentoKey(item);
    checked ? next.add(key) : next.delete(key);
    this.selectedKeys.set(next);
  }

  toggleSeleccionPagina(checked: boolean): void {
    const next = new Set(this.selectedKeys());
    for (const item of this.selectableRecords()) {
      const key = this.getDocumentoKey(item);
      checked ? next.add(key) : next.delete(key);
    }
    this.selectedKeys.set(next);
  }

  getEstadoCobro(item: CuentaCobrarComercial): string {
    const saldo = this.number(item.Saldo);
    const total = this.number(item.PPV05_TotalDocu);
    const pagado = this.number(item.PPV05_TotalPago);
    if (saldo < -0.009) return 'Saldo a favor';
    if (Math.abs(saldo) <= 0.009 && (total > 0.009 || pagado > 0.009)) return 'Cancelado';
    if (saldo > 0.009 && pagado > 0.009 && pagado + 0.009 < total) return 'Abono parcial';
    if (saldo > 0.009) return 'Pendiente';
    return 'Sin saldo';
  }

  getEstadoClase(item: CuentaCobrarComercial): string {
    const classes: Record<string, string> = {
      Cancelado: 'estado-cancelado',
      'Abono parcial': 'estado-parcial',
      Pendiente: 'estado-pendiente',
      'Saldo a favor': 'estado-favor'
    };
    return classes[this.getEstadoCobro(item)] || 'estado-neutral';
  }

  private cargar(pageNumber: number, pageSize: number): void {
    this.loading.set(true);
    this.service.consultar(this.buildQuery(pageNumber, pageSize)).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (response) => this.updateFromResponse(response, pageNumber, pageSize),
      error: (error) => this.handleError(error)
    });
  }

  private updateFromResponse(response: CuentasCobrarComercialesResponse, pageNumber: number, pageSize: number): void {
    this.records.set(response.datos);
    this.totalRecords.set(response.paginacion.totalRegistros);
    this.pageNumber.set(response.paginacion.paginaActual || pageNumber);
    this.pageSize.set(response.paginacion.pageSize || pageSize);
    this.selectedKeys.set(new Set());
  }

  private handleError(error: unknown): void {
    this.records.set([]);
    this.totalRecords.set(0);
    this.selectedKeys.set(new Set());
    const httpError = error as { error?: { message?: string; mensaje?: string }; message?: string };
    this.toast.error(httpError?.error?.message || httpError?.error?.mensaje || httpError?.message || 'No se pudo cargar el estado de cuenta comercial.');
  }

  private buildQuery(pageNumber: number, pageSize: number): CuentasCobrarComercialesQuery {
    const value = this.filtrosForm.getRawValue();
    return {
      fechaInicial: this.formatDateToApi(value.fechaInicial),
      fechaFinal: this.formatDateToApi(value.fechaFinal),
      pageNumber,
      pageSize
    };
  }

  private getDocumentoKey(item: CuentaCobrarComercial): string {
    return `${item.PPV05_TipNDP}-${item.PPV05_SerieNDP}-${item.PPV05_NumNDP}`;
  }

  private number(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private formatDateToApi(value: string): string {
    const parts = value.trim().split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value.trim();
  }

  private getDefaultDateRange(): { fechaInicial: string; fechaFinal: string } {
    const today = new Date();
    return {
      fechaInicial: this.formatDateToInput(new Date(today.getFullYear(), today.getMonth(), 1)),
      fechaFinal: this.formatDateToInput(today)
    };
  }

  private formatDateToInput(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
