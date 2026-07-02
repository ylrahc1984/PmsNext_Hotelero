import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { PaxType } from './models/pax-type.model';
import { PaxTypeRequest } from './models/pax-type-request.model';
import { PaxTypesService } from './services/pax-types.service';

type SortColumn = 'codigo' | 'descripcion' | 'orden' | 'operador';
type SortDirection = 'asc' | 'desc';

interface PaxTypeForm {
  codigo: FormControl<string>;
  descripcion: FormControl<string>;
  orden: FormControl<number>;
  operador: FormControl<string>;
}

@Component({
  selector: 'app-pax-types',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './pax-types.component.html',
  styleUrls: ['./pax-types.component.scss']
})
export class PaxTypesComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly paxTypesService = inject(PaxTypesService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly paxTypeForm: FormGroup<PaxTypeForm> = this.fb.group({
    codigo: this.fb.control('', { validators: [Validators.required, Validators.maxLength(20)] }),
    descripcion: this.fb.control('', { validators: [Validators.required, Validators.maxLength(150)] }),
    orden: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
    operador: this.fb.control('', { validators: [Validators.required, Validators.maxLength(50)] })
  });

  paxTypes: PaxType[] = [];
  filteredPaxTypes: PaxType[] = [];
  searchTerm = '';
  isLoading = false;
  isSaving = false;
  isDeleting = false;
  showModal = false;
  isEditing = false;
  errorMessage = '';

  sortColumn: SortColumn = 'codigo';
  sortDirection: SortDirection = 'asc';

  ngOnInit(): void {
    this.loadPaxTypes();
  }

  loadPaxTypes(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.paxTypesService
      .getPaxTypes()
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar los Tipos de PAX.', error);
          return of([] as PaxType[]);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((paxTypes) => {
        this.paxTypes = paxTypes;
        this.applyFilters();
      });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  sortBy(column: SortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.applyFilters();
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.errorMessage = '';
    this.paxTypeForm.reset(
      {
        codigo: '',
        descripcion: '',
        orden: 0,
        operador: this.getOperador()
      },
      { emitEvent: false }
    );
    this.paxTypeForm.controls.codigo.enable({ emitEvent: false });
    this.showModal = true;
  }

  openEditModal(paxType: PaxType): void {
    this.isEditing = true;
    this.errorMessage = '';
    this.paxTypeForm.reset(
      {
        codigo: paxType.CR03_CodTipo,
        descripcion: paxType.CR03_Descripcion,
        orden: paxType.CR03_Orden ?? 0,
        operador: paxType.CR03_Operador || this.getOperador()
      },
      { emitEvent: false }
    );
    this.paxTypeForm.controls.codigo.disable({ emitEvent: false });
    this.showModal = true;
  }

  closeModal(): void {
    if (this.isSaving) {
      return;
    }

    this.showModal = false;
    this.paxTypeForm.markAsUntouched();
  }

  savePaxType(): void {
    if (this.paxTypeForm.invalid) {
      this.paxTypeForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.buildPayload();
    const action = this.isEditing ? this.paxTypesService.updatePaxType(payload.codigo, payload) : this.paxTypesService.createPaxType(payload);

    action
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar el Tipo de PAX.', error);
          return EMPTY;
        }),
        finalize(() => {
          this.isSaving = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.toastService.addToast({
          title: 'Exito',
          message: response.respuesta || (this.isEditing ? 'Tipo de PAX actualizado correctamente.' : 'Tipo de PAX creado correctamente.'),
          type: 'success'
        });
        this.closeModal();
        this.loadPaxTypes();
      });
  }

  deletePaxType(paxType: PaxType): void {
    Swal.fire({
      title: 'Eliminar Tipo de PAX',
      text: '¿Desea eliminar este Tipo de PAX?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.paxTypesService
        .deletePaxType(paxType.CR03_CodTipo)
        .pipe(
          catchError((error) => {
            this.handleError('No se pudo eliminar el Tipo de PAX.', error);
            return EMPTY;
          }),
          finalize(() => {
            this.isDeleting = false;
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((response) => {
          this.toastService.addToast({
            title: 'Exito',
            message: response.respuesta || 'Tipo de PAX eliminado correctamente.',
            type: 'success'
          });
          this.loadPaxTypes();
        });
    });
  }

  isFieldInvalid(field: keyof PaxTypeForm): boolean {
    const control = this.paxTypeForm.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  getFieldError(field: keyof PaxTypeForm): string {
    const control = this.paxTypeForm.controls[field];

    if (control.errors?.['required']) {
      return 'Campo requerido';
    }

    if (control.errors?.['min']) {
      return 'Debe ser mayor o igual a 0';
    }

    if (control.errors?.['maxlength']) {
      const maxlengthError = control.errors['maxlength'] as { requiredLength: number };
      return `Máximo ${maxlengthError.requiredLength} caracteres`;
    }

    return '';
  }

  get modalTitle(): string {
    return this.isEditing ? 'Editar Tipo de PAX' : 'Nuevo Tipo de PAX';
  }

  get emptyMessage(): string {
    return this.searchTerm.trim() ? 'No existen Tipos de PAX que coincidan con la busqueda.' : 'No existen Tipos de PAX registrados.';
  }

  trackByCodigo(_: number, item: PaxType): string {
    return item.CR03_CodTipo;
  }

  private applyFilters(): void {
    const term = this.normalizeText(this.searchTerm);

    const filtered = this.paxTypes.filter((paxType) => {
      if (!term) {
        return true;
      }

      return (
        this.normalizeText(paxType.CR03_CodTipo).includes(term) ||
        this.normalizeText(paxType.CR03_Descripcion).includes(term) ||
        this.normalizeText(paxType.CR03_Operador).includes(term)
      );
    });

    this.filteredPaxTypes = filtered.sort((left, right) => this.comparePaxTypes(left, right));
  }

  private comparePaxTypes(left: PaxType, right: PaxType): number {
    const leftValue = this.getSortValue(left);
    const rightValue = this.getSortValue(right);
    const comparison = leftValue.localeCompare(rightValue, 'es', { sensitivity: 'base', numeric: true });

    return this.sortDirection === 'asc' ? comparison : comparison * -1;
  }

  private getSortValue(paxType: PaxType): string {
    const sortValues: Record<SortColumn, string> = {
      codigo: paxType.CR03_CodTipo,
      descripcion: paxType.CR03_Descripcion,
      orden: String(paxType.CR03_Orden ?? 0),
      operador: paxType.CR03_Operador
    };

    return sortValues[this.sortColumn] ?? '';
  }

  private buildPayload(): PaxTypeRequest {
    const raw = this.paxTypeForm.getRawValue();

    return {
      proceso: this.isEditing ? 2 : 1,
      codigo: this.sanitizeValue(raw.codigo).toUpperCase(),
      descripcion: this.sanitizeValue(raw.descripcion),
      orden: raw.orden,
      operador: this.sanitizeValue(raw.operador) || this.getOperador(),
      respuesta: ''
    };
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }

  private sanitizeValue(value: string): string {
    return value.trim();
  }

  private normalizeText(value: string): string {
    return value.trim().toLowerCase();
  }

  private handleError(message: string, error: unknown): void {
    console.error(message, error);
    this.errorMessage = message;
    this.toastService.addToast({
      title: 'Error',
      message,
      type: 'error'
    });
  }
}
