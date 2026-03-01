import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ToastService } from 'src/app/core/services/toast.service';
import { Banco } from './banco.model';
import { BancosService } from './bancos.service';
import { BancoModalComponent } from './banco-modal/banco-modal.component';

@Component({
  selector: 'app-bancos',
  standalone: true,
  imports: [CommonModule, SharedModule, BancoModalComponent],
  templateUrl: './bancos.component.html',
  styleUrls: ['./bancos.component.scss']
})
export class BancosComponent implements OnInit {
  private readonly bancosService = inject(BancosService);
  private readonly toast = inject(ToastService);

  bancos: Banco[] = [];
  loading = false;
  saving = false;
  showModal = false;
  selectedBanco: Banco | null = null;

  showDeleteModal = false;
  bancoToDelete: Banco | null = null;

  recordCount = 0;

  headerSubtitle = 'Administra los bancos disponibles y su operador asignado.';
  loadingLabel = 'Cargando bancos...';
  emptyLabel = 'No hay bancos registrados.';
  deleteTitle = 'Eliminar banco';
  deleteMessage = '';
  deleteConfirmLabel = 'Eliminar';
  deleteCancelLabel = 'Cancelar';

  showLoadingState = false;
  showEmptyState = false;
  actionsDisabled = false;
  showDeleteSpinner = false;

  ngOnInit(): void {
    this.updateUiFlags();
    void this.loadBancos();
  }

  async loadBancos(): Promise<void> {
    this.setLoading(true);
    try {
      const bancos = await firstValueFrom(this.bancosService.getBancos());
      this.setBancos(bancos);
    } catch (error) {
      this.setBancos([]);
      this.toast.error(this.getErrorMessage(error, 'No se pudieron cargar los bancos.'));
    } finally {
      this.setLoading(false);
    }
  }

  openCreate(): void {
    this.selectedBanco = null;
    this.showModal = true;
  }

  openEdit(banco: Banco): void {
    this.selectedBanco = { ...banco };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedBanco = null;
  }

  async saveBanco(payload: Banco): Promise<void> {
    const data = this.buildPayload(payload);
    if (!data.codBanco) {
      this.toast.warning('El código del banco es obligatorio.');
      return;
    }
    this.setSaving(true);
    try {
      if (this.selectedBanco) {
        const codBanco = this.selectedBanco.codBanco || data.codBanco;
        await firstValueFrom(this.bancosService.updateBanco(codBanco, data));
        this.toast.success('Banco actualizado correctamente.');
      } else {
        await firstValueFrom(this.bancosService.createBanco(data));
        this.toast.success('Banco creado correctamente.');
      }
      this.closeModal();
      await this.loadBancos();
    } catch (error) {
      this.toast.error(this.getErrorMessage(error, 'No se pudo guardar el banco.'));
    } finally {
      this.setSaving(false);
    }
  }

  requestDelete(banco: Banco): void {
    this.bancoToDelete = banco;
    this.deleteMessage = `¿Desea eliminar el banco "${banco.descripcion}"?`;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.bancoToDelete = null;
  }

  async confirmDelete(): Promise<void> {
    if (!this.bancoToDelete) {
      return;
    }
    this.setSaving(true);
    try {
      await firstValueFrom(this.bancosService.deleteBanco(this.bancoToDelete.codBanco));
      this.toast.success('Banco eliminado correctamente.');
      this.cancelDelete();
      await this.loadBancos();
    } catch (error) {
      this.toast.error(this.getErrorMessage(error, 'No se pudo eliminar el banco.'));
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

  private setBancos(bancos: Banco[]): void {
    this.bancos = bancos;
    this.recordCount = bancos.length;
    this.updateUiFlags();
  }

  private updateUiFlags(): void {
    this.actionsDisabled = this.loading || this.saving;
    this.showLoadingState = this.loading;
    this.showEmptyState = !this.loading && this.bancos.length === 0;
  }

  private buildPayload(payload: Banco): Banco {
    return {
      codBanco: this.normalize(payload.codBanco),
      descripcion: this.normalize(payload.descripcion),
      operador: this.normalize(payload.operador)
    };
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '').toString().trim();
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

