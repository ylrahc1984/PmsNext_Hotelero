import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { Nationality } from './models/nationality.model';
import { NationalityRequest } from './models/nationality-request.model';
import { NationalitiesService } from './services/nationalities.service';

type SearchCriterion = 'codigo' | 'descripcion';
type SortColumn = 'codigo' | 'descripcion' | 'operador';
type SortDirection = 'asc' | 'desc';

interface NationalityForm {
  codigo: FormControl<string>;
  descripcion: FormControl<string>;
  operador: FormControl<string>;
}

@Component({
  selector: 'app-nationalities',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './nationalities.component.html',
  styleUrls: ['./nationalities.component.scss']
})
export class NationalitiesComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly nationalitiesService = inject(NationalitiesService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly nationalityForm: FormGroup<NationalityForm> = this.fb.group({
    codigo: this.fb.control('', { validators: [Validators.required, Validators.maxLength(20)] }),
    descripcion: this.fb.control('', { validators: [Validators.required, Validators.maxLength(150)] }),
    operador: this.fb.control('', { validators: [Validators.required, Validators.maxLength(50)] })
  });

  readonly searchControl = this.fb.control('');
  readonly searchCriterionControl = this.fb.control<SearchCriterion>('codigo');
  readonly pageSizeControl = this.fb.control(10);
  readonly pageSizeOptions = [10, 15, 20];

  nationalities: Nationality[] = [];
  filteredNationalities: Nationality[] = [];
  paginatedNationalities: Nationality[] = [];
  currentPage = 1;
  totalPages = 1;
  isLoading = false;
  isSaving = false;
  isDeleting = false;
  showModal = false;
  isEditing = false;
  errorMessage = '';

  sortColumn: SortColumn = 'codigo';
  sortDirection: SortDirection = 'asc';

  ngOnInit(): void {
    this.loadNationalities();
    this.bindSearch();
    this.bindPageSize();
  }

  loadNationalities(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.nationalitiesService
      .getNationalities()
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar las nacionalidades.', error);
          return of([] as Nationality[]);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((nationalities) => {
        this.nationalities = nationalities;
        this.applySorting();
      });
  }

  sortBy(column: SortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.currentPage = 1;
    this.applySorting();
  }

  onSearchCriterionChange(): void {
    this.searchByCurrentCriteria(this.searchControl.value.trim());
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.errorMessage = '';
    this.nationalityForm.reset(
      {
        codigo: '',
        descripcion: '',
        operador: this.getOperador()
      },
      { emitEvent: false }
    );
    this.nationalityForm.controls.codigo.enable({ emitEvent: false });
    this.showModal = true;
  }

  openEditModal(nationality: Nationality): void {
    this.isEditing = true;
    this.errorMessage = '';
    this.nationalityForm.reset(
      {
        codigo: nationality.CR06_Codigo,
        descripcion: nationality.CR06_Descripcion,
        operador: nationality.CR06_Operador || this.getOperador()
      },
      { emitEvent: false }
    );
    this.nationalityForm.controls.codigo.disable({ emitEvent: false });
    this.showModal = true;
  }

  closeModal(): void {
    if (this.isSaving) {
      return;
    }

    this.showModal = false;
    this.nationalityForm.markAsUntouched();
  }

  saveNationality(): void {
    if (this.nationalityForm.invalid) {
      this.nationalityForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.buildPayload();
    const action = this.isEditing
      ? this.nationalitiesService.updateNationality(payload.codigo, payload)
      : this.nationalitiesService.createNationality(payload);

    action
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar la nacionalidad.', error);
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
            response.respuesta || (this.isEditing ? 'Nacionalidad actualizada correctamente.' : 'Nacionalidad creada correctamente.'),
          type: 'success'
        });
        this.closeModal();
        this.refreshCurrentView();
      });
  }

  deleteNationality(nationality: Nationality): void {
    Swal.fire({
      title: 'Eliminar Nacionalidad',
      text: '¿Desea eliminar esta Nacionalidad?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.nationalitiesService
        .deleteNationality(nationality.CR06_Codigo)
        .pipe(
          catchError((error) => {
            this.handleError('No se pudo eliminar la nacionalidad.', error);
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
            message: response.respuesta || 'Nacionalidad eliminada correctamente.',
            type: 'success'
          });
          this.refreshCurrentView();
        });
    });
  }

  isFieldInvalid(field: keyof NationalityForm): boolean {
    const control = this.nationalityForm.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  getFieldError(field: keyof NationalityForm): string {
    const control = this.nationalityForm.controls[field];

    if (control.errors?.['required']) {
      return 'Campo requerido';
    }

    if (control.errors?.['maxlength']) {
      const maxlengthError = control.errors['maxlength'] as { requiredLength: number };
      return `Máximo ${maxlengthError.requiredLength} caracteres`;
    }

    return '';
  }

  get modalTitle(): string {
    return this.isEditing ? 'Editar Nacionalidad' : 'Nueva Nacionalidad';
  }

  get emptyMessage(): string {
    return this.searchControl.value.trim()
      ? 'No existen nacionalidades que coincidan con la busqueda.'
      : 'No existen nacionalidades registradas.';
  }

  get showingFrom(): number {
    if (!this.filteredNationalities.length) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSizeControl.value + 1;
  }

  get showingTo(): number {
    return Math.min(this.currentPage * this.pageSizeControl.value, this.filteredNationalities.length);
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }

  trackByCodigo(_: number, item: Nationality): string {
    return item.CR06_Codigo;
  }

  goToPage(page: number): void {
    const nextPage = Math.min(Math.max(page, 1), this.totalPages);
    if (nextPage === this.currentPage) {
      return;
    }

    this.currentPage = nextPage;
    this.updatePagination();
  }

  private bindSearch(): void {
    this.searchControl.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((term) => {
        this.searchByCurrentCriteria(term);
      });
  }

  private bindPageSize(): void {
    this.pageSizeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.currentPage = 1;
      this.updatePagination();
    });
  }

  private searchByCurrentCriteria(term: string): void {
    this.currentPage = 1;

    if (!term) {
      this.loadNationalities();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const searchRequest =
      this.searchCriterionControl.value === 'codigo'
        ? this.nationalitiesService.searchByCode(term)
        : this.nationalitiesService.searchByDescription(term);

    searchRequest
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo realizar la busqueda de nacionalidades.', error);
          return of([] as Nationality[]);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((nationalities) => {
        this.nationalities = nationalities;
        this.applySorting();
      });
  }

  private refreshCurrentView(): void {
    const term = this.searchControl.value.trim();
    if (term) {
      this.searchByCurrentCriteria(term);
      return;
    }

    this.loadNationalities();
  }

  private applySorting(): void {
    this.filteredNationalities = [...this.nationalities].sort((left, right) => this.compareNationalities(left, right));
    this.updatePagination();
  }

  private updatePagination(): void {
    const pageSize = this.pageSizeControl.value;
    const totalItems = this.filteredNationalities.length;

    this.totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    this.currentPage = Math.min(this.currentPage, this.totalPages);

    const startIndex = (this.currentPage - 1) * pageSize;
    this.paginatedNationalities = this.filteredNationalities.slice(startIndex, startIndex + pageSize);
  }

  private compareNationalities(left: Nationality, right: Nationality): number {
    const leftValue = this.getSortValue(left);
    const rightValue = this.getSortValue(right);
    const comparison = leftValue.localeCompare(rightValue, 'es', { sensitivity: 'base', numeric: true });

    return this.sortDirection === 'asc' ? comparison : comparison * -1;
  }

  private getSortValue(nationality: Nationality): string {
    const sortValues: Record<SortColumn, string> = {
      codigo: nationality.CR06_Codigo,
      descripcion: nationality.CR06_Descripcion,
      operador: nationality.CR06_Operador
    };

    return sortValues[this.sortColumn] ?? '';
  }

  private buildPayload(): NationalityRequest {
    const raw = this.nationalityForm.getRawValue();

    return {
      proceso: this.isEditing ? 2 : 1,
      codigo: this.sanitizeValue(raw.codigo).toUpperCase(),
      descripcion: this.sanitizeValue(raw.descripcion),
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
