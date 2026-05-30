import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ToastService } from 'src/app/core/services/toast.service';
import { BancosService } from '../bancos.service';
import { CuentaBancoService } from '../../cuenta-banco/cuenta-banco.service';
import { CuentaBanco } from '../../cuenta-banco/cuenta-banco.model';
import { DepositoCxcService } from './deposito.service';
import { DepositoCxcFilters, DepositoCxcListItem, DepositoCxcResponse } from './models/deposito-cxc.model';

type DepositoFiltersForm = {
  codBanco: FormControl<string>;
  codCtaBanco: FormControl<string>;
  fechaInicio: FormControl<string>;
  fechaFin: FormControl<string>;
};

interface CuentaBancoOption {
  value: string;
  label: string;
  moneda?: string;
}

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-deposito-list',
  standalone: true,
  imports: [CommonModule, SharedModule, ReactiveFormsModule, RouterModule],
  templateUrl: './deposito-list.component.html',
  styleUrls: ['./deposito-list.component.scss']
})
export class DepositoListComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly depositoService = inject(DepositoCxcService);
  private readonly bancosService = inject(BancosService);
  private readonly cuentaService = inject(CuentaBancoService);
  private readonly toast = inject(ToastService);
  private readonly headerTitle = 'Depósitos de Cobranza a Clientes';

  readonly filtersForm: FormGroup<DepositoFiltersForm> = this.fb.group({
    codBanco: this.fb.control(''),
    codCtaBanco: this.fb.control(''),
    fechaInicio: this.fb.control('', { validators: [Validators.required] }),
    fechaFin: this.fb.control('', { validators: [Validators.required] })
  });

  readonly pageSizes = [10, 20, 50];
  readonly skeletonRows = Array.from({ length: 6 });

  cuentaOptions: CuentaBancoOption[] = [];
  cuentasLoading = false;
  bancos: Array<{ codBanco: string; descripcion: string }> = [];

  dataSource: DepositoCxcListItem[] = [];
  loading = false;
  totalRegistros = 0;
  pageNumber = 1;
  pageSize = DEFAULT_PAGE_SIZE;
  totalPages = 1;
  showEmptyState = false;
  canPrev = false;
  canNext = false;

  showDeleteModal = false;
  depositoToDelete: DepositoCxcListItem | null = null;
  deleting = false;

  headerSubtitle = 'Registra y administra depósitos de cobranza a clientes.';

  ngOnInit(): void {
    const range = this.getDefaultDateRange();
    this.filtersForm.reset({
      codBanco: '',
      codCtaBanco: '',
      fechaInicio: range.fechaInicio,
      fechaFin: range.fechaFin
    });
    this.filtersForm.controls.codBanco.valueChanges.subscribe((value) => this.onBancoChange(value));
    this.updatePagination();
    void this.loadBancos();
    
  }

  buscar(): void {
    if (this.filtersForm.invalid) {
      this.filtersForm.markAllAsTouched();
      return;
    }
    this.pageNumber = 1;
    void this.loadDepositos();
  }

  resetFiltros(): void {
    const range = this.getDefaultDateRange();
    this.filtersForm.reset({
      codBanco: '',
      codCtaBanco: '',
      fechaInicio: range.fechaInicio,
      fechaFin: range.fechaFin
    });
    this.pageNumber = 1;
    void this.loadDepositos();
  }

  onPageSizeChange(size: number | string): void {
    const parsed = Number(size) || DEFAULT_PAGE_SIZE;
    if (parsed === this.pageSize) {
      return;
    }
    this.pageSize = parsed;
    this.pageNumber = 1;
    void this.loadDepositos();
  }

  changePage(delta: number): void {
    const next = Math.min(Math.max(this.pageNumber + delta, 1), this.totalPages);
    if (next === this.pageNumber) {
      return;
    }
    this.pageNumber = next;
    void this.loadDepositos(false);
  }

  nuevoDeposito(): void {
    
  }

  editar(deposito: DepositoCxcListItem): void {
    if (!deposito?.idOperacion) {
      return;
    }
    this.router.navigate(['/finanzas/bancos/depositos-cxc', deposito.idOperacion, 'editar']);
  }

  verDetalle(deposito: DepositoCxcListItem): void {
    if (!deposito?.idOperacion) {
      return;
    }
    this.router.navigate(['/finanzas/bancos/depositos-cxc', deposito.idOperacion]);
  }

  solicitarEliminar(deposito: DepositoCxcListItem): void {
    this.depositoToDelete = deposito;
    this.showDeleteModal = true;
  }

  cancelarEliminar(): void {
    this.showDeleteModal = false;
    this.depositoToDelete = null;
  }

  async confirmarEliminar(): Promise<void> {
    if (!this.depositoToDelete?.idOperacion) {
      return;
    }
    this.deleting = true;
    try {
      await firstValueFrom(this.depositoService.deleteDeposito(this.depositoToDelete.idOperacion));
      this.toast.success('Depósito eliminado correctamente.');
      this.cancelarEliminar();
      await this.loadDepositos();
    } catch (error) {
      this.toast.error(this.getErrorMessage(error, 'No se pudo eliminar el depósito.'));
    } finally {
      this.deleting = false;
    }
  }

  trackByDeposito(index: number, deposito: DepositoCxcListItem): string {
    return deposito.idOperacion || `${deposito.codCtaBanco}-${deposito.numOpera}-${index}`;
  }

  monedaLabel(deposito: DepositoCxcListItem): string {
    return deposito.moneda || 'N/A';
  }

  movConLabel(deposito: DepositoCxcListItem): string {
    return this.isConciliado(deposito.movCon) ? 'Conciliado' : 'Pendiente';
  }

  movConClass(deposito: DepositoCxcListItem): string {
    return this.isConciliado(deposito.movCon) ? 'badge-success' : 'badge-warning';
  }

  formatFecha(value: string): string {
    return this.formatDateForApi(value);
  }

  private async loadDepositos(resetRecords = true): Promise<void> {
    const filtros = this.getFiltros();
    const query: DepositoCxcFilters = {
      pageNumber: this.pageNumber,
      pageSize: this.pageSize,
      codBanco: filtros.codBanco,
      codCtaBanco: filtros.codCtaBanco,
      fechaInicio: filtros.fechaInicio,
      fechaFin: filtros.fechaFin
    };

    this.loading = true;
    this.showEmptyState = false;
    if (resetRecords) {
      this.dataSource = [];
    }

    try {
      const response = await firstValueFrom(this.depositoService.getDepositosPaged(query));
      this.applyResponse(response);
    } catch (error) {
      console.error('Error al cargar depósitos:', error);
      this.dataSource = [];
      this.totalRegistros = 0;
      this.updatePagination();
      this.toast.error(this.getErrorMessage(error, 'No se pudieron cargar los depósitos.'));
    } finally {
      this.loading = false;
      this.showEmptyState = !this.loading && this.dataSource.length === 0;
    }
  }

  private applyResponse(response: DepositoCxcResponse): void {
    this.dataSource = response?.datos ?? [];
    this.totalRegistros = response?.totalRegistros ?? this.dataSource.length;
    this.pageNumber = response?.pageNumber ?? this.pageNumber;
    this.pageSize = response?.pageSize ?? this.pageSize;
    this.updatePagination();
  }

  private updatePagination(): void {
    this.totalPages = Math.max(1, Math.ceil(this.totalRegistros / this.pageSize));
    this.pageNumber = Math.min(Math.max(this.pageNumber, 1), this.totalPages);
    this.canPrev = this.pageNumber > 1;
    this.canNext = this.pageNumber < this.totalPages;
  }

  private async loadBancos(): Promise<void> {
    try {
      this.bancos = await firstValueFrom(this.bancosService.getBancos());
    } catch (error) {
      this.bancos = [];
      this.toast.error(this.getErrorMessage(error, 'No se pudieron cargar los bancos.'));
    }
  }

  private async onBancoChange(codBanco: string): Promise<void> {
    const normalized = this.normalize(codBanco);
    if (!normalized) {
      this.cuentasLoading = false;
      this.cuentaOptions = [];
      this.filtersForm.controls.codCtaBanco.setValue('');
      return;
    }
    this.cuentasLoading = true;
    try {
      const cuentas = await firstValueFrom(this.cuentaService.getCuentas(normalized));
      this.cuentaOptions = cuentas.map((cuenta: CuentaBanco) => ({
        value: cuenta.ctaBanco,
        label: `${cuenta.nombreCta} (${cuenta.ctaBanco})`,
        moneda: cuenta.moneda
      }));
      const current = this.filtersForm.controls.codCtaBanco.value;
      if (current && !this.cuentaOptions.some((item) => item.value === current)) {
        this.filtersForm.controls.codCtaBanco.setValue('');
      }
    } catch (error) {
      console.error('Error al cargar cuentas bancarias:', error);
      this.cuentaOptions = [];
      this.toast.error(this.getErrorMessage(error, 'No se pudieron cargar las cuentas bancarias.'));
    } finally {
      this.cuentasLoading = false;
    }
  }

  private getFiltros(): { codBanco: string; codCtaBanco: string; fechaInicio: string; fechaFin: string } {
    const value = this.filtersForm.getRawValue();
    return {
      codBanco: this.normalize(value.codBanco),
      codCtaBanco: this.normalize(value.codCtaBanco),
      fechaInicio: this.formatDateForApi(value.fechaInicio),
      fechaFin: this.formatDateForApi(value.fechaFin)
    };
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private isConciliado(value: string | boolean | number | null | undefined): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    const normalized = `${value ?? ''}`.toLowerCase().trim();
    return ['s', 'si', '1', 'true', 'y', 'yes'].includes(normalized);
  }

  private getDefaultDateRange(): { fechaInicio: string; fechaFin: string } {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      fechaInicio: this.formatDateToInput(firstDayOfMonth),
      fechaFin: this.formatDateToInput(today)
    };
  }

  private formatDateToInput(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateForApi(value: string): string {
    const trimmed = this.normalize(value);
    if (!trimmed) {
      return '';
    }
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        if (day && month && year) {
          return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year.slice(0, 4)}`;
        }
      }
      return trimmed;
    }
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}/${month}/${year}`;
    }
    const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) {
      const [, year, month, day] = compactMatch;
      return `${day}/${month}/${year}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
      const day = `${parsed.getDate()}`.padStart(2, '0');
      return `${day}/${month}/${year}`;
    }
    return trimmed;
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
