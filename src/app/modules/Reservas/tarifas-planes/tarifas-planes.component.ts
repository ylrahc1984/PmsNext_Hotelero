import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { normalizePmsDateDDMMYYYY, parsePmsDate, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { TarifaReservaRequest, TarifaReservaResponse } from './models/tarifa-reserva.model';
import { TarifaReservaService } from './services/tarifa-reserva.service';

type EstadoFiltro = 'todas' | 'activas' | 'inactivas';

interface TarifaForm {
  codigo: FormControl<string>;
  descripcion: FormControl<string>;
  moneda: FormControl<string>;
  fechaInicial: FormControl<string>;
  fechaFin: FormControl<string>;
  activo: FormControl<boolean>;
  operador: FormControl<string>;
}

@Component({
  selector: 'app-tarifas-planes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule],
  templateUrl: './tarifas-planes.component.html',
  styleUrls: ['./tarifas-planes.component.scss']
})
export class TarifasPlanesComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly tarifaService = inject(TarifaReservaService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly monedas = ['USD', 'CRC'];
  readonly estadoOptions: Array<{ value: EstadoFiltro; label: string }> = [
    { value: 'todas', label: 'Todas' },
    { value: 'activas', label: 'Activas' },
    { value: 'inactivas', label: 'Inactivas' }
  ];

  readonly searchControl = this.fb.control('');
  readonly monedaControl = this.fb.control('');
  readonly estadoControl = this.fb.control<EstadoFiltro>('todas');

  readonly tarifaForm: FormGroup<TarifaForm> = this.fb.group(
    {
      codigo: this.fb.control('', { validators: [Validators.required, Validators.maxLength(20)] }),
      descripcion: this.fb.control('', { validators: [Validators.required, Validators.maxLength(150)] }),
      moneda: this.fb.control('USD', { validators: [Validators.required] }),
      fechaInicial: this.fb.control('', { validators: [Validators.required] }),
      fechaFin: this.fb.control('', { validators: [Validators.required] }),
      activo: this.fb.control(true),
      operador: this.fb.control('', { validators: [Validators.required, Validators.maxLength(50)] })
    },
    { validators: [this.dateRangeValidator] }
  );

  tarifas: TarifaReservaResponse[] = [];
  filteredTarifas: TarifaReservaResponse[] = [];
  isLoading = false;
  isSaving = false;
  isDeleting = false;
  showModal = false;
  isEditMode = false;
  errorMessage = '';

  ngOnInit(): void {
    this.bindFilters();
    this.loadTarifas();
  }

  loadTarifas(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.tarifaService
      .getAll()
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar las tarifas de hospedaje.', error);
          return of([]);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((tarifas) => {
        this.tarifas = tarifas ?? [];
        this.applyFilters();
      });
  }

  refresh(): void {
    this.loadTarifas();
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.errorMessage = '';
    this.tarifaForm.reset(this.getDefaultFormValue(), { emitEvent: false });
    this.tarifaForm.controls.codigo.enable({ emitEvent: false });
    this.showModal = true;
  }

  openEditModal(tarifa: TarifaReservaResponse): void {
    this.isEditMode = true;
    this.errorMessage = '';
    this.tarifaForm.reset(
      {
        codigo: tarifa.MR03_CodTarifa ?? '',
        descripcion: tarifa.MR03_NomTarifa ?? '',
        moneda: tarifa.MR03_Moneda || 'USD',
        fechaInicial: this.toDateInputValue(tarifa.MR03_FecInicial),
        fechaFin: this.toDateInputValue(tarifa.MR03_FecFin),
        activo: this.isActive(tarifa),
        operador: tarifa.MR03_Operador || this.getOperador()
      },
      { emitEvent: false }
    );
    this.tarifaForm.controls.codigo.disable({ emitEvent: false });
    this.showModal = true;
  }

  closeModal(): void {
    if (this.isSaving) {
      return;
    }

    this.showModal = false;
    this.tarifaForm.markAsUntouched();
  }

  saveTarifa(): void {
    if (this.tarifaForm.invalid) {
      this.tarifaForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.buildPayload();
    const action = this.isEditMode ? this.tarifaService.update(payload.codigo, payload) : this.tarifaService.create(payload);

    action
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar la tarifa.', error);
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
          message: response?.respuesta || (this.isEditMode ? 'Tarifa actualizada correctamente.' : 'Tarifa creada correctamente.'),
          type: 'success'
        });
        this.closeModal();
        this.loadTarifas();
      });
  }

  deleteTarifa(tarifa: TarifaReservaResponse): void {
    Swal.fire({
      title: 'Eliminar tarifa',
      text: `¿Desea eliminar la tarifa ${tarifa.MR03_CodTarifa}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.tarifaService
        .delete(tarifa.MR03_CodTarifa)
        .pipe(
          catchError((error) => {
            this.handleError('No se pudo eliminar la tarifa.', error);
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
            message: response?.respuesta || 'Tarifa eliminada correctamente.',
            type: 'success'
          });
          this.loadTarifas();
        });
    });
  }

  administrarTarifa(tarifa: TarifaReservaResponse): void {
    this.router.navigate(['/reservas/tarifas-planes', tarifa.MR03_CodTarifa, 'detalle'], {
      state: {
        codigo: tarifa.MR03_CodTarifa,
        tarifa
      }
    });
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.monedaControl.setValue('', { emitEvent: false });
    this.estadoControl.setValue('todas', { emitEvent: false });
    this.applyFilters();
  }

  isFieldInvalid(field: keyof TarifaForm): boolean {
    const control = this.tarifaForm.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  getFieldError(field: keyof TarifaForm): string {
    const control = this.tarifaForm.controls[field];

    if (control.errors?.['required']) {
      return 'Campo requerido';
    }

    if (control.errors?.['maxlength']) {
      const maxlengthError = control.errors['maxlength'] as { requiredLength: number };
      return `Maximo ${maxlengthError.requiredLength} caracteres`;
    }

    if ((field === 'fechaFin' || field === 'fechaInicial') && this.tarifaForm.errors?.['dateRange']) {
      return 'La fecha final no puede ser menor que la fecha inicial';
    }

    return '';
  }

  hasDateRangeError(): boolean {
    return !!this.tarifaForm.errors?.['dateRange'] && (this.tarifaForm.controls.fechaFin.dirty || this.tarifaForm.controls.fechaFin.touched);
  }

  isActive(tarifa: TarifaReservaResponse): boolean {
    return Number(tarifa.MR03_Activo ?? 0) === 1;
  }

  formatDate(value: string | null | undefined): string {
    return normalizePmsDateDDMMYYYY(value) || 'N/D';
  }

  trackByCode(_: number, item: TarifaReservaResponse): string {
    return item.MR03_CodTarifa;
  }

  get modalTitle(): string {
    return this.isEditMode ? 'Editar tarifa' : 'Nueva tarifa';
  }

  get totalTarifas(): number {
    return this.tarifas.length;
  }

  get activeTarifas(): number {
    return this.tarifas.filter((tarifa) => this.isActive(tarifa)).length;
  }

  get inactiveTarifas(): number {
    return this.totalTarifas - this.activeTarifas;
  }

  get monedaPrincipal(): string {
    if (this.tarifas.length === 0) {
      return 'N/D';
    }

    const counts = this.tarifas.reduce<Record<string, number>>((acc, tarifa) => {
      const moneda = tarifa.MR03_Moneda || 'N/D';
      acc[moneda] = (acc[moneda] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/D';
  }

  get emptyMessage(): string {
    const hasFilters = !!this.searchControl.value.trim() || !!this.monedaControl.value || this.estadoControl.value !== 'todas';
    return hasFilters ? 'No existen tarifas que coincidan con los filtros aplicados.' : 'No existen tarifas de hospedaje registradas.';
  }

  private bindFilters(): void {
    this.searchControl.valueChanges
      .pipe(
        map((value) => value.trim().toLowerCase()),
        debounceTime(250),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.applyFilters());

    this.monedaControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.estadoControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
  }

  private applyFilters(): void {
    const term = this.searchControl.value.trim().toLowerCase();
    const moneda = this.monedaControl.value;
    const estado = this.estadoControl.value;

    this.filteredTarifas = this.tarifas.filter((tarifa) => {
      const matchesTerm =
        !term ||
        tarifa.MR03_CodTarifa?.toLowerCase().includes(term) ||
        tarifa.MR03_NomTarifa?.toLowerCase().includes(term);
      const matchesMoneda = !moneda || tarifa.MR03_Moneda === moneda;
      const matchesEstado =
        estado === 'todas' || (estado === 'activas' && this.isActive(tarifa)) || (estado === 'inactivas' && !this.isActive(tarifa));

      return matchesTerm && matchesMoneda && matchesEstado;
    });
  }

  private buildPayload(): TarifaReservaRequest {
    const raw = this.tarifaForm.getRawValue();

    return {
      proceso: this.isEditMode ? 2 : 1,
      codigo: this.sanitize(raw.codigo).toUpperCase(),
      descripcion: this.sanitize(raw.descripcion).toUpperCase(),
      moneda: this.sanitize(raw.moneda).toUpperCase(),
      fechaInicial: raw.fechaInicial,
      fechaFin: raw.fechaFin,
      activo: raw.activo ? 1 : 0,
      operador: this.sanitize(raw.operador) || this.getOperador(),
      respuesta: ''
    };
  }

  private getDefaultFormValue(): ReturnType<FormGroup<TarifaForm>['getRawValue']> {
    return {
      codigo: '',
      descripcion: '',
      moneda: 'USD',
      fechaInicial: '',
      fechaFin: '',
      activo: true,
      operador: this.getOperador()
    };
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario || 'CHARLY';
  }

  private sanitize(value: string): string {
    return (value ?? '').trim();
  }

  private toDateInputValue(value: string | null | undefined): string {
    return toPmsDateInputValue(value);
  }

  private dateRangeValidator(control: AbstractControl): ValidationErrors | null {
    const fechaInicial = control.get('fechaInicial')?.value;
    const fechaFin = control.get('fechaFin')?.value;

    if (!fechaInicial || !fechaFin) {
      return null;
    }

    const initialDate = parsePmsDate(fechaInicial);
    const finalDate = parsePmsDate(fechaFin);
    return initialDate && finalDate && finalDate.getTime() < initialDate.getTime() ? { dateRange: true } : null;
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
