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
import { RetiroCxpService } from './retiro.service';
import { RetiroCxpFilters, RetiroCxpListItem, RetiroCxpResponse } from './models/retiro-cxp.model';

type RetiroFiltersForm = {
  codBanco: FormControl<string>;
  ctaBanco: FormControl<string>;
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
  selector: 'app-retiro-list',
  standalone: true,
  imports: [CommonModule, SharedModule, ReactiveFormsModule, RouterModule],
  templateUrl: './retiro-list.component.html',
  styleUrls: ['./retiro-list.component.scss']
})
export class RetiroListComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly retiroService = inject(RetiroCxpService);
  private readonly bancosService = inject(BancosService);
  private readonly cuentaService = inject(CuentaBancoService);
  private readonly toast = inject(ToastService);

  readonly filtersForm: FormGroup<RetiroFiltersForm> = this.fb.group({
    codBanco: this.fb.control(''),
    ctaBanco: this.fb.control(''),
    fechaInicio: this.fb.control('', { validators: [Validators.required] }),
    fechaFin: this.fb.control('', { validators: [Validators.required] })
  });

  readonly pageSizes = [10, 20, 50];
  readonly skeletonRows = Array.from({ length: 6 });

  cuentaOptions: CuentaBancoOption[] = [];
  cuentasLoading = false;
  bancos: Array<{ codBanco: string; descripcion: string }> = [];

  dataSource: RetiroCxpListItem[] = [];
  loading = false;
  totalRegistros = 0;
  pageNumber = 1;
  pageSize = DEFAULT_PAGE_SIZE;
  totalPages = 1;
  showEmptyState = false;
  canPrev = false;
  canNext = false;

  showDeleteModal = false;
  retiroToDelete: RetiroCxpListItem | null = null;
  deleting = false;

  headerSubtitle = 'Aplica y registra pagos a proveedores desde cuentas bancarias.';

  ngOnInit(): void {
    const range = this.getDefaultDateRange();
    this.filtersForm.reset({
      codBanco: '',
      ctaBanco: '',
      fechaInicio: range.fechaInicio,
      fechaFin: range.fechaFin
    });
    this.filtersForm.controls.codBanco.valueChanges.subscribe((value) => this.onBancoChange(value));
    this.updatePagination();
    void this.loadBancos();
    void this.buscar();
  }

  buscar(): void {
    if (this.filtersForm.invalid) {
      this.filtersForm.markAllAsTouched();
      return;
    }
    this.pageNumber = 1;
    void this.loadRetiros();
  }

  resetFiltros(): void {
    const range = this.getDefaultDateRange();
    this.filtersForm.reset({
      codBanco: '',
      ctaBanco: '',
      fechaInicio: range.fechaInicio,
      fechaFin: range.fechaFin
    });
    this.pageNumber = 1;
    void this.loadRetiros();
  }

  onPageSizeChange(size: number | string): void {
    const parsed = Number(size) || DEFAULT_PAGE_SIZE;
    if (parsed === this.pageSize) {
      return;
    }
    this.pageSize = parsed;
    this.pageNumber = 1;
    void this.loadRetiros();
  }

  changePage(delta: number): void {
    const next = Math.min(Math.max(this.pageNumber + delta, 1), this.totalPages);
    if (next === this.pageNumber) {
      return;
    }
    this.pageNumber = next;
    void this.loadRetiros(false);
  }

  nuevoRetiro(): void {
    this.router.navigate(['/finanzas/bancos/retiros-cxp/nuevo']);
  }

  editar(retiro: RetiroCxpListItem): void {
    if (!retiro?.idOperacion) {
      return;
    }
    this.router.navigate(['/finanzas/bancos/retiros-cxp', retiro.idOperacion, 'editar']);
  }

  verDetalle(retiro: RetiroCxpListItem): void {
    if (!retiro?.idOperacion) {
      return;
    }
    this.router.navigate(['/finanzas/bancos/retiros-cxp', retiro.idOperacion]);
  }

  solicitarEliminar(retiro: RetiroCxpListItem): void {
    this.retiroToDelete = retiro;
    this.showDeleteModal = true;
  }

  cancelarEliminar(): void {
    this.showDeleteModal = false;
    this.retiroToDelete = null;
  }

  async confirmarEliminar(): Promise<void> {
    if (!this.retiroToDelete?.idOperacion) {
      return;
    }
    this.deleting = true;
    try {
      await firstValueFrom(this.retiroService.deleteRetiro(this.retiroToDelete.idOperacion));
      this.toast.success('Retiro eliminado correctamente.');
      this.cancelarEliminar();
      await this.loadRetiros();
    } catch (error) {
      this.toast.error(this.getErrorMessage(error, 'No se pudo eliminar el retiro.'));
    } finally {
      this.deleting = false;
    }
  }

  trackByRetiro(index: number, retiro: RetiroCxpListItem): string {
    return retiro.idOperacion || `${retiro.codProve}-${retiro.numOperacion}-${index}`;
  }

  monedaLabel(retiro: RetiroCxpListItem): string {
    return retiro.moneda || 'N/A';
  }

  formatFecha(value: string): string {
    const trimmed = this.normalize(value);
    if (!trimmed) {
      return '';
    }
    if (trimmed.includes('/')) {
      return trimmed;
    }
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
    }
    return trimmed;
  }

  movConLabel(retiro: RetiroCxpListItem): string {
    return this.isConciliado(retiro.movCon) ? 'Conciliado' : 'Pendiente';
  }

  movConClass(retiro: RetiroCxpListItem): string {
    return this.isConciliado(retiro.movCon) ? 'badge-success' : 'badge-warning';
  }

  private async loadRetiros(resetRecords = true): Promise<void> {
    const filtros = this.getFiltros();
    const query: RetiroCxpFilters = {
      pageNumber: this.pageNumber,
      pageSize: this.pageSize,
      codBanco: filtros.codBanco,
      ctaBanco: filtros.ctaBanco,
      fechaInicio: filtros.fechaInicio,
      fechaFin: filtros.fechaFin
    };

    this.loading = true;
    this.showEmptyState = false;
    if (resetRecords) {
      this.dataSource = [];
    }

    try {
      const response = await firstValueFrom(this.retiroService.getRetiros(query));
      this.applyResponse(response);
    } catch (error) {
      console.error('Error al cargar retiros:', error);
      this.dataSource = [];
      this.totalRegistros = 0;
      this.updatePagination();
      this.toast.error(this.getErrorMessage(error, 'No se pudieron cargar los retiros.'));
    } finally {
      this.loading = false;
      this.showEmptyState = !this.loading && this.dataSource.length === 0;
    }
  }

  private applyResponse(response: RetiroCxpResponse): void {
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
      this.filtersForm.controls.ctaBanco.setValue('');
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
      const current = this.filtersForm.controls.ctaBanco.value;
      if (current && !this.cuentaOptions.some((item) => item.value === current)) {
        this.filtersForm.controls.ctaBanco.setValue('');
      }
    } catch (error) {
      console.error('Error al cargar cuentas bancarias:', error);
      this.cuentaOptions = [];
      this.toast.error(this.getErrorMessage(error, 'No se pudieron cargar las cuentas bancarias.'));
    } finally {
      this.cuentasLoading = false;
    }
  }

  private getFiltros(): { codBanco: string; ctaBanco: string; fechaInicio: string; fechaFin: string } {
    const value = this.filtersForm.getRawValue();
    return {
      codBanco: this.normalize(value.codBanco),
      ctaBanco: this.normalize(value.ctaBanco),
      fechaInicio: this.normalize(value.fechaInicio),
      fechaFin: this.normalize(value.fechaFin)
    };
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private isConciliado(value: string | boolean | number | null | undefined): boolean {
    if (typeof value === 'boolean') {
      return value;
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
