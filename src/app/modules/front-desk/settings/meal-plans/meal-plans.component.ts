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
import { MealPlanRequest } from './models/meal-plan-request.model';
import { MealPlan } from './models/meal-plan.model';
import { MealPlansService } from './services/meal-plans.service';

type SortColumn = 'codigo' | 'descripcion' | 'orden' | 'operador';
type SortDirection = 'asc' | 'desc';

interface MealPlanForm {
  codigo: FormControl<string>;
  descripcion: FormControl<string>;
  orden: FormControl<number>;
  operador: FormControl<string>;
}

@Component({
  selector: 'app-meal-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './meal-plans.component.html',
  styleUrls: ['./meal-plans.component.scss']
})
export class MealPlansComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly mealPlansService = inject(MealPlansService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mealPlanForm: FormGroup<MealPlanForm> = this.fb.group({
    codigo: this.fb.control('', { validators: [Validators.required, Validators.maxLength(20)] }),
    descripcion: this.fb.control('', { validators: [Validators.required, Validators.maxLength(150)] }),
    orden: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
    operador: this.fb.control('', { validators: [Validators.required, Validators.maxLength(50)] })
  });

  mealPlans: MealPlan[] = [];
  filteredMealPlans: MealPlan[] = [];
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
    this.loadMealPlans();
  }

  loadMealPlans(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.mealPlansService
      .getMealPlans()
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar los planes de alimentacion.', error);
          return of([] as MealPlan[]);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((mealPlans) => {
        this.mealPlans = mealPlans;
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
    this.mealPlanForm.reset(
      {
        codigo: '',
        descripcion: '',
        orden: 0,
        operador: this.getOperador()
      },
      { emitEvent: false }
    );
    this.mealPlanForm.controls.codigo.enable({ emitEvent: false });
    this.showModal = true;
  }

  openEditModal(mealPlan: MealPlan): void {
    this.isEditing = true;
    this.errorMessage = '';
    this.mealPlanForm.reset(
      {
        codigo: mealPlan.MR06_CodPlan,
        descripcion: mealPlan.MR06_PlanAlimenticio,
        orden: mealPlan.MR06_Orden ?? 0,
        operador: mealPlan.MR06_Operador || this.getOperador()
      },
      { emitEvent: false }
    );
    this.mealPlanForm.controls.codigo.disable({ emitEvent: false });
    this.showModal = true;
  }

  closeModal(): void {
    if (this.isSaving) {
      return;
    }

    this.showModal = false;
    this.mealPlanForm.markAsUntouched();
  }

  saveMealPlan(): void {
    if (this.mealPlanForm.invalid) {
      this.mealPlanForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.buildPayload();
    const action = this.isEditing
      ? this.mealPlansService.updateMealPlan(payload.codigo, payload)
      : this.mealPlansService.createMealPlan(payload);

    action
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar el plan de alimentacion.', error);
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
            (this.isEditing ? 'Plan de alimentacion actualizado correctamente.' : 'Plan de alimentacion creado correctamente.'),
          type: 'success'
        });
        this.closeModal();
        this.loadMealPlans();
      });
  }

  deleteMealPlan(mealPlan: MealPlan): void {
    Swal.fire({
      title: 'Eliminar Plan de Alimentacion',
      text: '¿Desea eliminar este Plan de Alimentación?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.mealPlansService
        .deleteMealPlan(mealPlan.MR06_CodPlan)
        .pipe(
          catchError((error) => {
            this.handleError('No se pudo eliminar el plan de alimentacion.', error);
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
            message: response.respuesta || 'Plan de alimentacion eliminado correctamente.',
            type: 'success'
          });
          this.loadMealPlans();
        });
    });
  }

  isFieldInvalid(field: keyof MealPlanForm): boolean {
    const control = this.mealPlanForm.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  getFieldError(field: keyof MealPlanForm): string {
    const control = this.mealPlanForm.controls[field];

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
    return this.isEditing ? 'Editar Plan de Alimentacion' : 'Nuevo Plan de Alimentacion';
  }

  get emptyMessage(): string {
    return this.searchTerm.trim()
      ? 'No existen planes de alimentacion que coincidan con la busqueda.'
      : 'No existen planes de alimentación registrados.';
  }

  trackByCodigo(_: number, item: MealPlan): string {
    return item.MR06_CodPlan;
  }

  private applyFilters(): void {
    const term = this.normalizeText(this.searchTerm);

    const filtered = this.mealPlans.filter((mealPlan) => {
      if (!term) {
        return true;
      }

      return (
        this.normalizeText(mealPlan.MR06_CodPlan).includes(term) ||
        this.normalizeText(mealPlan.MR06_PlanAlimenticio).includes(term) ||
        this.normalizeText(mealPlan.MR06_Operador).includes(term)
      );
    });

    this.filteredMealPlans = filtered.sort((left, right) => this.compareMealPlans(left, right));
  }

  private compareMealPlans(left: MealPlan, right: MealPlan): number {
    const leftValue = this.getSortValue(left);
    const rightValue = this.getSortValue(right);
    const comparison = leftValue.localeCompare(rightValue, 'es', { sensitivity: 'base', numeric: true });

    return this.sortDirection === 'asc' ? comparison : comparison * -1;
  }

  private getSortValue(mealPlan: MealPlan): string {
    const sortValues: Record<SortColumn, string> = {
      codigo: mealPlan.MR06_CodPlan,
      descripcion: mealPlan.MR06_PlanAlimenticio,
      orden: String(mealPlan.MR06_Orden ?? 0),
      operador: mealPlan.MR06_Operador
    };

    return sortValues[this.sortColumn] ?? '';
  }

  private buildPayload(): MealPlanRequest {
    const raw = this.mealPlanForm.getRawValue();

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
