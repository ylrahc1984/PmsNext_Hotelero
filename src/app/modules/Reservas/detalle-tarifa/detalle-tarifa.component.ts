import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, forkJoin, of } from 'rxjs';
import { catchError, finalize, take } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { CentroCostoService } from 'src/app/demo/administracion/centro-costo/centro-costo.service';
import { CentroCostoUI } from 'src/app/demo/administracion/centro-costo/centro-costo.models';
import { RoomCategory } from 'src/app/modules/front-desk/settings/room-categories/models/room-category.model';
import { RoomCategoriesService } from 'src/app/modules/front-desk/settings/room-categories/services/room-categories.service';
import { RoomType } from 'src/app/modules/front-desk/settings/room-types/models/room-type.model';
import { RoomTypesService } from 'src/app/modules/front-desk/settings/room-types/services/room-types.service';
import { TarifaReservaResponse } from '../tarifas-planes/models/tarifa-reserva.model';
import { TarifaReservaService } from '../tarifas-planes/services/tarifa-reserva.service';
import { DetalleTarifaRequest, DetalleTarifaResponse } from './models/detalle-tarifa.model';
import { DetalleTarifaService } from './services/detalle-tarifa.service';

type ActiveTab = 'hospedaje' | 'alimentacion';

interface DetalleForm {
  tipoHabitacion: FormControl<string>;
  descripcion: FormControl<string>;
  precio: FormControl<number>;
  impuestoIncluido: FormControl<boolean>;
  centroCosto: FormControl<string>;
  operador: FormControl<string>;
}

