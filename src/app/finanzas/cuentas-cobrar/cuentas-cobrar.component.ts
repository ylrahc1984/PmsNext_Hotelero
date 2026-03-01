import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ToastService } from 'src/app/core/services/toast.service';
import { EstadoCuentaService } from './estado-cuenta.service';
import { EstadoCuentaCliente, EstadoCuentaQuery, EstadoCuentaResponse, EstadoDocumentoFiltro } from './interfaces';
import { NuevaFacturaClienteModalComponent } from 'src/app/finanzas/pages-factura/nueva-factura/nueva-factura-cliente-modal/nueva-factura-cliente-modal.component';
import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';

type EstadoCuentaForm = {
  fechaInicial: FormControl<string>;
  fechaFinal: FormControl<string>;
  codCliente: FormControl<string>;
  estadoDocumento: FormControl<EstadoDocumentoFiltro>;
};

type DocumentoSeleccionado = {
  tipoDocu: string;
  serie: string;
  numDocu: string;
  fechaDocu: string;
  codCliente: string;
  nomCliente: string;
  totalDocu: number;
  totalPago: number;
  saldo: number;
  moneda: string;
  tCambio: number;
  estadoElectronico: string;
};

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-cuentas-cobrar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule, NuevaFacturaClienteModalComponent],
  templateUrl: './cuentas-cobrar.component.html',
  styleUrls: ['./cuentas-cobrar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CuentasCobrarComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly estadoCuentaService = inject(EstadoCuentaService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly pageSizes = [10, 20, 50];
  private readonly defaultDateRange = this.getDefaultDateRange();

  readonly filtrosForm: FormGroup<EstadoCuentaForm> = this.fb.group({
    fechaInicial: this.fb.control(this.defaultDateRange.fechaInicial, { validators: [Validators.required] }),
    fechaFinal: this.fb.control(this.defaultDateRange.fechaFinal, { validators: [Validators.required] }),
    codCliente: this.fb.control(''),
    estadoDocumento: this.fb.control<EstadoDocumentoFiltro>('')
  });

  readonly loading = signal(false);
  readonly records = signal<EstadoCuentaCliente[]>([]);
  readonly pageNumber = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly totalRecords = signal(0);

  readonly totalPages = computed(() => {
    const size = this.pageSize() || DEFAULT_PAGE_SIZE;
    return Math.max(1, Math.ceil(this.totalRecords() / size));
  });

  readonly canPrev = computed(() => this.pageNumber() > 1);
  readonly canNext = computed(() => this.pageNumber() < this.totalPages());
  readonly footerSummary = computed(() => `Mostrando ${this.records().length} de ${this.totalRecords()} registros`);

  readonly selectedKeys = signal<Set<string>>(new Set<string>());
  readonly selectedCount = computed(() => this.selectedKeys().size);

  showClienteModal = false;
  selectedCliente: ClienteUI | null = null;

  readonly estadoOptions: Array<{ value: EstadoDocumentoFiltro; label: string }> = [
    { value: '', label: 'Todos' },
    { value: 'C', label: 'Crédito' },
    { value: 'P', label: 'Pagado' }
  ];

  private readonly estadoBadgeMap: Record<string, string> = {
    ABIERTO: 'estado-abierto',
    CANCELADO: 'estado-cancelado'
  };

  ngOnInit(): void {
    this.onBuscar();
  }

  onBuscar(): void {
    if (this.filtrosForm.invalid) {
      this.filtrosForm.markAllAsTouched();
      return;
    }
    this.cargarEstadoCuenta(1, this.pageSize());
  }

  onLimpiar(): void {
    this.filtrosForm.reset({
      fechaInicial: this.defaultDateRange.fechaInicial,
      fechaFinal: this.defaultDateRange.fechaFinal,
      codCliente: '',
      estadoDocumento: ''
    });
    this.selectedCliente = null;
    this.cargarEstadoCuenta(1, this.pageSize());
  }

  changePage(delta: number): void {
    const next = Math.min(Math.max(this.pageNumber() + delta, 1), this.totalPages());
    if (next === this.pageNumber()) {
      return;
    }
    this.cargarEstadoCuenta(next, this.pageSize());
  }

  onPageSizeChange(size: number | string): void {
    const parsed = Number(size) || DEFAULT_PAGE_SIZE;
    if (parsed === this.pageSize()) {
      return;
    }
    this.cargarEstadoCuenta(1, parsed);
  }

  trackByRow(index: number, item: EstadoCuentaCliente): string {
    return `${item.tipoDocu}-${item.serie}-${item.numDocu}-${index}`;
  }

  getEstadoClase(estado: string): string {
    const normalized = this.normalize(estado).toUpperCase();
    return this.estadoBadgeMap[normalized] ?? 'estado-neutral';
  }

  openClienteModal(): void {
    this.showClienteModal = true;
  }

  closeClienteModal(): void {
    this.showClienteModal = false;
  }

  onClienteSelected(cliente: ClienteUI): void {
    this.selectedCliente = cliente;
    this.filtrosForm.controls.codCliente.setValue(cliente.codigo);
    this.closeClienteModal();
    this.onBuscar();
  }

  isDocumentoSeleccionable(item: EstadoCuentaCliente): boolean {
    return this.normalizeNumber(item.saldo) > 0;
  }

  isDocumentoSeleccionado(item: EstadoCuentaCliente): boolean {
    return this.selectedKeys().has(this.getDocumentoKey(item));
  }

  toggleDocumentoSeleccion(item: EstadoCuentaCliente, checked: boolean): void {
    if (!this.isDocumentoSeleccionable(item)) {
      return;
    }
    const key = this.getDocumentoKey(item);
    const next = new Set(this.selectedKeys());
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.selectedKeys.set(next);
  }

  registrarCobranza(): void {
    const documentosSeleccionados = this.getDocumentosSeleccionados();
    if (!documentosSeleccionados.length) {
      this.toast.warning('Selecciona documentos pendientes para registrar la cobranza.');
      return;
    }
    this.router.navigate(['/bancos/depositos-cxc/nuevo'], {
      state: {
        documentosSeleccionados,
        clienteSeleccionado: this.selectedCliente
      }
    });
  }

  private cargarEstadoCuenta(pageNumber: number, pageSize: number): void {
    const query = this.buildQuery(pageNumber, pageSize);
    this.loading.set(true);

    this.estadoCuentaService
      .consultarEstadoCuenta(query)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => this.updateFromResponse(response, pageNumber, pageSize),
        error: (error) => this.handleError(error)
      });
  }

  private updateFromResponse(response: EstadoCuentaResponse, pageNumber: number, pageSize: number): void {
    this.records.set(response?.data ?? []);
    this.totalRecords.set(response?.totalRecords ?? 0);
    this.pageNumber.set(response?.pageNumber ?? pageNumber);
    this.pageSize.set(response?.pageSize ?? pageSize);
    this.selectedKeys.set(new Set());
  }

  private handleError(error: unknown): void {
    this.records.set([]);
    this.totalRecords.set(0);
    this.selectedKeys.set(new Set());
    this.toast.error(this.getErrorMessage(error));
  }

  private buildQuery(pageNumber: number, pageSize: number): EstadoCuentaQuery {
    const value = this.filtrosForm.getRawValue();
    return {
      fechaInicial: this.formatDateToApi(value.fechaInicial),
      fechaFinal: this.formatDateToApi(value.fechaFinal),
      codCliente: this.normalize(value.codCliente),
      estadoDocumento: value.estadoDocumento ?? '',
      pageNumber,
      pageSize
    };
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private normalizeNumber(value: number | null | undefined): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getDocumentosSeleccionados(): DocumentoSeleccionado[] {
    return this.records()
      .filter((item) => this.isDocumentoSeleccionable(item) && this.isDocumentoSeleccionado(item))
      .map((item) => ({
        tipoDocu: this.normalize(item.tipoDocu),
        serie: this.normalize(item.serie),
        numDocu: this.normalize(item.numDocu),
        fechaDocu: this.normalize(item.fechaDocu),
        codCliente: this.normalize(item.codCliente),
        nomCliente: this.normalize(item.nomCliente),
        totalDocu: this.normalizeNumber(item.totalDocu),
        totalPago: this.normalizeNumber(item.totalPago),
        saldo: this.normalizeNumber(item.saldo),
        moneda: this.normalize(item.moneda),
        tCambio: this.normalizeNumber(item.tCambio),
        estadoElectronico: this.normalize(item.estadoElectronico)
      }));
  }

  private getDocumentoKey(item: EstadoCuentaCliente): string {
    return `${this.normalize(item.codCliente)}-${this.normalize(item.tipoDocu)}-${this.normalize(item.serie)}-${this.normalize(item.numDocu)}`;
  }

  private formatDateToApi(value: string): string {
    const trimmed = this.normalize(value);
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

  private getDefaultDateRange(): { fechaInicial: string; fechaFinal: string } {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      fechaInicial: this.formatDateToInput(firstDayOfMonth),
      fechaFinal: this.formatDateToInput(today)
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
    return 'No se pudo cargar el estado de cuenta. Intenta nuevamente.';
  }
}
