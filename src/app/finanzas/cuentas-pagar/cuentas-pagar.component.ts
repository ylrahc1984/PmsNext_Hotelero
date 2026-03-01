import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ToastService } from 'src/app/core/services/toast.service';
import {
  EstadoCuentaProveedorFilters,
  EstadoCuentaProveedorItem,
  EstadoCuentaProveedorResponse,
  EstadoCuentaProveedorService,
  EstadoCuentaProveedorTotales
} from './estado-cuenta-proveedor.service';
import { ProveedorModalComponent } from './proveedor-modal/proveedor-modal.component';
import { ProveedorUI } from 'src/app/demo/compras/proveedores/proveedor.service';

type FiltrosForm = {
  fechaInicial: FormControl<string>;
  fechaFinal: FormControl<string>;
  tipDocPrv: FormControl<string>;
  codProve: FormControl<string>;
};

type EstadoCuentaProveedorView = EstadoCuentaProveedorItem & {
  estadoClase: string;
};

type FacturaSeleccionada = {
  tipDocPrv: string;
  serie: string;
  numFactura: string;
  fecFactu: string;
  fecVen: string;
  codProve: string;
  nomProve: string;
  totalDocu: number;
  saldo: number;
  moneda: string;
  estado: string;
  tCambio: number;
};

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-cuentas-pagar',
  standalone: true,
  imports: [CommonModule, SharedModule, ReactiveFormsModule, ProveedorModalComponent],
  templateUrl: './cuentas-pagar.component.html',
  styleUrls: ['./cuentas-pagar.component.scss']
})
export class CuentasPagarComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly estadoCuentaService = inject(EstadoCuentaProveedorService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly filtrosForm: FormGroup<FiltrosForm> = this.fb.group({
    fechaInicial: this.fb.control('', { validators: [Validators.required] }),
    fechaFinal: this.fb.control('', { validators: [Validators.required] }),
    tipDocPrv: this.fb.control(''),
    codProve: this.fb.control('')
  });

  readonly pageSizes = [10, 20, 50];
  readonly tipDocOptions: Array<{ value: string; label: string }> = [
    { value: 'COMPRAS ARTICULOS', label: 'COMPRAS ARTICULOS' },
    { value: 'COMPRAS SERVICIOS', label: 'COMPRAS SERVICIOS' }
  ];

  dataSource: EstadoCuentaProveedorView[] = [];
  loading = false;
  totalRegistros = 0;
  pageNumber = 1;
  pageSize = DEFAULT_PAGE_SIZE;
  totalPages = 1;

  totalFiltrado = 0;
  monedaTotal = 'USD';

  showProveedorModal = false;
  selectedProveedor: ProveedorUI | null = null;

  showEmptyState = false;
  canPrev = false;
  canNext = false;

  private selectedFacturas = new Set<string>();

  ngOnInit(): void {
    const range = this.getDefaultDateRange();
    this.filtrosForm.reset({
      fechaInicial: range.fechaInicial,
      fechaFinal: range.fechaFinal,
      tipDocPrv: '',
      codProve: ''
    });
    this.updatePagination();
    void this.buscar();
  }

  buscar(): void {
    if (this.filtrosForm.invalid) {
      this.filtrosForm.markAllAsTouched();
      return;
    }
    this.pageNumber = 1;
    void this.loadEstadoCuenta();
  }

  resetFiltros(): void {
    const range = this.getDefaultDateRange();
    this.selectedProveedor = null;
    this.filtrosForm.reset({
      fechaInicial: range.fechaInicial,
      fechaFinal: range.fechaFinal,
      tipDocPrv: '',
      codProve: ''
    });
    this.pageNumber = 1;
    void this.loadEstadoCuenta();
  }

  resetPagina(): void {
    this.pageNumber = 1;
  }

  onPageSizeChange(size: number | string): void {
    const parsed = Number(size) || DEFAULT_PAGE_SIZE;
    if (parsed === this.pageSize) {
      return;
    }
    this.pageSize = parsed;
    this.pageNumber = 1;
    void this.loadEstadoCuenta();
  }

  changePage(delta: number): void {
    const next = Math.min(Math.max(this.pageNumber + delta, 1), this.totalPages);
    if (next === this.pageNumber) {
      return;
    }
    this.pageNumber = next;
    void this.loadEstadoCuenta(false);
  }

  openProveedorModal(): void {
    this.showProveedorModal = true;
  }

  closeProveedorModal(): void {
    this.showProveedorModal = false;
  }

  onProveedorSelected(proveedor: ProveedorUI): void {
    this.selectedProveedor = proveedor;
    this.filtrosForm.controls.codProve.setValue(proveedor.codigo);
    this.closeProveedorModal();
    this.pageNumber = 1;
    void this.loadEstadoCuenta();
  }

  imprimir(): void {
    window.print();
  }

  exportarExcel(): void {
    console.log('Exportar a Excel', this.dataSource);
  }

  get selectedCount(): number {
    return this.selectedFacturas.size;
  }

  isFacturaSeleccionable(cuenta: EstadoCuentaProveedorView): boolean {
    const saldo = this.normalizeNumber(cuenta.saldo);
    const estado = this.normalize(cuenta.estado).toLowerCase();
    return saldo > 0 && !estado.includes('pag');
  }

  isFacturaSeleccionada(cuenta: EstadoCuentaProveedorView): boolean {
    return this.selectedFacturas.has(this.getFacturaKey(cuenta));
  }

  toggleFacturaSeleccion(cuenta: EstadoCuentaProveedorView, checked: boolean): void {
    if (!this.isFacturaSeleccionable(cuenta)) {
      return;
    }
    const key = this.getFacturaKey(cuenta);
    if (checked) {
      this.selectedFacturas.add(key);
    } else {
      this.selectedFacturas.delete(key);
    }
  }

  aplicarPago(): void {
    const facturasSeleccionadas = this.getFacturasSeleccionadas();
    if (!facturasSeleccionadas.length) {
      this.toast.warning('Selecciona al menos una factura pendiente para aplicar el pago.');
      return;
    }
    this.router.navigate(['/bancos/retiros-cxp/nuevo'], {
      state: { facturasSeleccionadas }
    });
  }

  private async loadEstadoCuenta(resetRecords = true): Promise<void> {
    const filtros = this.getFiltros();
    const query: EstadoCuentaProveedorFilters = {
      fechaInicial: filtros.fechaInicial,
      fechaFinal: filtros.fechaFinal,
      tipDocPrv: filtros.tipDocPrv,
      codProve: filtros.codProve,
      pageNumber: this.pageNumber,
      pageSize: this.pageSize
    };

    this.loading = true;
    this.showEmptyState = false;
    this.selectedFacturas.clear();
    if (resetRecords) {
      this.dataSource = [];
    }
    try {
      const response = await firstValueFrom(this.estadoCuentaService.getEstadoCuentaProveedor(query));
      this.applyResponse(response);
    } catch (error) {
      console.error('Error al cargar cuentas por pagar:', error);
      this.dataSource = [];
      this.totalRegistros = 0;
      this.totalFiltrado = 0;
      this.updatePagination();
      this.toast.error(this.getErrorMessage(error, 'No se pudieron cargar las cuentas por pagar.'));
    } finally {
      this.loading = false;
      this.showEmptyState = !this.loading && this.dataSource.length === 0;
    }
  }

  private applyResponse(response: EstadoCuentaProveedorResponse): void {
    const mapped = (response?.datos ?? []).map((item) => this.mapItem(item));
    this.dataSource = mapped;
    this.totalRegistros = response?.totalRegistros ?? mapped.length;
    this.pageNumber = response?.pageNumber ?? this.pageNumber;
    this.pageSize = response?.pageSize ?? this.pageSize;
    this.applyTotals(response?.totales);
    this.updatePagination();
  }

  private applyTotals(totales?: EstadoCuentaProveedorTotales[]): void {
    const total = totales?.[0];
    if (total) {
      this.totalFiltrado = this.normalizeNumber(total.totDocu);
      this.monedaTotal = total.moneda || this.monedaTotal;
      return;
    }
    this.totalFiltrado = this.dataSource.reduce((sum, item) => sum + this.normalizeNumber(item.totalDocu), 0);
  }

  private updatePagination(): void {
    this.totalPages = Math.max(1, Math.ceil(this.totalRegistros / this.pageSize));
    this.pageNumber = Math.min(Math.max(this.pageNumber, 1), this.totalPages);
    this.canPrev = this.pageNumber > 1;
    this.canNext = this.pageNumber < this.totalPages;
  }

  private mapItem(item: EstadoCuentaProveedorItem): EstadoCuentaProveedorView {
    const estado = this.normalize(item.estado);
    return {
      ...item,
      totalDocu: this.normalizeNumber(item.totalDocu),
      totPagado: this.normalizeNumber(item.totPagado),
      saldo: this.normalizeNumber(item.saldo),
      estadoClase: this.mapEstadoClase(estado)
    };
  }

  private mapEstadoClase(estado: string): string {
    const normalized = estado.toLowerCase();
    if (normalized.includes('pag')) {
      return 'estado-pagada';
    }
    if (normalized.includes('venc')) {
      return 'estado-vencida';
    }
    return 'estado-pendiente';
  }

  private getFiltros(): { fechaInicial: string; fechaFinal: string; tipDocPrv: string; codProve: string } {
    const value = this.filtrosForm.getRawValue();
    return {
      fechaInicial: value.fechaInicial,
      fechaFinal: value.fechaFinal,
      tipDocPrv: this.normalize(value.tipDocPrv),
      codProve: this.normalize(value.codProve)
    };
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private normalizeNumber(value: number | null | undefined): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    return 0;
  }

  private getFacturasSeleccionadas(): FacturaSeleccionada[] {
    return this.dataSource
      .filter((cuenta) => this.isFacturaSeleccionable(cuenta) && this.isFacturaSeleccionada(cuenta))
      .map((cuenta) => ({
        tipDocPrv: this.normalize(cuenta.tipDocPrv),
        serie: this.normalize(cuenta.serie),
        numFactura: this.normalize(cuenta.numFactura),
        fecFactu: this.normalize(cuenta.fecFactu),
        fecVen: this.normalize(cuenta.fecVen),
        codProve: this.normalize(cuenta.codProve),
        nomProve: this.normalize(cuenta.nomProve),
        totalDocu: this.normalizeNumber(cuenta.totalDocu),
        saldo: this.normalizeNumber(cuenta.saldo),
        moneda: this.normalize(cuenta.moneda),
        estado: this.normalize(cuenta.estado),
        tCambio: this.normalizeNumber(cuenta.tCambio)
      }));
  }

  private getFacturaKey(cuenta: EstadoCuentaProveedorView): string {
    return `${this.normalize(cuenta.codProve)}-${this.normalize(cuenta.tipDocPrv)}-${this.normalize(cuenta.serie)}-${this.normalize(cuenta.numFactura)}`;
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

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      return error.message || fallback;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: string }).message;
      if (message) {
        return message;
      }
    }
    return fallback;
  }
}