@Component({
  selector: 'app-detalle-tarifa',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './detalle-tarifa.component.html',
  styleUrls: ['./detalle-tarifa.component.scss']
})
export class DetalleTarifaComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly tarifaService = inject(TarifaReservaService);
  private readonly detalleService = inject(DetalleTarifaService);
  private readonly roomCategoriesService = inject(RoomCategoriesService);
  private readonly roomTypesService = inject(RoomTypesService);
  private readonly centroCostoService = inject(CentroCostoService);

  readonly detalleForm: FormGroup<DetalleForm> = this.fb.group({
    tipoHabitacion: this.fb.control('', { validators: [Validators.required] }),
    descripcion: this.fb.control({ value: '', disabled: true }),
    precio: this.fb.control(0, { validators: [Validators.required, Validators.min(0.01)] }),
    impuestoIncluido: this.fb.control(true),
    centroCosto: this.fb.control('', { validators: [Validators.required] }),
    operador: this.fb.control('', { validators: [Validators.required] })
  });

  codigoTarifa = '';
  tarifa: TarifaReservaResponse | null = null;
  activeTab: ActiveTab = 'hospedaje';
  categorias: RoomCategory[] = [];
  tiposHabitacion: RoomType[] = [];
  centrosCosto: CentroCostoUI[] = [];
  detalles: DetalleTarifaResponse[] = [];
  selectedCategoria = '';
  isLoading = true;
  isLoadingDetalles = false;
  isSaving = false;
  isDeleting = false;
  drawerOpen = false;
  isEditMode = false;
  editingDetalle: DetalleTarifaResponse | null = null;
  errorMessage = '';

  readonly planServicios = [
    { servicio: 'Desayuno buffet', centroCosto: 'REST', precio: 18 },
    { servicio: 'Cena ejecutiva', centroCosto: 'REST', precio: 28 }
  ];

  ngOnInit(): void {
    this.codigoTarifa = this.route.snapshot.paramMap.get('codigo')?.trim() || history.state?.codigo || '';
    const tarifaState = history.state?.tarifa as TarifaReservaResponse | undefined;
    if (tarifaState?.MR03_CodTarifa) {
      this.tarifa = tarifaState;
    }

    if (!this.codigoTarifa) {
      this.errorMessage = 'No se recibio el codigo de tarifa.';
      this.isLoading = false;
      return;
    }

    this.bindRoomTypeSelection();
    this.loadInitialData();
  }

  goBack(): void {
    this.router.navigate(['/reservas/tarifas-planes']);
  }

  setTab(tab: ActiveTab): void {
    this.activeTab = tab;
  }

  onCategoriaChange(categoria: string): void {
    this.selectedCategoria = categoria;
    this.closeDrawer();
    this.loadRoomTypes(categoria);
    this.loadDetalles();
  }

  openCreateDrawer(): void {
    if (!this.selectedCategoria) {
      this.toastService.addToast({ title: 'Categoria requerida', message: 'Seleccione una categoria de habitacion.', type: 'warning' });
      return;
    }

    this.isEditMode = false;
    this.editingDetalle = null;
    this.detalleForm.reset(this.defaultFormValue(), { emitEvent: false });
    this.drawerOpen = true;
  }

  openEditDrawer(detalle: DetalleTarifaResponse): void {
    this.isEditMode = true;
    this.editingDetalle = detalle;
    this.detalleForm.reset(
      {
        tipoHabitacion: detalle.MR04_TipHabita,
        descripcion: detalle.MR04_NomHabita,
        precio: this.toNumber(detalle.MR04_Total),
        impuestoIncluido: this.toNumber(detalle.MR04_ImpInc) === 1,
        centroCosto: detalle.MR04_Area || '',
        operador: detalle.MR04_Operador || this.getOperador()
      },
      { emitEvent: false }
    );
    this.detalleForm.controls.tipoHabitacion.disable({ emitEvent: false });
    this.drawerOpen = true;
  }

  closeDrawer(): void {
    if (this.isSaving) {
      return;
    }

    this.drawerOpen = false;
    this.detalleForm.controls.tipoHabitacion.enable({ emitEvent: false });
    this.detalleForm.markAsUntouched();
  }

  saveDetalle(): void {
    if (this.detalleForm.invalid) {
      this.detalleForm.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    const duplicate = this.detalles.some(
      (detalle) =>
        detalle.MR04_TipHabita === payload.tipoHabitacion &&
        detalle.MR04_CatHabita === payload.categoriaHabitacion &&
        (!this.isEditMode || detalle.MR04_TipHabita !== this.editingDetalle?.MR04_TipHabita)
    );

    if (duplicate) {
      this.toastService.addToast({
        title: 'Registro duplicado',
        message: 'Este tipo de habitacion ya existe para la categoria seleccionada.',
        type: 'warning'
      });
      return;
    }

    this.isSaving = true;
    const action = this.isEditMode ? this.detalleService.update(this.codigoTarifa, payload) : this.detalleService.create(payload);

    action
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar la configuracion de hospedaje.', error);
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
          message: response?.respuesta || 'Configuracion guardada correctamente.',
          type: 'success'
        });
        this.closeDrawer();
        this.loadDetalles();
      });
  }

  deleteDetalle(detalle: DetalleTarifaResponse): void {
    Swal.fire({
      title: 'Eliminar tarifa',
      text: '¿Desea eliminar esta tarifa?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.detalleService
        .delete(this.codigoTarifa, detalle.MR04_CatHabita, detalle.MR04_TipHabita, this.getOperador())
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
          this.loadDetalles();
        });
    });
  }

  saveChanges(): void {
    this.toastService.addToast({
      title: 'Cambios guardados',
      message: 'La configuracion visible esta actualizada.',
      type: 'success'
    });
  }

  isFieldInvalid(field: keyof DetalleForm): boolean {
    const control = this.detalleForm.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  getFieldError(field: keyof DetalleForm): string {
    const control = this.detalleForm.controls[field];
    if (control.errors?.['required']) {
      return 'Campo requerido';
    }

    if (control.errors?.['min']) {
      return 'Debe ser mayor que cero';
    }

    return '';
  }

  formatMoney(value: number | string | null | undefined): string {
    const amount = this.toNumber(value);
    const currency = this.tarifa?.MR03_Moneda || 'USD';
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(amount);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'N/D';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'N/D';
    }

    return new Intl.DateTimeFormat('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  trackByDetalle(_: number, item: DetalleTarifaResponse): string {
    return `${item.MR04_CodTarifa}-${item.MR04_CatHabita}-${item.MR04_TipHabita}`;
  }

  trackByCodigo(_: number, item: { CR01_CodCate?: string; CR02_TipHabita?: string; codGrupo?: string }): string {
    return item.CR01_CodCate || item.CR02_TipHabita || item.codGrupo || '';
  }

  get drawerTitle(): string {
    return this.isEditMode ? 'Editar hospedaje' : 'Nuevo hospedaje';
  }

  get selectedCategoriaLabel(): string {
    return this.categorias.find((categoria) => categoria.CR01_CodCate === this.selectedCategoria)?.CR01_Categoria || this.selectedCategoria || 'Sin categoria';
  }

  get totalTipos(): number {
    return this.detalles.length;
  }

  get precioPromedio(): number {
    if (!this.detalles.length) {
      return 0;
    }

    return this.detalles.reduce((total, item) => total + this.toNumber(item.MR04_Total), 0) / this.detalles.length;
  }

  get precioMaximo(): number {
    return this.detalles.length ? Math.max(...this.detalles.map((item) => this.toNumber(item.MR04_Total))) : 0;
  }

  get precioMinimo(): number {
    return this.detalles.length ? Math.min(...this.detalles.map((item) => this.toNumber(item.MR04_Total))) : 0;
  }

  get planTotal(): number {
    return this.planServicios.reduce((total, item) => total + item.precio, 0);
  }

  private loadInitialData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      categorias: this.roomCategoriesService.getRoomCategories().pipe(catchError(() => of([]))),
      centrosCosto: this.centroCostoService.getAll(1, 500).pipe(catchError(() => of({ data: [], totalPaginas: 1, paginaActual: 1, totalRegistros: 0 }))),
      tarifa: this.tarifa ? of(this.tarifa) : this.tarifaService.getByCodigo(this.codigoTarifa).pipe(catchError(() => of([])))
    })
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ categorias, centrosCosto, tarifa }) => {
        this.categorias = categorias;
        this.centrosCosto = centrosCosto.data;
        this.tarifa = this.resolveTarifa(tarifa) || this.tarifa;
        this.selectedCategoria = this.categorias[0]?.CR01_CodCate || '';

        if (this.selectedCategoria) {
          this.loadRoomTypes(this.selectedCategoria);
          this.loadDetalles();
        }
      });
  }

  private loadRoomTypes(categoria: string): void {
    if (!categoria) {
      this.tiposHabitacion = [];
      return;
    }

    this.roomTypesService
      .getRoomTypesByCategory(categoria)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar los tipos de habitacion.', error);
          return of([]);
        }),
        take(1)
      )
      .subscribe((tipos) => {
        this.tiposHabitacion = tipos;
      });
  }

  private loadDetalles(): void {
    if (!this.codigoTarifa || !this.selectedCategoria) {
      this.detalles = [];
      return;
    }

    this.isLoadingDetalles = true;
    this.detalleService
      .getByCategoria(this.codigoTarifa, this.selectedCategoria)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo cargar el detalle de hospedaje.', error);
          return of([]);
        }),
        finalize(() => {
          this.isLoadingDetalles = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((detalles) => {
        this.detalles = detalles;
      });
  }

  private bindRoomTypeSelection(): void {
    this.detalleForm.controls.tipoHabitacion.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((tipo) => {
      const roomType = this.tiposHabitacion.find((item) => item.CR02_TipHabita === tipo);
      this.detalleForm.controls.descripcion.setValue(roomType?.CR02_NomHabita || '', { emitEvent: false });
    });
  }

  private buildPayload(): DetalleTarifaRequest {
    const raw = this.detalleForm.getRawValue();
    return {
      proceso: this.isEditMode ? 2 : 1,
      codigo: this.codigoTarifa,
      categoriaHabitacion: this.selectedCategoria,
      tipoHabitacion: raw.tipoHabitacion,
      descripcion: raw.descripcion,
      precio: this.toNumber(raw.precio),
      impuestoIncluido: raw.impuestoIncluido ? 1 : 0,
      centroCosto: raw.centroCosto,
      operador: raw.operador || this.getOperador(),
      respuesta: ''
    };
  }

  private defaultFormValue(): ReturnType<FormGroup<DetalleForm>['getRawValue']> {
    return {
      tipoHabitacion: '',
      descripcion: '',
      precio: 0,
      impuestoIncluido: true,
      centroCosto: '',
      operador: this.getOperador()
    };
  }

  private resolveTarifa(response: TarifaReservaResponse | TarifaReservaResponse[]): TarifaReservaResponse | null {
    return Array.isArray(response) ? response[0] ?? null : response;
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario || 'CHARLY';
  }

  private toNumber(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private handleError(message: string, error: unknown): void {
    console.error(message, error);
    this.errorMessage = message;
    this.toastService.addToast({ title: 'Error', message, type: 'error' });
  }
}
