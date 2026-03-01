import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ToastService } from 'src/app/core/services/toast.service';
import { Concepto, ConceptosResponse } from './concepto.model';
import { ConceptosService } from './conceptos.service';
import { ConceptoModalComponent } from './concepto-modal/concepto-modal.component';

type ConceptosFilterForm = {
  concepto: FormControl<string>;
  tipMov: FormControl<string>;
};

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-conceptos',
  standalone: true,
  imports: [CommonModule, SharedModule, ReactiveFormsModule, ConceptoModalComponent],
  templateUrl: './conceptos.component.html',
  styleUrls: ['./conceptos.component.scss']
})
export class ConceptosComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly conceptosService = inject(ConceptosService);
  private readonly toast = inject(ToastService);

  readonly filterForm: FormGroup<ConceptosFilterForm> = this.fb.group({
    concepto: this.fb.control(''),
    tipMov: this.fb.control('')
  });

  readonly pageSizes = [10, 20, 50];
  readonly tipMovOptions: Array<{ value: string; label: string }> = [
    { value: '', label: 'Todos' },
    { value: 'ING', label: 'Ingreso' },
    { value: 'RET', label: 'Retiro' }
  ];

  conceptos: Concepto[] = [];
  loading = false;
  saving = false;

  pageNumber = 1;
  pageSize = DEFAULT_PAGE_SIZE;
  totalRegistros = 0;
  totalPages = 1;

  showModal = false;
  selectedConcepto: Concepto | null = null;

  showDeleteModal = false;
  conceptoToDelete: Concepto | null = null;

  headerSubtitle = 'Administra los conceptos bancarios registrados en el sistema.';
  loadingLabel = 'Cargando conceptos bancarios...';
  emptyLabel = 'No hay conceptos bancarios con los filtros aplicados.';

  deleteTitle = 'Eliminar concepto';
  deleteMessage = '';
  deleteConfirmLabel = 'Eliminar';
  deleteCancelLabel = 'Cancelar';

  showLoadingState = false;
  showEmptyState = false;
  actionsDisabled = false;
  showDeleteSpinner = false;
  canPrev = false;
  canNext = false;
  footerSummary = '';
  paginationSummary = '';

  ngOnInit(): void {
    this.updateUiFlags();
    this.filterForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.onFiltersChanged());
    void this.loadConceptos(1, this.pageSize);
  }

  onBuscar(): void {
    this.pageNumber = 1;
    void this.loadConceptos(this.pageNumber, this.pageSize);
  }

  onLimpiar(): void {
    this.filterForm.reset({ concepto: '', tipMov: '' });
    this.pageNumber = 1;
    void this.loadConceptos(this.pageNumber, this.pageSize);
  }

  onPageSizeChange(size: number | string): void {
    const parsed = Number(size) || DEFAULT_PAGE_SIZE;
    if (parsed === this.pageSize) {
      return;
    }
    this.pageSize = parsed;
    this.pageNumber = 1;
    void this.loadConceptos(this.pageNumber, this.pageSize);
  }

  changePage(delta: number): void {
    const next = Math.min(Math.max(this.pageNumber + delta, 1), this.totalPages);
    if (next === this.pageNumber) {
      return;
    }
    this.pageNumber = next;
    void this.loadConceptos(this.pageNumber, this.pageSize, false);
  }

  openCreate(): void {
    this.selectedConcepto = null;
    this.showModal = true;
  }

  openEdit(concepto: Concepto): void {
    this.selectedConcepto = { ...concepto };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedConcepto = null;
  }

  async saveConcepto(payload: Concepto): Promise<void> {
    const data = this.buildPayload(payload);
    if (!this.isPayloadValid(data)) {
      this.toast.warning('Completa los campos obligatorios antes de guardar.');
      return;
    }
    this.setSaving(true);
    try {
      if (this.selectedConcepto) {
        await firstValueFrom(this.conceptosService.updateConcepto(this.selectedConcepto.codConcepto, data));
        this.toast.success('Concepto actualizado correctamente.');
        await this.loadConceptos(this.pageNumber, this.pageSize, false);
      } else {
        await firstValueFrom(this.conceptosService.createConcepto(data));
        this.toast.success('Concepto creado correctamente.');
        this.pageNumber = 1;
        await this.loadConceptos(this.pageNumber, this.pageSize);
      }
      this.closeModal();
    } catch (error) {
      console.error('Error al guardar concepto:', error);
      this.toast.error(this.getErrorMessage(error, 'No se pudo guardar el concepto.'));
    } finally {
      this.setSaving(false);
    }
  }

  requestDelete(concepto: Concepto): void {
    this.conceptoToDelete = concepto;
    this.deleteMessage = `¿Desea eliminar el concepto "${concepto.concepto}"?`;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.conceptoToDelete = null;
  }

  async confirmDelete(): Promise<void> {
    if (!this.conceptoToDelete) {
      return;
    }
    this.setSaving(true);
    try {
      await firstValueFrom(this.conceptosService.deleteConcepto(this.conceptoToDelete.codConcepto));
      this.toast.success('Concepto eliminado correctamente.');
      this.cancelDelete();
      await this.loadConceptos(this.pageNumber, this.pageSize, false);
    } catch (error) {
      console.error('Error al eliminar concepto:', error);
      this.toast.error(this.getErrorMessage(error, 'No se pudo eliminar el concepto.'));
    } finally {
      this.setSaving(false);
    }
  }

  private async loadConceptos(pageNumber: number, pageSize: number, resetRecords = true): Promise<void> {
    this.setLoading(true);
    if (resetRecords) {
      this.setConceptos([]);
    }
    const filtros = this.getFilters();
    try {
      const response = await firstValueFrom(
        this.conceptosService.getConceptos(pageNumber, pageSize, filtros.concepto, filtros.tipMov)
      );
      this.applyResponse(response, pageNumber, pageSize);
    } catch (error) {
      console.error('Error al cargar conceptos:', error);
      this.totalRegistros = 0;
      this.setConceptos([]);
      this.toast.error(this.getErrorMessage(error, 'No se pudieron cargar los conceptos.'));
    } finally {
      this.setLoading(false);
    }
  }

  private onFiltersChanged(): void {
    this.updateUiFlags();
  }

  private applyResponse(response: ConceptosResponse, pageNumber: number, pageSize: number): void {
    this.totalRegistros = response?.totalRegistros ?? 0;
    this.pageSize = pageSize;
    this.pageNumber = pageNumber;
    this.setConceptos(response?.data ?? []);
  }

  private updatePagination(): void {
    this.totalPages = Math.max(1, Math.ceil(this.totalRegistros / this.pageSize));
    this.pageNumber = Math.min(Math.max(this.pageNumber, 1), this.totalPages);
    this.canPrev = this.pageNumber > 1;
    this.canNext = this.pageNumber < this.totalPages;
    this.footerSummary = `Mostrando ${this.conceptos.length} de ${this.totalRegistros} registros`;
    this.paginationSummary = `Página ${this.pageNumber} de ${this.totalPages}`;
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

  private setConceptos(conceptos: Concepto[]): void {
    this.conceptos = conceptos;
    this.updateUiFlags();
  }

  private updateUiFlags(): void {
    this.actionsDisabled = this.loading || this.saving;
    this.showLoadingState = this.loading;
    this.showEmptyState = !this.loading && this.conceptos.length === 0;
    this.updatePagination();
  }

  private getFilters(): { concepto: string; tipMov: string } {
    const value = this.filterForm.getRawValue();
    return {
      concepto: this.normalize(value.concepto),
      tipMov: this.normalize(value.tipMov)
    };
  }

  private buildPayload(payload: Concepto): Pick<Concepto, 'codConcepto' | 'concepto' | 'tipMov' | 'empresa' | 'operador'> {
    return {
      codConcepto: this.normalize(payload.codConcepto),
      concepto: this.normalize(payload.concepto),
      tipMov: this.normalize(payload.tipMov),
      empresa: this.normalize(payload.empresa),
      operador: this.normalize(payload.operador)
    };
  }

  private isPayloadValid(payload: Pick<Concepto, 'codConcepto' | 'concepto' | 'tipMov' | 'empresa' | 'operador'>): boolean {
    return !!(payload.codConcepto && payload.concepto && payload.tipMov && payload.empresa && payload.operador);
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
