import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ToastService } from 'src/app/core/services/toast.service';
import { Banco } from '../bancos/banco.model';
import { BancosService } from '../bancos/bancos.service';
import { CuentaBanco } from './cuenta-banco.model';
import { CuentaBancoService } from './cuenta-banco.service';
import { CuentaBancoModalComponent } from './cuenta-banco-modal/cuenta-banco-modal.component';

type CuentaBancoFilterForm = {
  codBanco: FormControl<string>;
};

@Component({
  selector: 'app-cuenta-banco',
  standalone: true,
  imports: [CommonModule, SharedModule, ReactiveFormsModule, CuentaBancoModalComponent],
  templateUrl: './cuenta-banco.component.html',
  styleUrls: ['./cuenta-banco.component.scss']
})
export class CuentaBancoComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cuentaService = inject(CuentaBancoService);
  private readonly bancosService = inject(BancosService);
  private readonly toast = inject(ToastService);

  readonly filterForm: FormGroup<CuentaBancoFilterForm> = this.fb.group({
    codBanco: this.fb.control('', { validators: [Validators.required] })
  });

  bancos: Banco[] = [];
  cuentas: CuentaBanco[] = [];

  loading = false;
  saving = false;
  bancosLoading = false;

  selectedCodBanco = '';
  showModal = false;
  selectedCuenta: CuentaBanco | null = null;
  defaultCodBanco = '';

  showDeleteModal = false;
  cuentaToDelete: CuentaBanco | null = null;

  recordCount = 0;

  headerSubtitle = 'Administra las cuentas bancarias asociadas a cada banco.';
  loadingLabel = 'Cargando cuentas bancarias...';
  emptyLabel = 'No hay cuentas bancarias para este banco.';
  selectionTitle = 'Selecciona un banco';
  selectionMessage = 'Debes seleccionar un banco para consultar las cuentas registradas.';
  bancosLoadingLabel = 'Cargando bancos...';

  deleteTitle = 'Eliminar cuenta bancaria';
  deleteMessage = '';
  deleteConfirmLabel = 'Eliminar';
  deleteCancelLabel = 'Cancelar';

  showLoadingState = false;
  showEmptyState = false;
  showSelectionHint = true;
  showTable = false;
  actionsDisabled = false;
  createDisabled = true;
  filterDisabled = false;
  showDeleteSpinner = false;

  ngOnInit(): void {
    this.updateUiFlags();
    this.filterForm.controls.codBanco.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onBancoSelected(value));
    void this.loadBancos();
  }

  async loadBancos(): Promise<void> {
    this.bancosLoading = true;
    this.updateUiFlags();
    try {
      const bancos = await firstValueFrom(this.bancosService.getBancos());
      this.bancos = bancos;
    } catch (error) {
      console.error('Error al cargar bancos:', error);
      this.bancos = [];
      this.toast.error(this.getErrorMessage(error, 'No se pudieron cargar los bancos.'));
    } finally {
      this.bancosLoading = false;
      this.updateUiFlags();
    }
  }

  onBancoSelected(value: string): void {
    const normalized = this.normalize(value);
    this.selectedCodBanco = normalized;
    this.defaultCodBanco = normalized;
    if (!normalized) {
      this.setCuentas([]);
      this.setLoading(false);
      this.showSelectionHint = true;
      this.showTable = false;
      this.showEmptyState = false;
      this.updateUiFlags();
      return;
    }
    this.showSelectionHint = false;
    this.showTable = true;
    void this.loadCuentas(normalized);
  }

  async loadCuentas(codBanco: string): Promise<void> {
    this.setLoading(true);
    this.setCuentas([]);
    try {
      const cuentas = await firstValueFrom(this.cuentaService.getCuentas(codBanco));
      this.setCuentas(cuentas);
    } catch (error) {
      console.error('Error al cargar cuentas bancarias:', error);
      this.setCuentas([]);
      this.toast.error(this.getErrorMessage(error, 'No se pudieron cargar las cuentas bancarias.'));
    } finally {
      this.setLoading(false);
    }
  }

  openCreate(): void {
    if (!this.selectedCodBanco) {
      this.toast.warning('Selecciona un banco para crear una cuenta.');
      return;
    }
    this.selectedCuenta = null;
    this.showModal = true;
  }

  openEdit(cuenta: CuentaBanco): void {
    this.selectedCuenta = { ...cuenta };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedCuenta = null;
  }

  async saveCuenta(payload: CuentaBanco): Promise<void> {
    const data = this.buildPayload(payload);
    if (!this.isPayloadValid(data)) {
      this.toast.warning('Completa los campos obligatorios antes de guardar.');
      return;
    }
    this.setSaving(true);
    try {
      if (this.selectedCuenta) {
        await firstValueFrom(this.cuentaService.updateCuenta(this.selectedCuenta.codBanco, this.selectedCuenta.ctaBanco, data));
        this.toast.success('Cuenta bancaria actualizada correctamente.');
      } else {
        await firstValueFrom(this.cuentaService.createCuenta(data));
        this.toast.success('Cuenta bancaria creada correctamente.');
      }
      this.closeModal();
      if (this.selectedCodBanco) {
        await this.loadCuentas(this.selectedCodBanco);
      }
    } catch (error) {
      console.error('Error al guardar cuenta bancaria:', error);
      this.toast.error(this.getErrorMessage(error, 'No se pudo guardar la cuenta bancaria.'));
    } finally {
      this.setSaving(false);
    }
  }

  requestDelete(cuenta: CuentaBanco): void {
    this.cuentaToDelete = cuenta;
    this.deleteMessage = `¿Desea eliminar la cuenta "${cuenta.nombreCta}"?`;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.cuentaToDelete = null;
  }

  async confirmDelete(): Promise<void> {
    if (!this.cuentaToDelete) {
      return;
    }
    this.setSaving(true);
    try {
      await firstValueFrom(this.cuentaService.deleteCuenta(this.cuentaToDelete.codBanco, this.cuentaToDelete.ctaBanco));
      this.toast.success('Cuenta bancaria eliminada correctamente.');
      this.cancelDelete();
      if (this.selectedCodBanco) {
        await this.loadCuentas(this.selectedCodBanco);
      }
    } catch (error) {
      console.error('Error al eliminar cuenta bancaria:', error);
      this.toast.error(this.getErrorMessage(error, 'No se pudo eliminar la cuenta bancaria.'));
    } finally {
      this.setSaving(false);
    }
  }

  private setLoading(value: boolean): void {
    this.loading = value;
    this.updateUiFlags();
  }

  private setSaving(value: boolean): void {
    this.saving = value;
    this.showDeleteSpinner = value;
    this.updateUiFlags();
  }

  private setCuentas(cuentas: CuentaBanco[]): void {
    this.cuentas = cuentas.map((cuenta) => ({
      ...cuenta,
      saldo: this.normalizeNumber(cuenta.saldo),
      saldoBanco: this.normalizeNumber(cuenta.saldoBanco)
    }));
    this.recordCount = this.cuentas.length;
    this.updateUiFlags();
  }

  private updateUiFlags(): void {
    this.actionsDisabled = this.loading || this.saving;
    this.createDisabled = this.actionsDisabled || !this.selectedCodBanco;
    this.filterDisabled = this.bancosLoading || this.saving;
    this.showLoadingState = this.loading;
    this.showEmptyState = !this.loading && !!this.selectedCodBanco && this.cuentas.length === 0;
    this.showSelectionHint = !this.selectedCodBanco;
    this.showTable = !!this.selectedCodBanco;
  }

  private buildPayload(payload: CuentaBanco): CuentaBanco {
    return {
      ctaBanco: this.normalize(payload.ctaBanco),
      codBanco: this.normalize(payload.codBanco) || this.selectedCodBanco,
      nombreCta: this.normalize(payload.nombreCta),
      numeroCta: this.normalize(payload.numeroCta),
      moneda: this.normalize(payload.moneda),
      ctaContable: this.normalize(payload.ctaContable),
      numCheque: this.normalize(payload.numCheque),
      saldo: this.normalizeNumber(payload.saldo),
      fechaApe: this.normalize(payload.fechaApe),
      empresa: this.normalize(payload.empresa),
      operador: this.normalize(payload.operador)
    };
  }

  private isPayloadValid(payload: CuentaBanco): boolean {
    return !!(
      payload.ctaBanco &&
      payload.codBanco &&
      payload.nombreCta &&
      payload.moneda &&
      payload.empresa &&
      payload.operador
    );
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private normalizeNumber(value: number | null | undefined): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
    return 0;
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

