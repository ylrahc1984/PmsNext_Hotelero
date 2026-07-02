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
import { RoomCategory } from '../room-categories/models/room-category.model';
import { RoomCategoriesService } from '../room-categories/services/room-categories.service';
import { RoomType } from './models/room-type.model';
import { RoomTypeRequest } from './models/room-type-request.model';
import { RoomTypesService } from './services/room-types.service';

type SortColumn = 'codigo' | 'descripcion' | 'numHabi' | 'numPax' | 'orden' | 'operador';
type SortDirection = 'asc' | 'desc';

interface RoomTypeForm {
  codTipo: FormControl<string>;
  codCate: FormControl<string>;
  descripcion: FormControl<string>;
  numHabi: FormControl<number>;
  numPax: FormControl<number>;
  activo: FormControl<boolean>;
  orden: FormControl<number>;
  operador: FormControl<string>;
}

@Component({
  selector: 'app-room-types',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './room-types.component.html',
  styleUrls: ['./room-types.component.scss']
})
export class RoomTypesComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly roomCategoriesService = inject(RoomCategoriesService);
  private readonly roomTypesService = inject(RoomTypesService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly roomTypeForm: FormGroup<RoomTypeForm> = this.fb.group({
    codTipo: this.fb.control('', { validators: [Validators.required, Validators.maxLength(20)] }),
    codCate: this.fb.control('', { validators: [Validators.required, Validators.maxLength(20)] }),
    descripcion: this.fb.control('', { validators: [Validators.required, Validators.maxLength(150)] }),
    numHabi: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
    numPax: this.fb.control(1, { validators: [Validators.required, Validators.min(1)] }),
    activo: this.fb.control(true),
    orden: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
    operador: this.fb.control('', { validators: [Validators.required, Validators.maxLength(50)] })
  });

  roomCategories: RoomCategory[] = [];
  roomTypes: RoomType[] = [];
  filteredRoomTypes: RoomType[] = [];
  selectedCategoryCode = '';
  searchTerm = '';
  isLoadingCategories = false;
  isLoadingTypes = false;
  isLoadingRecord = false;
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
    this.isLoadingCategories = true;
    this.errorMessage = '';

    this.roomCategoriesService
      .getRoomCategories()
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar las categorias de habitaciones.', error);
          return of([] as RoomCategory[]);
        }),
        finalize(() => {
          this.isLoadingCategories = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((roomCategories) => {
        this.roomCategories = roomCategories;
      });
  }

  onCategoryChange(): void {
    this.searchTerm = '';
    this.roomTypes = [];
    this.filteredRoomTypes = [];
    this.errorMessage = '';

    if (!this.selectedCategoryCode) {
      return;
    }

    this.loadRoomTypesBySelectedCategory();
  }

  loadRoomTypesBySelectedCategory(): void {
    if (!this.selectedCategoryCode) {
      return;
    }

    this.isLoadingTypes = true;
    this.errorMessage = '';

    this.roomTypesService
      .getRoomTypesByCategory(this.selectedCategoryCode)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar los tipos de habitacion.', error);
          return of([] as RoomType[]);
        }),
        finalize(() => {
          this.isLoadingTypes = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((roomTypes) => {
        this.roomTypes = roomTypes;
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
    if (!this.selectedCategoryCode) {
      this.toastService.addToast({
        title: 'Atencion',
        message: 'Seleccione una categoria antes de crear un Tipo de Habitacion.',
        type: 'warning'
      });
      return;
    }

    this.isEditing = false;
    this.errorMessage = '';
    this.roomTypeForm.reset(
      {
        codTipo: '',
        codCate: this.selectedCategoryCode,
        descripcion: '',
        numHabi: 0,
        numPax: 1,
        activo: true,
        orden: 0,
        operador: this.getOperador()
      },
      { emitEvent: false }
    );
    this.roomTypeForm.controls.codTipo.enable({ emitEvent: false });
    this.roomTypeForm.controls.codCate.disable({ emitEvent: false });
    this.showModal = true;
  }

  openEditModal(roomType: RoomType): void {
    this.isLoadingRecord = true;
    this.errorMessage = '';

    this.roomTypesService
      .getRoomType(roomType.CR02_TipHabita, roomType.CR02_CatHabita)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo cargar el tipo de habitacion.', error);
          return of(null);
        }),
        finalize(() => {
          this.isLoadingRecord = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((record) => {
        if (!record) {
          this.handleError('No se encontro el tipo de habitacion seleccionado.', null);
          return;
        }

        this.isEditing = true;
        this.roomTypeForm.reset(
          {
            codTipo: record.CR02_TipHabita,
            codCate: record.CR02_CatHabita,
            descripcion: record.CR02_NomHabita,
            numHabi: record.CR02_NumHabita ?? 0,
            numPax: record.CR02_NumPax ?? 1,
            activo: record.CR02_Activo === 1,
            orden: record.CR02_Orden ?? 0,
            operador: record.CR02_Operador || this.getOperador()
          },
          { emitEvent: false }
        );
        this.roomTypeForm.controls.codTipo.disable({ emitEvent: false });
        this.roomTypeForm.controls.codCate.disable({ emitEvent: false });
        this.showModal = true;
      });
  }

  closeModal(): void {
    if (this.isSaving) {
      return;
    }

    this.showModal = false;
    this.roomTypeForm.markAsUntouched();
  }

  saveRoomType(): void {
    if (this.roomTypeForm.invalid) {
      this.roomTypeForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.buildPayload();
    const action = this.isEditing
      ? this.roomTypesService.updateRoomType(payload.codTipo, payload.codCate, payload)
      : this.roomTypesService.createRoomType(payload);

    action
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar el tipo de habitacion.', error);
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
            (this.isEditing ? 'Tipo de habitacion actualizado correctamente.' : 'Tipo de habitacion creado correctamente.'),
          type: 'success'
        });
        this.closeModal();
        this.loadRoomTypesBySelectedCategory();
      });
  }

  deleteRoomType(roomType: RoomType): void {
    Swal.fire({
      title: 'Eliminar Tipo de Habitacion',
      text: '¿Desea eliminar este Tipo de Habitación?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.roomTypesService
        .deleteRoomType(roomType.CR02_TipHabita, roomType.CR02_CatHabita)
        .pipe(
          catchError((error) => {
            this.handleError('No se pudo eliminar el tipo de habitacion.', error);
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
            message: response.respuesta || 'Tipo de habitacion eliminado correctamente.',
            type: 'success'
          });
          this.loadRoomTypesBySelectedCategory();
        });
    });
  }

  isFieldInvalid(field: keyof RoomTypeForm): boolean {
    const control = this.roomTypeForm.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  getFieldError(field: keyof RoomTypeForm): string {
    const control = this.roomTypeForm.controls[field];

    if (control.errors?.['required']) {
      return 'Campo requerido';
    }

    if (control.errors?.['min']) {
      const minError = control.errors['min'] as { min: number };
      return `Debe ser mayor o igual a ${minError.min}`;
    }

    if (control.errors?.['maxlength']) {
      const maxlengthError = control.errors['maxlength'] as { requiredLength: number };
      return `Máximo ${maxlengthError.requiredLength} caracteres`;
    }

    return '';
  }

  get isLoading(): boolean {
    return this.isLoadingCategories || this.isLoadingTypes;
  }

  get modalTitle(): string {
    return this.isEditing ? 'Editar Tipo de Habitacion' : 'Nuevo Tipo de Habitacion';
  }

  get emptyMessage(): string {
    if (!this.selectedCategoryCode) {
      return 'Seleccione una categoría para visualizar sus Tipos de Habitación.';
    }

    return this.searchTerm.trim()
      ? 'No existen Tipos de Habitación que coincidan con la busqueda.'
      : 'No existen Tipos de Habitación registrados para esta categoría.';
  }

  trackByCodigo(_: number, item: RoomType): string {
    return `${item.CR02_CatHabita}-${item.CR02_TipHabita}`;
  }

  private applyFilters(): void {
    const term = this.normalizeText(this.searchTerm);

    const filtered = this.roomTypes.filter((roomType) => {
      if (!term) {
        return true;
      }

      return (
        this.normalizeText(roomType.CR02_TipHabita).includes(term) ||
        this.normalizeText(roomType.CR02_NomHabita).includes(term) ||
        this.normalizeText(roomType.CR02_Operador).includes(term)
      );
    });

    this.filteredRoomTypes = filtered.sort((left, right) => this.compareRoomTypes(left, right));
  }

  private compareRoomTypes(left: RoomType, right: RoomType): number {
    const leftValue = this.getSortValue(left);
    const rightValue = this.getSortValue(right);
    const comparison = leftValue.localeCompare(rightValue, 'es', { sensitivity: 'base', numeric: true });

    return this.sortDirection === 'asc' ? comparison : comparison * -1;
  }

  private getSortValue(roomType: RoomType): string {
    const sortValues: Record<SortColumn, string> = {
      codigo: roomType.CR02_TipHabita,
      descripcion: roomType.CR02_NomHabita,
      numHabi: String(roomType.CR02_NumHabita ?? 0),
      numPax: String(roomType.CR02_NumPax ?? 0),
      orden: String(roomType.CR02_Orden ?? 0),
      operador: roomType.CR02_Operador
    };

    return sortValues[this.sortColumn] ?? '';
  }

  private buildPayload(): RoomTypeRequest {
    const raw = this.roomTypeForm.getRawValue();

    return {
      proceso: this.isEditing ? 2 : 1,
      codTipo: this.sanitizeValue(raw.codTipo).toUpperCase(),
      codCate: this.sanitizeValue(raw.codCate).toUpperCase(),
      descripcion: this.sanitizeValue(raw.descripcion),
      numHabi: raw.numHabi,
      numPax: raw.numPax,
      activo: raw.activo ? 1 : 0,
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
