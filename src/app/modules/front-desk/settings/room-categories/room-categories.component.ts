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
import { RoomCategory } from './models/room-category.model';
import { RoomCategoryRequest } from './models/room-category-request.model';
import { RoomCategoriesService } from './services/room-categories.service';

type SortColumn = 'codigo' | 'categoria' | 'numHabi' | 'orden' | 'operador';
type SortDirection = 'asc' | 'desc';

interface RoomCategoryForm {
  codigo: FormControl<string>;
  categoria: FormControl<string>;
  numHabi: FormControl<number>;
  orden: FormControl<number>;
  operador: FormControl<string>;
}

@Component({
  selector: 'app-room-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './room-categories.component.html',
  styleUrls: ['./room-categories.component.scss']
})
export class RoomCategoriesComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly roomCategoriesService = inject(RoomCategoriesService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly roomCategoryForm: FormGroup<RoomCategoryForm> = this.fb.group({
    codigo: this.fb.control('', { validators: [Validators.required, Validators.maxLength(20)] }),
    categoria: this.fb.control('', { validators: [Validators.required, Validators.maxLength(150)] }),
    numHabi: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
    orden: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
    operador: this.fb.control('', { validators: [Validators.required, Validators.maxLength(50)] })
  });

  roomCategories: RoomCategory[] = [];
  filteredRoomCategories: RoomCategory[] = [];
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
    this.loadRoomCategories();
  }

  loadRoomCategories(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.roomCategoriesService
      .getRoomCategories()
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar las categorias de habitaciones.', error);
          return of([] as RoomCategory[]);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((roomCategories) => {
        this.roomCategories = roomCategories;
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
    this.roomCategoryForm.reset(
      {
        codigo: '',
        categoria: '',
        numHabi: 0,
        orden: 0,
        operador: this.getOperador()
      },
      { emitEvent: false }
    );
    this.roomCategoryForm.controls.codigo.enable({ emitEvent: false });
    this.showModal = true;
  }

  openEditModal(roomCategory: RoomCategory): void {
    this.isEditing = true;
    this.errorMessage = '';
    this.roomCategoryForm.reset(
      {
        codigo: roomCategory.CR01_CodCate,
        categoria: roomCategory.CR01_Categoria,
        numHabi: roomCategory.CR01_NumHabita ?? 0,
        orden: roomCategory.CR01_Orden ?? 0,
        operador: roomCategory.CR01_Operador || this.getOperador()
      },
      { emitEvent: false }
    );
    this.roomCategoryForm.controls.codigo.disable({ emitEvent: false });
    this.showModal = true;
  }

  closeModal(): void {
    if (this.isSaving) {
      return;
    }

    this.showModal = false;
    this.roomCategoryForm.markAsUntouched();
  }

  saveRoomCategory(): void {
    if (this.roomCategoryForm.invalid) {
      this.roomCategoryForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.buildPayload();
    const action = this.isEditing
      ? this.roomCategoriesService.updateRoomCategory(payload.codigo, payload)
      : this.roomCategoriesService.createRoomCategory(payload);

    action
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar la categoria de habitacion.', error);
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
          message:
            response.respuesta ||
            (this.isEditing ? 'Categoria de habitacion actualizada correctamente.' : 'Categoria de habitacion creada correctamente.'),
          type: 'success'
        });
        this.closeModal();
        this.loadRoomCategories();
      });
  }

  deleteRoomCategory(roomCategory: RoomCategory): void {
    Swal.fire({
      title: 'Eliminar Categoria de Habitacion',
      text: '¿Desea eliminar esta Categoría de Habitación?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.roomCategoriesService
        .deleteRoomCategory(roomCategory.CR01_CodCate)
        .pipe(
          catchError((error) => {
            this.handleError('No se pudo eliminar la categoria de habitacion.', error);
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
            message: response.respuesta || 'Categoria de habitacion eliminada correctamente.',
            type: 'success'
          });
          this.loadRoomCategories();
        });
    });
  }

  isFieldInvalid(field: keyof RoomCategoryForm): boolean {
    const control = this.roomCategoryForm.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  getFieldError(field: keyof RoomCategoryForm): string {
    const control = this.roomCategoryForm.controls[field];

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
    return this.isEditing ? 'Editar Categoria de Habitacion' : 'Nueva Categoria de Habitacion';
  }

  get emptyMessage(): string {
    return this.searchTerm.trim()
      ? 'No existen categorias de habitaciones que coincidan con la busqueda.'
      : 'No existen categorías de habitaciones registradas.';
  }

  trackByCodigo(_: number, item: RoomCategory): string {
    return item.CR01_CodCate;
  }

  private applyFilters(): void {
    const term = this.normalizeText(this.searchTerm);

    const filtered = this.roomCategories.filter((roomCategory) => {
      if (!term) {
        return true;
      }

      return (
        this.normalizeText(roomCategory.CR01_CodCate).includes(term) ||
        this.normalizeText(roomCategory.CR01_Categoria).includes(term) ||
        this.normalizeText(roomCategory.CR01_Operador).includes(term)
      );
    });

    this.filteredRoomCategories = filtered.sort((left, right) => this.compareRoomCategories(left, right));
  }

  private compareRoomCategories(left: RoomCategory, right: RoomCategory): number {
    const leftValue = this.getSortValue(left);
    const rightValue = this.getSortValue(right);
    const comparison = leftValue.localeCompare(rightValue, 'es', { sensitivity: 'base', numeric: true });

    return this.sortDirection === 'asc' ? comparison : comparison * -1;
  }

  private getSortValue(roomCategory: RoomCategory): string {
    const sortValues: Record<SortColumn, string> = {
      codigo: roomCategory.CR01_CodCate,
      categoria: roomCategory.CR01_Categoria,
      numHabi: String(roomCategory.CR01_NumHabita ?? 0),
      orden: String(roomCategory.CR01_Orden ?? 0),
      operador: roomCategory.CR01_Operador
    };

    return sortValues[this.sortColumn] ?? '';
  }

  private buildPayload(): RoomCategoryRequest {
    const raw = this.roomCategoryForm.getRawValue();

    return {
      proceso: this.isEditing ? 2 : 1,
      codigo: this.sanitizeValue(raw.codigo).toUpperCase(),
      categoria: this.sanitizeValue(raw.categoria),
      numHabi: raw.numHabi,
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
