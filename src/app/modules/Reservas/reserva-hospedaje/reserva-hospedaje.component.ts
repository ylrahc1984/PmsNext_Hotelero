import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, finalize, firstValueFrom, forkJoin, map, merge, of, switchMap } from 'rxjs';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { normalizePmsDateDDMMYYYY, parsePmsDate, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { TipoCambioService } from 'src/app/demo/administracion/tipo-cambio/tipo-cambio.service';
import { WalkInAgenciaOption, WalkInAgenciaPage, WalkInOption, WalkInTarifaOption } from 'src/app/modules/front-desk/walk-in/models/walk-in.model';
import { WalkInService } from 'src/app/modules/front-desk/walk-in/services/walk-in.service';
import { MealPlan } from 'src/app/modules/front-desk/settings/meal-plans/models/meal-plan.model';
import { MealPlansService } from 'src/app/modules/front-desk/settings/meal-plans/services/meal-plans.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { environment } from 'src/environments/environment';
import { DetalleTarifaResponse } from '../detalle-tarifa/models/detalle-tarifa.model';
import { DetalleTarifaService } from '../detalle-tarifa/services/detalle-tarifa.service';
import {
  ReservaHabitacionDetalle,
  ReservaHabitacionItem,
  ReservaInclusionItem,
  ReservaServicioItem
} from '../interfaces/reserva-habitacion.interface';
import { ReservaHabitacionMapper } from '../services/reserva-habitacion.mapper';
import {
  ReservaDisponibilidadCategoriaFecha,
  ReservaHabitacionService,
  ReservaTarifaAlimento
} from '../services/reserva-habitacion.service';

interface ReservaHeaderForm {
  codReserva      : FormControl<string>;
  codAgencia      : FormControl<string>;
  codTarifa       : FormControl<string>;
  codPlan         : FormControl<string>;
  fecIngreso      : FormControl<string>;
  fecSalida       : FormControl<string>;
  fecCreacion     : FormControl<string>;
  fecConfirma     : FormControl<string>;
  fecPrepago      : FormControl<string>;
  fecAnulada      : FormControl<string>;
  totNoches       : FormControl<number>;
  totDias         : FormControl<number>;
  descripcion     : FormControl<string>;
  tCambio         : FormControl<number>;
  folio           : FormControl<string>;
  estado          : FormControl<string>;
  moneda          : FormControl<string>;
  totalRsv        : FormControl<number>;
  observaciones   : FormControl<string>;
  procesa         : FormControl<string>;
  directo         : FormControl<boolean>;
  operador        : FormControl<string>;
  habitaciones    : FormArray<FormGroup<HabitacionForm>>;
  inclusiones     : FormArray<FormGroup<InclusionForm>>;
  servicios       : FormArray<FormGroup<ServicioForm>>;
}

interface HabitacionForm {
  categoria           : FormControl<string>;
  tipo                : FormControl<string>;
  cantidad            : FormControl<number>;
  pax                 : FormControl<number>;
  precio              : FormControl<number>;
  cantidadNinos       : FormControl<number>;
  precioNino          : FormControl<number>;
  total               : FormControl<number>;
}

interface InclusionForm {
  codServ     : FormControl<string>;
  desServ     : FormControl<string>;
  tipPax      : FormControl<string>;
  precio      : FormControl<number>;
  cantidad    : FormControl<number>;
  totServ     : FormControl<number>;
  cCosto      : FormControl<string>;
}

interface ServicioForm {
  codSrv          : FormControl<string>;
  descripcion     : FormControl<string>;
  cantidad        : FormControl<number>;
  precio          : FormControl<number>;
  impuesto        : FormControl<number>;
  tipPax          : FormControl<string>;
  total           : FormControl<number>;
}

interface CategoriaHabitacionApiDto {
  CR01_CodCate      ?: string;
  CR01_Categoria    ?: string;
  CR01_NumHabita    ?: number;
  CR01_Orden        ?: number;
  CR01_Operador     ?: string;
  CR01_ESTADO       ?: number | boolean;
}

interface CategoriaHabitacionOption {
  codigo            : string;
  descripcion       : string;
  habitaciones      : number;
  orden             : number;
  operador          : string;
  activo            : boolean;
}

interface TipoHabitacionApiDto {
  CR02_TipHabita      ?: string;
  CR02_CatHabita      ?: string;
  CR02_NomHabita      ?: string;
  CR02_NumHabita      ?: number;
  CR02_NumPax         ?: number;
  CR02_Activo         ?: number | boolean;
  CR02_Orden          ?: number;
  CR02_Operador       ?: string;
}

interface TipoHabitacionOption {
  codigo            : string;
  categoria         : string;
  descripcion       : string;
  habitaciones      : number;
  pax               : number;
  orden             : number;
  operador          : string;
  activo            : boolean;
}

interface ReservaHospedajeDraft {
  savedAt           : string;
  reserva           : Partial<ReturnType<FormGroup<ReservaHeaderForm>['getRawValue']>>;
  habitacion        : Partial<ReturnType<FormGroup<HabitacionForm>['getRawValue']>>;
  inclusion         : Partial<ReturnType<FormGroup<InclusionForm>['getRawValue']>>;
  servicio          : Partial<ReturnType<FormGroup<ServicioForm>['getRawValue']>>;
  agenciaSearch     : string;
  tarifaSearch      : string;
}

interface ReservationInventorySnapshot {
  fecIngreso        : string;
  fecSalida         : string;
  categoryRooms     : Record<string, number>;
}

interface AvailabilityValidationSegment {
  categoria         : string;
  fechaIni          : string;
  fechaSal          : string;
  cantHab           : number;
}

@Component({
  selector: 'app-reserva-hospedaje',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './reserva-hospedaje.component.html',
  styleUrls: ['./reserva-hospedaje.component.scss']
})
export class ReservaHospedajeComponent implements OnInit {
  private readonly fb                          = inject(NonNullableFormBuilder);
  private readonly http                        = inject(HttpClient);
  private readonly service                     = inject(ReservaHabitacionService);
  private readonly catalogService              = inject(WalkInService);
  private readonly mealPlansService            = inject(MealPlansService);
  private readonly toast                       = inject(ToastService);
  private readonly auth                        = inject(AuthService);
  private readonly operationalDateService      = inject(OperationalDateService);
  private readonly tipoCambioService           = inject(TipoCambioService);
  private readonly detalleTarifaService        = inject(DetalleTarifaService);
  private readonly router                      = inject(Router);
  private readonly route                       = inject(ActivatedRoute);
  private readonly destroyRef                  = inject(DestroyRef);
  private readonly apiBaseUrl                  = (environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '');
  private readonly categoriaHabitacionUrl      = `${this.apiBaseUrl}/categoriahabitacion`;
  private readonly draftStorageKey             = 'pmsnext.reserva-hospedaje.draft.v1';

  readonly estados = ['ABI', 'WLI', 'CCR', 'CHK', 'WLT', 'ANU'];

  readonly saving                             = signal(false);
  readonly showPlanModal                      = signal(false);
  readonly showServiceModal                   = signal(false);
  readonly planExpanded                       = signal(false);
  readonly servicesExpanded                   = signal(false);
  readonly editingRoomIndex                   = signal<number | null>(null);
  readonly editingPlanIndex                   = signal<number | null>(null);
  readonly editingServiceIndex                = signal<number | null>(null);
  readonly isEditMode                         = signal(false);
  readonly loadingDetalle                     = signal(false);
  readonly detailError                        = signal('');
  readonly checkingRoomAvailability           = signal(false);
  readonly exchangeRateLoading                = signal(false);
  readonly exchangeRateError                  = signal('');
  readonly roomRateLoading                    = signal(false);
  readonly roomRateError                      = signal('');
  readonly reservationLocked                  = signal(false);
  readonly operationalDate                    = this.operationalDateService.operationalDate;
  readonly agenciaSearchControl               = this.fb.control('02051 - DIRECTOS');
  readonly tarifaSearchControl                = this.fb.control('');
  readonly agencyModalSearchControl           = this.fb.control('');
  readonly tarifaModalSearchControl           = this.fb.control('');

  readonly reservaForm: FormGroup<ReservaHeaderForm> = this.fb.group({
    codReserva            : this.fb.control('AUTO'),
    codAgencia            : this.fb.control('02051', { validators: [Validators.required] }),
    codTarifa             : this.fb.control('', { validators: [Validators.required] }),
    codPlan               : this.fb.control('', { validators: [Validators.required] }),
    fecIngreso            : this.fb.control(this.todayAsInputDate(), { validators: [Validators.required] }),
    fecSalida             : this.fb.control(this.addDaysAsInputDate(1), { validators: [Validators.required] }),
    fecCreacion           : this.fb.control(this.todayAsInputDate()),
    fecConfirma           : this.fb.control(''),
    fecPrepago            : this.fb.control(''),
    fecAnulada            : this.fb.control(''),
    totNoches             : this.fb.control(1),
    totDias               : this.fb.control(2),
    descripcion           : this.fb.control(''),
    tCambio               : this.fb.control(0, { validators: [Validators.required, Validators.min(0.01)] }),
    folio                 : this.fb.control(''),
    estado                : this.fb.control('ABI'),
    moneda                : this.fb.control('', { validators: [Validators.required] }),
    totalRsv              : this.fb.control(0),
    observaciones         : this.fb.control(''),
    procesa               : this.fb.control('WEB'),
    directo               : this.fb.control(false),
    operador              : this.fb.control(this.auth.getCurrentUser()?.usuario ?? 'admin'),
    habitaciones          : this.fb.array<FormGroup<HabitacionForm>>([]),
    inclusiones           : this.fb.array<FormGroup<InclusionForm>>([]),
    servicios             : this.fb.array<FormGroup<ServicioForm>>([])
  }, { validators: [this.reservationDatesValidator()] });

  readonly habitacionForm: FormGroup<HabitacionForm> = this.createHabitacionGroup();
  readonly inclusionForm: FormGroup<InclusionForm> = this.createInclusionGroup();
  readonly servicioForm: FormGroup<ServicioForm> = this.createServicioGroup();

  planes                  : WalkInOption[] = [];
  roomCategories          : CategoriaHabitacionOption[] = [];
  roomTypes               : TipoHabitacionOption[] = [];
  agenciaSuggestions      : WalkInAgenciaOption[] = [];
  tarifaSuggestions       : WalkInTarifaOption[] = [];
  agencyModalAgencies     : WalkInAgenciaOption[] = [];
  tarifaModalTarifas      : WalkInTarifaOption[] = [];
  private allTarifas      : WalkInTarifaOption[] = [];

  isCatalogLoading                    = false;
  isRoomTypesLoading                  = false;
  agenciaSearchOpen                   = false;
  tarifaSearchOpen                    = false;
  showAgencyModal                     = false;
  showTarifaModal                     = false;
  isMealPlanLoading                   = false;
  mealPlanError                       = '';
  agencyModalLoading                  = false;
  agencyModalError                    = '';
  agencyModalPage                     = 1;
  agencyModalPageSize                 = 10;
  agencyModalTotalRecords             = 0;
  agencyModalTotalPages               = 0;
  tarifaModalLoading                  = false;
  tarifaModalError                    = '';
  tarifaModalPage                     = 1;
  tarifaModalPageSize                 = 10;
  tarifaModalTotalRecords             = 0;
  tarifaModalTotalPages               = 0;
  private mealPlanDetails             : ReservaTarifaAlimento[] = [];
  private mealPlanRequestKey          = '';
  private mealPlanRequestId           = 0;
  private draftRestorePending         = true;
  private editCodReserva              = '';
  private originalInventorySnapshot   : ReservationInventorySnapshot | null = null;
  private originalServerFingerprint   = '';
  private originalTarifa              = '';
  private originalMoneda              = '';
  private exchangeRateRequestId       = 0;
  private roomRateRequestId           = 0;
  private resolvedRoomRateKey         = '';

  ngOnInit(): void {
    const codReserva = this.route.snapshot.paramMap.get('codReserva')?.trim() ?? '';
    this.editCodReserva = codReserva;
    this.isEditMode.set(!!codReserva);
    if (codReserva) {
      this.draftRestorePending = false;
      this.loadReservaForEdit(codReserva);
    }

    this.loadCatalogs();
    this.loadOperationalDate();
    this.bindCatalogSearch();
    if (!this.isEditMode()) {
      // Una reserva nueva siempre debe comenzar limpia, incluso si existe un
      // borrador creado por una versión anterior de esta pantalla.
      this.clearDraft();
    }
    this.recalculateStay();
    this.reservaForm.controls.fecIngreso.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recalculateStay());
    this.reservaForm.controls.fecSalida.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recalculateStay());

    this.habitacionForm.controls.categoria.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((categoria) => this.loadRoomTypesForCategory(categoria));

    this.habitacionForm.controls.tipo.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.refreshHabitacionDraftRate());

    this.habitacionForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.updateHabitacionDraftPax();
      this.updateHabitacionDraftTotal();
      this.recalculateMealPlanInclusions();
    });
    this.inclusionForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.updateInclusionDraftTotal());
    this.servicioForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.updateServicioDraftTotal());
  }

  get habitaciones(): FormArray<FormGroup<HabitacionForm>> {
    return this.reservaForm.controls.habitaciones;
  }

  get inclusiones(): FormArray<FormGroup<InclusionForm>> {
    return this.reservaForm.controls.inclusiones;
  }

  get servicios(): FormArray<FormGroup<ServicioForm>> {
    return this.reservaForm.controls.servicios;
  }

  async agregarHabitacion(): Promise<void> {
    if (this.checkingRoomAvailability()) {
      return;
    }

    if (this.habitacionForm.invalid) {
      this.habitacionForm.markAllAsTouched();
      return;
    }

    if (!(await this.ensureOperationalDateForValidation()) || !this.validateStayDatesForRoomAvailability()) {
      return;
    }

    if (!(await this.ensureHabitacionDraftRate())) {
      return;
    }

    this.updateHabitacionDraftPax();
    this.updateHabitacionDraftTotal();
    const index = this.editingRoomIndex();
    const roomDraft = this.habitacionForm.getRawValue();
    const requestedRooms = this.getRequestedCategoryRooms(roomDraft.categoria, roomDraft.cantidad, index);

    this.checkingRoomAvailability.set(true);
    try {
      const availability = await firstValueFrom(
        this.service.consultarDisponibilidadCategoria({
          proceso       : 1,
          fechaIni      : this.formatDate(this.parseDateValue(this.reservaForm.controls.fecIngreso.value)!),
          fechaSal      : this.formatDate(this.parseDateValue(this.reservaForm.controls.fecSalida.value)!),
          categoria     : roomDraft.categoria.trim(),
          cantHab       : requestedRooms
        })
      );

      if (!availability.success) {
        await this.showAvailabilityCheckError(availability.message);
        return;
      }

      if (availability.totalFechasInsuficientes > 0 || availability.data.length > 0) {
        await this.showInsufficientAvailabilityAlert(roomDraft.categoria, requestedRooms, availability.data);
        return;
      }
    } catch (error) {
      console.error('No se pudo validar la disponibilidad de la categoría.', error);
      await this.showAvailabilityCheckError();
      return;
    } finally {
      this.checkingRoomAvailability.set(false);
    }

    const nextGroup = this.createHabitacionGroup(roomDraft);

    if (index === null) {
      this.habitaciones.push(nextGroup);
    } else {
      this.habitaciones.setControl(index, nextGroup);
      this.editingRoomIndex.set(null);
    }

    this.habitacionForm.reset(this.defaultHabitacion());
    this.refreshMealPlanForCurrentSelection();
  }

  private validateStayDatesForRoomAvailability(): boolean {
    const ingreso = this.parseDateValue(this.reservaForm.controls.fecIngreso.value);
    const salida = this.parseDateValue(this.reservaForm.controls.fecSalida.value);

    if (ingreso && salida && salida > ingreso && !this.reservaForm.hasError('entryBeforeOperationalDate')) {
      return true;
    }

    this.reservaForm.controls.fecIngreso.markAsTouched();
    this.reservaForm.controls.fecSalida.markAsTouched();
    this.toast.warning(
      'Revise las fechas de ingreso y salida antes de consultar la disponibilidad.',
      5000,
      'Fechas de reserva'
    );
    return false;
  }

  private getRequestedCategoryRooms(category: string, draftQuantity: number, editingIndex: number | null): number {
    const normalizedCategory = category.trim().toUpperCase();
    const roomsAlreadyAdded = this.habitaciones.controls.reduce((total, room, index) => {
      if (index === editingIndex || room.controls.categoria.value.trim().toUpperCase() !== normalizedCategory) {
        return total;
      }

      return total + Math.max(0, Number(room.controls.cantidad.value) || 0);
    }, 0);

    return roomsAlreadyAdded + Math.max(1, Number(draftQuantity) || 1);
  }

  private async showInsufficientAvailabilityAlert(
    category: string,
    requestedRooms: number,
    unavailableDates: ReservaDisponibilidadCategoriaFecha[]
  ): Promise<void> {
    const categoryLabel = this.escapeHtml(this.getCategoriaLabel(category));
    const dates = unavailableDates
      .map((item) => {
        const available = Math.max(0, Number(item.disponibles) || 0);
        const availabilityLabel = `${available} habitación${available === 1 ? '' : 'es'} disponible${available === 1 ? '' : 's'}`;
        return `
          <li style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid #e5e7eb;">
            <strong style="color:#1f2937;">${this.escapeHtml(this.formatAvailabilityDate(item.fecha))}</strong>
            <span style="color:${available === 0 ? '#b91c1c' : '#92400e'};font-weight:600;">${availabilityLabel}</span>
          </li>`;
      })
      .join('');

    await Swal.fire({
      title: 'Disponibilidad insuficiente',
      html: `
        <div style="text-align:left;color:#4b5563;line-height:1.5;">
          <p style="margin:0 0 14px;">La solicitud de <strong>${requestedRooms} habitación${requestedRooms === 1 ? '' : 'es'}</strong> de la categoría <strong>${categoryLabel}</strong> supera la disponibilidad en una o más fechas del período seleccionado.</p>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin-bottom:14px;">
            <strong style="display:block;color:#92400e;margin-bottom:2px;">Advertencia de disponibilidad</strong>
            <span style="font-size:13px;">La disponibilidad es menor que la cantidad solicitada.</span>
          </div>
          <ul style="list-style:none;padding:0;margin:0;">${dates}</ul>
          <p style="font-size:13px;margin:16px 0 0;color:#6b7280;">La habitación no se agregó. Ajuste la cantidad, categoría o fechas para continuar.</p>
        </div>`,
      icon: 'warning',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#b7791f',
      width: 620
    });
  }

  private async showAvailabilityCheckError(message = ''): Promise<void> {
    await Swal.fire({
      title: 'No fue posible verificar la disponibilidad',
      text: message.trim() || 'La habitación no se agregó porque no pudimos confirmar la disponibilidad en este momento. Intente nuevamente.',
      icon: 'error',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#3157a4'
    });
  }

  private formatAvailabilityDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value) || value;
  }

  displayDate(value: string | null | undefined): string {
    return normalizePmsDateDDMMYYYY(value) || 'N/D';
  }

  editarHabitacion(index: number): void {
    this.editingRoomIndex.set(index);
    const room = this.habitaciones.at(index).getRawValue();
    this.habitacionForm.reset(room, { emitEvent: false });
    this.resolvedRoomRateKey = this.buildRoomRateKey(
      this.reservaForm.controls.codTarifa.value,
      room.categoria,
      room.tipo
    );
    this.roomRateError.set('');
    this.loadRoomTypesForCategory(room.categoria, true);
  }

  eliminarHabitacion(index: number): void {
    this.habitaciones.removeAt(index);
    this.refreshMealPlanForCurrentSelection();
  }

  abrirPlanModal(index: number | null = null): void {
    this.editingPlanIndex.set(index);
    const selectedInclusion = index === null || index >= this.inclusiones.length ? this.defaultInclusion() : this.inclusiones.at(index).getRawValue();
    this.inclusionForm.reset(selectedInclusion);
    this.showPlanModal.set(true);
  }

  eliminarInclusion(index: number): void {
    this.inclusiones.removeAt(index);
    this.syncTotal();
  }

  cerrarPlanModal(): void {
    this.showPlanModal.set(false);
    this.editingPlanIndex.set(null);
  }

  abrirServicioModal(index: number | null = null): void {
    this.editingServiceIndex.set(index);
    this.servicioForm.reset(index === null ? this.defaultServicio() : this.servicios.at(index).getRawValue());
    this.showServiceModal.set(true);
  }

  guardarServicio(): void {
    this.updateServicioDraftTotal();
    const index = this.editingServiceIndex();
    const group = this.createServicioGroup(this.servicioForm.getRawValue());

    if (index === null) {
      this.servicios.push(group);
    } else {
      this.servicios.setControl(index, group);
    }

    this.cerrarServicioModal();
    this.syncTotal();
  }

  eliminarServicio(index: number): void {
    this.servicios.removeAt(index);
    this.syncTotal();
  }

  cerrarServicioModal(): void {
    this.showServiceModal.set(false);
    this.editingServiceIndex.set(null);
  }

  togglePlan(): void {
    this.planExpanded.update((expanded) => !expanded);
  }

  toggleServices(): void {
    this.servicesExpanded.update((expanded) => !expanded);
  }

  openAgenciaSuggestions(): void {
    this.catalogService
      .searchAgencias('')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.agenciaSuggestions = items;
        this.agenciaSearchOpen = items.length > 0;
      });
  }

  openTarifaSuggestions(): void {
    this.catalogService
      .searchTarifas('', true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.tarifaSuggestions = items;
        this.tarifaSearchOpen = items.length > 0;
      });
  }

  selectAgencia(agencia: WalkInAgenciaOption): void {
    this.reservaForm.controls.codAgencia.setValue(agencia.codigo);
    this.agenciaSearchControl.setValue(this.buildAgenciaLabel(agencia), { emitEvent: false });
    this.agenciaSuggestions = [];
    this.agenciaSearchOpen = false;
    this.showAgencyModal = false;
  }

  clearAgencia(): void {
    this.reservaForm.controls.codAgencia.setValue('');
    this.agenciaSearchControl.setValue('');
    this.agenciaSuggestions = [];
    this.agenciaSearchOpen = false;
    this.openAgenciaSuggestions();
  }

  selectTarifa(tarifa: WalkInTarifaOption): void {
    this.reservaForm.patchValue(
      {
        codTarifa: tarifa.codigo,
        moneda: tarifa.moneda || this.reservaForm.controls.moneda.value
      },
      { emitEvent: false }
    );
    this.tarifaSearchControl.setValue(this.buildTarifaLabel(tarifa), { emitEvent: false });
    this.tarifaSuggestions = [];
    this.tarifaSearchOpen = false;
    this.showTarifaModal = false;
    void this.loadExchangeRate(tarifa.moneda);
    this.refreshMealPlanForCurrentSelection(true);
    void this.refreshAllRoomRatesForSelectedTarifa();
  }

  onPlanChange(codPlan: string): void {
    const plan = this.planes.find((item) => item.codigo === codPlan);
    this.mealPlanRequestId++;
    this.mealPlanDetails = [];
    this.mealPlanRequestKey = '';
    this.mealPlanError = '';
    this.isMealPlanLoading = false;
    this.inclusiones.clear();
    this.inclusionForm.reset(this.defaultInclusion(), { emitEvent: false });
    this.syncTotal();

    if (!plan) {
      return;
    }

    if (this.isNoMealPlan(plan.codigo)) {
      return;
    }

    this.refreshMealPlanForCurrentSelection(true);
  }

  isNoMealPlanSelected(): boolean {
    return this.isNoMealPlan(this.reservaForm.controls.codPlan.value);
  }

  selectedPlanDescription(): string {
    const codPlan = this.reservaForm.controls.codPlan.value;
    return this.planes.find((item) => item.codigo === codPlan)?.descripcion || 'Sin plan de alimentos';
  }

  openAgencyModal(): void {
    this.showAgencyModal = true;
    this.agenciaSearchOpen = false;
    this.agencyModalSearchControl.setValue(this.getCurrentAgencySearchTerm(), { emitEvent: false });
    this.loadAgencyModalPage(1);
  }

  closeAgencyModal(): void {
    this.showAgencyModal = false;
    this.agencyModalError = '';
  }

  loadAgencyModalPage(page: number): void {
    const normalizedPage = Math.max(page, 1);
    const searchTerm = this.agencyModalSearchControl.value.trim();
    const pageSize = searchTerm.length >= 2 ? 50 : 10;
    this.agencyModalLoading = true;
    this.agencyModalError = '';

    const request =
      searchTerm.length >= 2
        ? this.catalogService.buscarAgenciasPorNombre(searchTerm, normalizedPage, pageSize)
        : this.catalogService.getAgenciasPaginadas(normalizedPage, pageSize);

    request
      .pipe(
        finalize(() => {
          this.agencyModalLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: WalkInAgenciaPage) => {
          this.agencyModalAgencies = response.datos;
          this.agencyModalPage = response.paginaActual || normalizedPage;
          this.agencyModalPageSize = response.tamanoPagina || pageSize;
          this.agencyModalTotalRecords = response.totalRegistros || response.datos.length;
          this.agencyModalTotalPages = response.totalPaginas || (response.datos.length ? 1 : 0);
        },
        error: () => {
          this.agencyModalAgencies = [];
          this.agencyModalTotalRecords = 0;
          this.agencyModalTotalPages = 0;
          this.agencyModalError = 'No se pudo cargar la lista de agencias.';
        }
      });
  }

  goToAgencyModalPage(page: number): void {
    if (this.agencyModalLoading || page < 1 || (this.agencyModalTotalPages > 0 && page > this.agencyModalTotalPages)) {
      return;
    }

    this.loadAgencyModalPage(page);
  }

  openTarifaModal(): void {
    this.showTarifaModal = true;
    this.tarifaSearchOpen = false;
    this.tarifaModalSearchControl.setValue(this.getCurrentTarifaSearchTerm(), { emitEvent: false });
    this.loadTarifasModal();
  }

  closeTarifaModal(): void {
    this.showTarifaModal = false;
    this.tarifaModalError = '';
  }

  loadTarifasModal(): void {
    this.tarifaModalLoading = true;
    this.tarifaModalError = '';

    this.catalogService
      .getTarifasReserva()
      .pipe(
        finalize(() => {
          this.tarifaModalLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          this.allTarifas = items;
          this.applyTarifaModalFilter(1);
        },
        error: () => {
          this.allTarifas = [];
          this.tarifaModalTarifas = [];
          this.tarifaModalTotalRecords = 0;
          this.tarifaModalTotalPages = 0;
          this.tarifaModalError = 'No se pudo cargar la lista de tarifas.';
        }
      });
  }

  goToTarifaModalPage(page: number): void {
    if (this.tarifaModalLoading || page < 1 || (this.tarifaModalTotalPages > 0 && page > this.tarifaModalTotalPages)) {
      return;
    }

    this.applyTarifaModalFilter(page);
  }

  getAgencyModalSearchLabel(): string {
    const term = this.agencyModalSearchControl.value.trim();
    return term ? `Resultados para "${term}"` : 'Agencias registradas';
  }

  getTarifaModalSearchLabel(): string {
    const term = this.tarifaModalSearchControl.value.trim();
    return term ? `Resultados para "${term}"` : 'Tarifas registradas';
  }

  pageTitle(): string {
    return this.isEditMode() ? `Editar Reserva ${this.reservaForm.controls.codReserva.value || this.editCodReserva}` : 'Nueva Reserva de Hospedaje';
  }

  breadcrumbTitle(): string {
    return this.isEditMode() ? 'Editar reserva' : 'Nueva reserva';
  }

  submitButtonText(): string {
    return this.isEditMode() ? 'Actualizar reserva' : 'Confirmar reserva';
  }

  clearButtonText(): string {
    return this.isEditMode() ? 'Recargar' : 'Limpiar';
  }

  limpiarFormulario(): void {
    if (this.isEditMode()) {
      this.loadReservaForEdit(this.editCodReserva);
      return;
    }

    this.clearDraft();
    this.habitaciones.clear();
    this.inclusiones.clear();
    this.servicios.clear();
    this.reservaForm.reset({
      codReserva        : 'AUTO',
      codAgencia        : '02051',
      codTarifa         : '',
      codPlan           : '',
      ...this.defaultReservationDates(),
      descripcion       : '',
      tCambio           : 0,
      folio             : '',
      estado            : 'ABI',
      moneda            : '',
      totalRsv          : 0,
      observaciones     : '',
      procesa           : '0',
      directo           : false,
      operador          : this.auth.getCurrentUser()?.usuario ?? 'admin',
      habitaciones      : [],
      inclusiones       : [],
      servicios         : []
    });
    this.habitacionForm.reset(this.defaultHabitacion());
    this.agenciaSearchControl.setValue('02051 - DIRECTOS', { emitEvent: false });
    this.tarifaSearchControl.setValue('', { emitEvent: false });
    this.mealPlanDetails = [];
    this.mealPlanRequestKey = '';
    this.mealPlanError = '';
    this.exchangeRateError.set('');
    this.exchangeRateLoading.set(false);
    this.exchangeRateRequestId++;
    this.roomRateError.set('');
    this.roomRateLoading.set(false);
    this.roomRateRequestId++;
    this.resolvedRoomRateKey = '';
    this.inclusionForm.reset(this.defaultInclusion());
    this.servicioForm.reset(this.defaultServicio());
    this.editingRoomIndex.set(null);
    this.editingPlanIndex.set(null);
    this.editingServiceIndex.set(null);
    this.showPlanModal.set(false);
    this.showServiceModal.set(false);
    this.showAgencyModal = false;
    this.showTarifaModal = false;
    this.agenciaSuggestions = [];
    this.tarifaSuggestions = [];
    this.agenciaSearchOpen = false;
    this.tarifaSearchOpen = false;
    this.applyPlanDefault();
    this.recalculateStay();
    this.syncTotal();
    this.reservaForm.markAsPristine();
    this.reservaForm.markAsUntouched();
    this.habitacionForm.markAsPristine();
    this.habitacionForm.markAsUntouched();
  }

  private loadReservaForEdit(codReserva: string): void {
    if (!codReserva) {
      return;
    }

    this.loadingDetalle.set(true);
    this.detailError.set('');

    this.service
      .getReservaDetalle(codReserva)
      .pipe(
        finalize(() => this.loadingDetalle.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (detalle) => this.applyReservaDetalle(detalle),
        error: (error) => {
          console.error('No se pudo cargar el detalle de la reserva.', error);
          this.detailError.set('No se pudo cargar el detalle de la reserva.');
          this.toast.error('No se pudo cargar el detalle de la reserva.', 5500, 'Reserva');
        }
      });
  }

  private applyReservaDetalle(detalle: ReservaHabitacionDetalle): void {
    const formValue = ReservaHabitacionMapper.fromDetalle(detalle);
    this.editCodReserva = formValue.codReserva || this.editCodReserva;
    this.originalInventorySnapshot = this.buildInventorySnapshot(formValue);
    this.originalServerFingerprint = this.buildServerFingerprint(detalle);
    this.originalTarifa = formValue.codTarifa.trim().toUpperCase();
    this.originalMoneda = formValue.moneda.trim().toUpperCase();
    this.reservationLocked.set(this.isLockedReservationState(formValue.estado));

    this.habitaciones.clear();
    this.inclusiones.clear();
    this.servicios.clear();
    this.reservaForm.reset(formValue, { emitEvent: false });

    for (const habitacion of formValue.habitaciones) {
      this.habitaciones.push(this.createHabitacionGroup(habitacion));
    }

    for (const inclusion of formValue.inclusiones) {
      this.inclusiones.push(this.createInclusionGroup(inclusion));
    }

    for (const servicio of formValue.servicios) {
      this.servicios.push(this.createServicioGroup(servicio));
    }

    this.habitacionForm.reset(this.defaultHabitacion(), { emitEvent: false });
    this.inclusionForm.reset(this.defaultInclusion(), { emitEvent: false });
    this.servicioForm.reset(this.defaultServicio(), { emitEvent: false });
    this.agenciaSearchControl.setValue(this.buildDetalleLabel(formValue.codAgencia, detalle.nomAgencia), { emitEvent: false });
    this.tarifaSearchControl.setValue(this.buildDetalleLabel(formValue.codTarifa, detalle.nomTarifa), { emitEvent: false });
    this.mealPlanDetails = [];
    this.mealPlanRequestKey = '';
    this.mealPlanError = '';
    this.recalculateStay();
    this.refreshMealPlanForCurrentSelection(true);
    this.syncTotal();
    this.reservaForm.updateValueAndValidity({ emitEvent: false });
  }

  private buildDetalleLabel(codigo: string, descripcion: string | undefined): string {
    return [codigo, String(descripcion ?? '').trim()].filter(Boolean).join(' - ');
  }

  async guardarBorrador(): Promise<void> {
    if (this.isEditMode()) {
      return;
    }

    this.syncTotal();

    const result = await Swal.fire({
      title: 'Guardar borrador',
      text: '¿Desea guardar el borrador de la reserva actual?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'No, volver',
      confirmButtonColor: '#0d6efd'
    });

    if (!result.isConfirmed) {
      return;
    }

    this.persistDraft();
    await Swal.fire({
      title: 'Borrador guardado',
      text: 'La reserva quedó guardada localmente como borrador.',
      icon: 'success',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#198754'
    });
  }

  async confirmarReserva(): Promise<void> {
    if (!(await this.ensureOperationalDateForValidation())) {
      return;
    }

    if (!(await this.refreshExchangeRateForCriticalOperation())) {
      return;
    }

    if (!this.canConfirmReserva()) {
      return;
    }

    if (!(await this.ensureEditReservationIsCurrent())) {
      return;
    }

    this.syncTotal();

    const result = await Swal.fire({
      title: this.isEditMode() ? 'Actualizar reserva' : 'Confirmar reserva',
      html: this.buildConfirmReservationHtml(),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: this.isEditMode() ? 'Sí, actualizar reserva' : 'Sí, confirmar y guardar',
      cancelButtonText: 'No, revisar',
      confirmButtonColor: '#198754',
      width: 720
    });

    if (!result.isConfirmed) {
      return;
    }

    await this.guardarReserva();
  }

  ajustarHabitacionDraft(control: 'cantidad' | 'cantidadNinos', delta: number): void {
    const formControl = this.habitacionForm.controls[control];
    const min = control === 'cantidad' ? 1 : 0;
    formControl.setValue(Math.max(min, formControl.value + delta));
    this.updateHabitacionDraftTotal();
  }

  ajustarServicioCantidad(index: number, delta: number): void {
    const group = this.servicios.at(index);
    group.controls.cantidad.setValue(Math.max(1, group.controls.cantidad.value + delta));
    group.controls.total.setValue(group.controls.cantidad.value * group.controls.precio.value + group.controls.impuesto.value, { emitEvent: false });
    this.syncTotal();
  }

  private async guardarReserva(): Promise<void> {
    if (this.saving()) {
      return;
    }

    if (!(await this.ensureOperationalDateForValidation())) {
      return;
    }

    if (!(await this.refreshExchangeRateForCriticalOperation())) {
      return;
    }

    if (!this.canConfirmReserva()) {
      return;
    }

    if (!(await this.ensureEditReservationIsCurrent())) {
      return;
    }

    if (!(await this.revalidateReservationAvailability())) {
      return;
    }

    this.syncTotal();
    const payload = ReservaHabitacionMapper.toRequest(
      this.reservaForm.getRawValue(),
      this.totalReserva(),
      0,
      (categoria, tipo) => this.getTipoHabitacionPax(categoria, tipo)
    );
    this.saving.set(true);

    void Swal.fire({
      title: this.isEditMode() ? 'Actualizando reserva' : 'Confirmando reserva',
      text: this.isEditMode() ? 'Enviando los cambios al servidor...' : 'Enviando la reserva al servidor...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const request$ = this.isEditMode() ? this.service.updateReserva(this.editCodReserva, payload) : this.service.createReserva(payload);
      const response = await firstValueFrom(
        request$.pipe(
          finalize(() => {
            this.saving.set(false);
            Swal.close();
          })
        )
      );

      if (response.ok === false) {
        await Swal.fire({
          title: this.isEditMode() ? 'No se pudo actualizar la reserva' : 'No se pudo confirmar la reserva',
          text: response.respuesta || response.mensaje || 'El endpoint no confirmó la reserva.',
          icon: 'error',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#dc3545'
        });
        return;
      }

      if (!this.isEditMode()) {
        this.clearDraft();
      }
      await Swal.fire({
        title: this.isEditMode() ? 'Reserva actualizada' : 'Reserva confirmada',
        html: this.buildReservationResponseHtml(response),
        icon: 'success',
        confirmButtonText: 'Ir a consulta de reservas',
        confirmButtonColor: '#198754'
      });
      await this.router.navigate(['/reservas/consulta-reservas']);
    } catch (error) {
      console.error('No se pudo guardar la reserva.', error);
      this.saving.set(false);
      Swal.close();
      await Swal.fire({
        title: this.isEditMode() ? 'Error al actualizar la reserva' : 'Error al confirmar la reserva',
        text: this.getReservaErrorMessage(error),
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#dc3545'
      });
    }
  }

  private canConfirmReserva(): boolean {
    if (this.isEditMode() && this.reservationLocked()) {
      this.toast.warning(
        `La reserva se encuentra en estado ${this.reservaForm.controls.estado.value} y no admite modificaciones.`,
        5500,
        'Reserva protegida'
      );
      return false;
    }

    if (this.reservaForm.hasError('entryBeforeOperationalDate')) {
      this.reservaForm.controls.fecIngreso.markAsTouched();
      this.toast.warning(
        `La fecha de ingreso no puede ser menor a la fecha operativa ${this.operationalDate()}.`,
        5500,
        'Fechas inválidas'
      );
      return false;
    }

    if (this.reservaForm.hasError('invalidStayDateRange')) {
      this.reservaForm.controls.fecSalida.markAsTouched();
      this.toast.warning('La fecha de salida debe ser posterior a la fecha de ingreso.', 5500, 'Fechas inválidas');
      return false;
    }

    if (this.habitaciones.length === 0) {
      this.toast.warning('Agregue al menos una habitacion a la reserva antes de confirmar.', 5500, 'Reserva incompleta');
      return false;
    }

    if (!this.reservaForm.controls.codAgencia.value.trim()) {
      this.toast.warning('Seleccione una agencia valida antes de confirmar.', 5500, 'Reserva incompleta');
      return false;
    }

    if (!this.reservaForm.controls.codTarifa.value.trim()) {
      this.toast.warning('Seleccione una tarifa válida antes de confirmar.', 5500, 'Reserva incompleta');
      return false;
    }

    if (!this.reservaForm.controls.codPlan.value.trim()) {
      this.toast.warning('Seleccione un plan de alimentos antes de confirmar.', 5500, 'Reserva incompleta');
      return false;
    }

    if (!this.reservaForm.controls.moneda.value.trim() || this.reservaForm.controls.tCambio.value <= 0) {
      this.toast.warning('No existe un tipo de cambio válido para la moneda seleccionada.', 5500, 'Tipo de cambio');
      return false;
    }

    if (this.reservaForm.invalid) {
      this.reservaForm.markAllAsTouched();
      this.toast.warning('Complete los datos generales obligatorios antes de confirmar la reserva.', 5500, 'Reserva incompleta');
      return false;
    }

    return true;
  }

  private async refreshExchangeRateForCriticalOperation(): Promise<boolean> {
    const moneda = this.reservaForm.controls.moneda.value.trim().toUpperCase();
    const tarifa = this.reservaForm.controls.codTarifa.value.trim().toUpperCase();
    const preserveHistoricalRate =
      this.isEditMode() &&
      tarifa === this.originalTarifa &&
      moneda === this.originalMoneda &&
      this.reservaForm.controls.tCambio.value > 0;

    if (preserveHistoricalRate) {
      return true;
    }

    const loaded = await this.loadExchangeRate(moneda);
    if (!loaded) {
      this.toast.warning(
        this.exchangeRateError() || 'No se pudo obtener el tipo de cambio de la fecha operativa.',
        5500,
        'Tipo de cambio'
      );
    }
    return loaded;
  }

  private async loadExchangeRate(currencyValue: string): Promise<boolean> {
    const currency = currencyValue.trim().toUpperCase();
    const requestId = ++this.exchangeRateRequestId;
    this.exchangeRateError.set('');

    if (!currency) {
      this.reservaForm.controls.tCambio.setValue(0);
      this.exchangeRateError.set('Seleccione una tarifa con moneda válida.');
      return false;
    }

    if (currency === 'COL') {
      this.reservaForm.controls.tCambio.setValue(1);
      return true;
    }

    this.exchangeRateLoading.set(true);
    try {
      const operationalDate = normalizePmsDateDDMMYYYY(
        this.operationalDateService.operationalDate() ||
        await firstValueFrom(this.operationalDateService.ensureLoaded())
      );
      if (!operationalDate) {
        throw new Error('No se obtuvo una fecha operativa válida para consultar el tipo de cambio.');
      }
      const items = await firstValueFrom(
        this.tipoCambioService.fetchTipoCambio(operationalDate, currency.toLowerCase())
      );
      if (requestId !== this.exchangeRateRequestId) {
        return false;
      }

      const exchangeRate = Number(items[0]?.venta || items[0]?.compra || 0);
      if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
        this.reservaForm.controls.tCambio.setValue(0);
        this.exchangeRateError.set(`No hay tipo de cambio para ${currency} en la fecha operativa ${operationalDate}.`);
        return false;
      }

      this.reservaForm.controls.tCambio.setValue(exchangeRate);
      return true;
    } catch (error) {
      console.error('No se pudo cargar el tipo de cambio de la reserva.', error);
      if (requestId === this.exchangeRateRequestId) {
        this.reservaForm.controls.tCambio.setValue(0);
        this.exchangeRateError.set(`No se pudo consultar el tipo de cambio para ${currency}.`);
      }
      return false;
    } finally {
      if (requestId === this.exchangeRateRequestId) {
        this.exchangeRateLoading.set(false);
      }
    }
  }

  private async ensureEditReservationIsCurrent(): Promise<boolean> {
    if (!this.isEditMode()) {
      return true;
    }

    try {
      const latestDetail = await firstValueFrom(this.service.getReservaDetalle(this.editCodReserva));
      const latestForm = ReservaHabitacionMapper.fromDetalle(latestDetail);

      if (this.isLockedReservationState(latestForm.estado)) {
        this.reservaForm.controls.estado.setValue(latestForm.estado, { emitEvent: false });
        this.reservationLocked.set(true);
        await Swal.fire({
          title: 'Reserva protegida',
          text: `La reserva ahora se encuentra en estado ${latestForm.estado} y ya no admite modificaciones.`,
          icon: 'warning',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#b7791f'
        });
        return false;
      }

      const latestFingerprint = this.buildServerFingerprint(latestDetail);
      if (this.originalServerFingerprint && latestFingerprint !== this.originalServerFingerprint) {
        const result = await Swal.fire({
          title: 'La reserva fue actualizada',
          text: 'Otro usuario o proceso modificó esta reserva. Debe recargar la información antes de continuar.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Recargar reserva',
          cancelButtonText: 'Conservar mi pantalla',
          confirmButtonColor: '#3157a4'
        });

        if (result.isConfirmed) {
          this.applyReservaDetalle(latestDetail);
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error('No se pudo revalidar la reserva antes de actualizarla.', error);
      await Swal.fire({
        title: 'No se pudo validar la reserva',
        text: 'La actualización fue cancelada para evitar sobrescribir información desactualizada.',
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#dc3545'
      });
      return false;
    }
  }

  private async revalidateReservationAvailability(): Promise<boolean> {
    const segments = this.buildAvailabilityValidationSegments();
    if (segments.length === 0) {
      return true;
    }

    this.checkingRoomAvailability.set(true);
    try {
      const results = await firstValueFrom(
        forkJoin(
          segments.map((segment) =>
            this.service
              .consultarDisponibilidadCategoria({
                proceso: 1,
                fechaIni: segment.fechaIni,
                fechaSal: segment.fechaSal,
                categoria: segment.categoria,
                cantHab: segment.cantHab
              })
              .pipe(map((response) => ({ segment, response })))
          )
        )
      );

      const failedResponse = results.find(({ response }) => !response.success);
      if (failedResponse) {
        await this.showAvailabilityCheckError(failedResponse.response.message);
        return false;
      }

      const conflicts = results.flatMap(({ segment, response }) => {
        if (response.data.length > 0) {
          return response.data.map((item) => ({
            categoria: segment.categoria,
            fecha: item.fecha,
            disponibles: item.disponibles,
            solicitadas: segment.cantHab
          }));
        }

        return response.totalFechasInsuficientes > 0
          ? [{
              categoria: segment.categoria,
              fecha: segment.fechaIni,
              disponibles: 0,
              solicitadas: segment.cantHab
            }]
          : [];
      });

      if (conflicts.length > 0) {
        await this.showFinalAvailabilityAlert(conflicts);
        return false;
      }

      return true;
    } catch (error) {
      console.error('No se pudo revalidar la disponibilidad antes de guardar la reserva.', error);
      await this.showAvailabilityCheckError();
      return false;
    } finally {
      this.checkingRoomAvailability.set(false);
    }
  }

  private buildAvailabilityValidationSegments(): AvailabilityValidationSegment[] {
    const current = this.buildInventorySnapshot(this.reservaForm.getRawValue());
    const dates = this.enumerateStayDates(current.fecIngreso, current.fecSalida);
    if (dates.length === 0) {
      return [];
    }

    const segments: AvailabilityValidationSegment[] = [];
    for (const [categoria, currentQuantity] of Object.entries(current.categoryRooms)) {
      let segmentStart = '';
      let segmentQuantity = 0;

      for (let index = 0; index <= dates.length; index++) {
        const date = dates[index] ?? current.fecSalida;
        const originalQuantity =
          index < dates.length && this.originalInventorySnapshot &&
          date >= this.originalInventorySnapshot.fecIngreso &&
          date < this.originalInventorySnapshot.fecSalida
            ? this.originalInventorySnapshot.categoryRooms[categoria] ?? 0
            : 0;
        const requiredQuantity = index < dates.length
          ? Math.max(0, currentQuantity - originalQuantity)
          : 0;

        if (requiredQuantity !== segmentQuantity) {
          if (segmentStart && segmentQuantity > 0) {
            segments.push({
              categoria,
              fechaIni: segmentStart,
              fechaSal: date,
              cantHab: segmentQuantity
            });
          }
          segmentStart = requiredQuantity > 0 ? date : '';
          segmentQuantity = requiredQuantity;
        }
      }
    }

    return segments;
  }

  private enumerateStayDates(entryDate: string, departureDate: string): string[] {
    const entry = this.parseDateValue(entryDate);
    const departure = this.parseDateValue(departureDate);
    if (!entry || !departure || departure <= entry) {
      return [];
    }

    const dates: string[] = [];
    const cursor = new Date(entry);
    while (cursor < departure) {
      dates.push(this.formatDateForInput(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  private buildInventorySnapshot(
    value: {
      fecIngreso: string;
      fecSalida: string;
      habitaciones?: Array<{ categoria: string; cantidad: number }>;
    }
  ): ReservationInventorySnapshot {
    const categoryRooms = (value.habitaciones ?? []).reduce<Record<string, number>>((result, room) => {
      const category = String(room.categoria ?? '').trim().toUpperCase();
      if (category) {
        result[category] = (result[category] ?? 0) + Math.max(0, Number(room.cantidad) || 0);
      }
      return result;
    }, {});

    return {
      fecIngreso: toPmsDateInputValue(value.fecIngreso),
      fecSalida: toPmsDateInputValue(value.fecSalida),
      categoryRooms
    };
  }

  private buildServerFingerprint(detalle: ReservaHabitacionDetalle): string {
    const value = ReservaHabitacionMapper.fromDetalle(detalle);
    return JSON.stringify({
      ...value,
      habitaciones: value.habitaciones ?? [],
      inclusiones: value.inclusiones ?? [],
      servicios: value.servicios ?? []
    });
  }

  private isLockedReservationState(state: string): boolean {
    return ['CHK', 'ANU'].includes(state.trim().toUpperCase());
  }

  private async showFinalAvailabilityAlert(
    conflicts: Array<{ categoria: string; fecha: string; disponibles: number; solicitadas: number }>
  ): Promise<void> {
    const rows = conflicts
      .map((item) => `
        <li style="display:grid;grid-template-columns:1fr auto;gap:12px;padding:10px 0;border-bottom:1px solid #e5e7eb;">
          <span>
            <strong style="display:block;color:#1f2937;">${this.escapeHtml(this.getCategoriaLabel(item.categoria))}</strong>
            <small style="color:#6b7280;">${this.escapeHtml(this.formatAvailabilityDate(item.fecha))}</small>
          </span>
          <span style="color:#b91c1c;font-weight:700;">${Math.max(0, Number(item.disponibles) || 0)} disponibles / ${item.solicitadas} requeridas</span>
        </li>`)
      .join('');

    await Swal.fire({
      title: 'La disponibilidad cambió',
      html: `
        <div style="text-align:left;color:#4b5563;">
          <p>La reserva no se guardó porque el inventario cambió desde la última validación.</p>
          <ul style="list-style:none;padding:0;margin:0;">${rows}</ul>
          <p style="font-size:13px;margin:14px 0 0;">Revise las habitaciones o las fechas antes de volver a confirmar.</p>
        </div>`,
      icon: 'warning',
      confirmButtonText: 'Revisar reserva',
      confirmButtonColor: '#b7791f',
      width: 660
    });
  }

  private getReservaErrorMessage(error: unknown): string {
    const fallback = 'No se pudo confirmar la reserva. Revise la conexion con el API o la respuesta del servidor.';
    if (!error || typeof error !== 'object') {
      return fallback;
    }

    const httpError = error as { error?: unknown; message?: string; status?: number; statusText?: string };
    const statusDetail = httpError.status ? ` Codigo HTTP ${httpError.status}${httpError.statusText ? `: ${httpError.statusText}` : ''}.` : '';
    if (typeof httpError.error === 'string' && httpError.error.trim()) {
      return `${httpError.error}${statusDetail}`;
    }

    if (httpError.error && typeof httpError.error === 'object') {
      const apiError = httpError.error as { respuesta?: string; mensaje?: string; message?: string };
      const apiMessage = apiError.respuesta || apiError.mensaje || apiError.message;
      return apiMessage ? `${apiMessage}${statusDetail}` : `${fallback}${statusDetail}`;
    }

    return httpError.message ? `${httpError.message}${statusDetail}` : `${fallback}${statusDetail}`;
  }

  private buildConfirmReservationHtml(): string {
    const agencia = this.escapeHtml(this.agenciaSearchControl.value || this.reservaForm.controls.codAgencia.value || 'Sin agencia');
    const ingreso = this.escapeHtml(this.displayDate(this.reservaForm.controls.fecIngreso.value));
    const salida = this.escapeHtml(this.displayDate(this.reservaForm.controls.fecSalida.value));
    const moneda = this.escapeHtml(this.reservaForm.controls.moneda.value || 'USD');

    return `
      <div style="text-align:left">
        <p style="margin-bottom:12px">Se enviará la reserva al PMS con la siguiente información:</p>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
          <div style="border:1px solid #dee2e6;border-radius:8px;padding:12px">
            <span style="display:block;color:#6c757d;font-size:12px;font-weight:700">Agencia</span>
            <strong>${agencia}</strong>
          </div>
          <div style="border:1px solid #dee2e6;border-radius:8px;padding:12px">
            <span style="display:block;color:#6c757d;font-size:12px;font-weight:700">Estadía</span>
            <strong>${ingreso} - ${salida}</strong>
          </div>
          <div style="border:1px solid #dee2e6;border-radius:8px;padding:12px">
            <span style="display:block;color:#6c757d;font-size:12px;font-weight:700">Noches</span>
            <strong>${this.reservaForm.controls.totNoches.value}</strong>
          </div>
          <div style="border:1px solid #dee2e6;border-radius:8px;padding:12px">
            <span style="display:block;color:#6c757d;font-size:12px;font-weight:700">Habitaciones</span>
            <strong>${this.habitaciones.length}</strong>
          </div>
          <div style="border:1px solid #dee2e6;border-radius:8px;padding:12px">
            <span style="display:block;color:#6c757d;font-size:12px;font-weight:700">Servicios extra</span>
            <strong>${this.servicios.length}</strong>
          </div>
          <div style="border:1px solid #dee2e6;border-radius:8px;padding:12px">
            <span style="display:block;color:#6c757d;font-size:12px;font-weight:700">Total reserva</span>
            <strong>${moneda} ${this.totalReserva().toFixed(2)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  private buildReservationResponseHtml(response: { respuesta?: string; mensaje?: string; codReserva?: string }): string {
    const message = this.escapeHtml(response.respuesta || response.mensaje || 'La reserva fue guardada correctamente.');
    const codReserva = this.escapeHtml(response.codReserva || this.reservaForm.controls.codReserva.value || '');

    return `
      <div style="text-align:left">
        <p style="margin-bottom:12px">${message}</p>
        ${codReserva ? `<div style="border:1px solid #dee2e6;border-radius:8px;padding:12px"><span style="display:block;color:#6c757d;font-size:12px;font-weight:700">Código de reserva</span><strong>${codReserva}</strong></div>` : ''}
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private bindDraftPersistence(): void {
    merge(
      this.reservaForm.valueChanges,
      this.habitacionForm.valueChanges,
      this.inclusionForm.valueChanges,
      this.servicioForm.valueChanges,
      this.agenciaSearchControl.valueChanges,
      this.tarifaSearchControl.valueChanges
    )
      .pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.persistDraft());
  }

  private persistDraft(): void {
    if (this.isEditMode()) {
      return;
    }

    if (this.draftRestorePending) {
      return;
    }

    const draft: ReservaHospedajeDraft = {
      savedAt           : new Date().toISOString(),
      reserva           : this.reservaForm.getRawValue(),
      habitacion        : this.habitacionForm.getRawValue(),
      inclusion         : this.inclusionForm.getRawValue(),
      servicio          : this.servicioForm.getRawValue(),
      agenciaSearch     : this.agenciaSearchControl.value,
      tarifaSearch      : this.tarifaSearchControl.value
    };

    localStorage.setItem(this.draftStorageKey, JSON.stringify(draft));
  }

  private restoreDraft(): void {
    const storedDraft = localStorage.getItem(this.draftStorageKey);
    if (!storedDraft) {
      this.draftRestorePending = false;
      return;
    }

    try {
      const draft = JSON.parse(storedDraft) as ReservaHospedajeDraft;
      this.reservaForm.patchValue(this.normalizeDraftReservationDefaults(draft.reserva), { emitEvent: false });
      this.restoreFormArray(this.habitaciones, draft.reserva.habitaciones, (item) => this.createHabitacionGroup(item));
      this.restoreFormArray(this.inclusiones, draft.reserva.inclusiones, (item) => this.createInclusionGroup(item));
      this.restoreFormArray(this.servicios, draft.reserva.servicios, (item) => this.createServicioGroup(item));
      this.habitacionForm.reset({ ...this.defaultHabitacion(), ...draft.habitacion }, { emitEvent: false });
      this.inclusionForm.reset({ ...this.defaultInclusion(), ...draft.inclusion }, { emitEvent: false });
      this.servicioForm.reset({ ...this.defaultServicio(), ...draft.servicio }, { emitEvent: false });
      this.agenciaSearchControl.setValue(draft.agenciaSearch || this.agenciaSearchControl.value, { emitEvent: false });
      this.tarifaSearchControl.setValue(draft.tarifaSearch || this.tarifaSearchControl.value, { emitEvent: false });
      this.syncTotal();
      this.refreshMealPlanForCurrentSelection(true);
    } catch (error) {
      console.error('No se pudo restaurar el borrador de reserva.', error);
      this.clearDraft();
    } finally {
      this.draftRestorePending = false;
    }
  }

  private restoreFormArray<T extends { [K in keyof T]: AbstractControl<any, any> }>(
    formArray: FormArray<FormGroup<T>>,
    items: unknown,
    createGroup: (item: Partial<ReturnType<FormGroup<T>['getRawValue']>>) => FormGroup<T>
  ): void {
    formArray.clear();
    if (!Array.isArray(items)) {
      return;
    }

    for (const item of items) {
      formArray.push(createGroup(item as Partial<ReturnType<FormGroup<T>['getRawValue']>>));
    }
  }

  private clearDraft(): void {
    localStorage.removeItem(this.draftStorageKey);
  }

  private hasMeaningfulDraft(): boolean {
    const raw = this.reservaForm.getRawValue();
    return (
      this.habitaciones.length > 0 ||
      this.servicios.length > 0 ||
      raw.descripcion.trim().length > 0 ||
      raw.observaciones.trim().length > 0 ||
      this.agenciaSearchControl.value.trim().length > 0 ||
      this.tarifaSearchControl.value.trim().length > 0
    );
  }

  private getTipoHabitacionPax(categoria: string, tipo: string): number {
    return this.roomTypes.find((item) => item.categoria === categoria && item.codigo === tipo)?.pax ?? 0;
  }

  private refreshMealPlanForCurrentSelection(forceReload = false): void {
    const codPlan = this.reservaForm.controls.codPlan.value.trim();
    const codTarifa = this.reservaForm.controls.codTarifa.value.trim();
    const requestId = ++this.mealPlanRequestId;

    if (!codPlan || this.isNoMealPlan(codPlan)) {
      this.isMealPlanLoading = false;
      this.mealPlanDetails = [];
      this.mealPlanRequestKey = '';
      this.mealPlanError = '';
      this.inclusiones.clear();
      this.syncTotal();
      return;
    }

    if (!codTarifa) {
      this.isMealPlanLoading = false;
      this.mealPlanDetails = [];
      this.mealPlanRequestKey = '';
      this.mealPlanError = '';
      this.inclusiones.clear();
      this.syncTotal();
      return;
    }

    const requestKey = `${codTarifa.toUpperCase()}|${codPlan.toUpperCase()}`;
    if (!forceReload && this.mealPlanRequestKey === requestKey) {
      this.recalculateMealPlanInclusions();
      return;
    }

    this.isMealPlanLoading = true;
    this.mealPlanError = '';
    this.service
      .getTarifaAlimentos(codTarifa, codPlan)
      .pipe(
        finalize(() => {
          if (requestId === this.mealPlanRequestId) {
            this.isMealPlanLoading = false;
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          if (requestId !== this.mealPlanRequestId) {
            return;
          }
          this.mealPlanRequestKey = requestKey;
          this.mealPlanDetails = items;
          this.recalculateMealPlanInclusions();
        },
        error: () => {
          if (requestId !== this.mealPlanRequestId) {
            return;
          }
          this.mealPlanDetails = [];
          this.mealPlanRequestKey = '';
          this.inclusiones.clear();
          this.mealPlanError = 'No se pudo cargar el detalle del plan de alimentos.';
          this.syncTotal();
        }
      });
  }

  private async ensureHabitacionDraftRate(): Promise<boolean> {
    const expectedKey = this.buildRoomRateKey(
      this.reservaForm.controls.codTarifa.value,
      this.habitacionForm.controls.categoria.value,
      this.habitacionForm.controls.tipo.value
    );

    if (expectedKey && this.resolvedRoomRateKey === expectedKey) {
      return true;
    }

    const resolved = await this.refreshHabitacionDraftRate();
    if (!resolved) {
      this.toast.warning(
        this.roomRateError() || 'No existe un precio configurado para la tarifa y habitación seleccionadas.',
        5500,
        'Tarifa de hospedaje'
      );
    }
    return resolved;
  }

  private async refreshHabitacionDraftRate(): Promise<boolean> {
    const codTarifa = this.reservaForm.controls.codTarifa.value.trim();
    const categoria = this.habitacionForm.controls.categoria.value.trim();
    const tipo = this.habitacionForm.controls.tipo.value.trim();
    const requestKey = this.buildRoomRateKey(codTarifa, categoria, tipo);
    const requestId = ++this.roomRateRequestId;

    this.resolvedRoomRateKey = '';
    this.roomRateError.set('');
    this.habitacionForm.controls.precio.setValue(0, { emitEvent: false });
    this.updateHabitacionDraftTotal();

    if (!codTarifa || !categoria || !tipo) {
      this.roomRateLoading.set(false);
      return false;
    }

    this.roomRateLoading.set(true);
    try {
      const details = await firstValueFrom(this.detalleTarifaService.getByCategoria(codTarifa, categoria));
      if (requestId !== this.roomRateRequestId) {
        return false;
      }

      const rate = this.findRoomRate(details, categoria, tipo);
      if (!rate) {
        this.roomRateError.set(`No existe una tarifa configurada para ${categoria} / ${tipo}.`);
        return false;
      }

      this.habitacionForm.controls.precio.setValue(this.toFiniteNumber(rate.MR04_Total), { emitEvent: false });
      this.resolvedRoomRateKey = requestKey;
      this.updateHabitacionDraftTotal();
      return true;
    } catch {
      if (requestId === this.roomRateRequestId) {
        this.roomRateError.set('No se pudo consultar el precio de hospedaje.');
      }
      return false;
    } finally {
      if (requestId === this.roomRateRequestId) {
        this.roomRateLoading.set(false);
      }
    }
  }

  private async refreshAllRoomRatesForSelectedTarifa(): Promise<void> {
    const codTarifa = this.reservaForm.controls.codTarifa.value.trim();
    const draft = this.habitacionForm.getRawValue();
    const categories = Array.from(
      new Set(
        [draft.categoria, ...this.habitaciones.controls.map((group) => group.controls.categoria.value)]
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );
    const requestId = ++this.roomRateRequestId;

    this.resolvedRoomRateKey = '';
    this.roomRateError.set('');
    this.habitacionForm.controls.precio.setValue(0, { emitEvent: false });
    for (const group of this.habitaciones.controls) {
      group.controls.precio.setValue(0, { emitEvent: false });
    }
    this.recalculateRoomTotals();

    if (!codTarifa || categories.length === 0) {
      this.roomRateLoading.set(false);
      return;
    }

    this.roomRateLoading.set(true);
    try {
      const responses = await firstValueFrom(
        forkJoin(
          categories.map((categoria) =>
            this.detalleTarifaService.getByCategoria(codTarifa, categoria).pipe(
              map((details) => ({ categoria, details })),
              catchError(() => of({ categoria, details: [] as DetalleTarifaResponse[] }))
            )
          )
        )
      );
      if (requestId !== this.roomRateRequestId) {
        return;
      }

      const ratesByCategory = new Map(responses.map((response) => [response.categoria.toUpperCase(), response.details]));
      const missingRates = new Set<string>();

      for (const group of this.habitaciones.controls) {
        const room = group.getRawValue();
        const rate = this.findRoomRate(ratesByCategory.get(room.categoria.trim().toUpperCase()) ?? [], room.categoria, room.tipo);
        group.controls.precio.setValue(rate ? this.toFiniteNumber(rate.MR04_Total) : 0, { emitEvent: false });
        if (!rate) {
          missingRates.add(`${room.categoria} / ${room.tipo}`);
        }
      }

      if (draft.categoria && draft.tipo) {
        const rate = this.findRoomRate(ratesByCategory.get(draft.categoria.trim().toUpperCase()) ?? [], draft.categoria, draft.tipo);
        this.habitacionForm.controls.precio.setValue(rate ? this.toFiniteNumber(rate.MR04_Total) : 0, { emitEvent: false });
        if (rate) {
          this.resolvedRoomRateKey = this.buildRoomRateKey(codTarifa, draft.categoria, draft.tipo);
        } else {
          missingRates.add(`${draft.categoria} / ${draft.tipo}`);
        }
      }

      this.recalculateRoomTotals();
      this.updateHabitacionDraftTotal();
      if (missingRates.size > 0) {
        this.roomRateError.set(`No existe tarifa configurada para: ${Array.from(missingRates).join(', ')}.`);
      }
    } finally {
      if (requestId === this.roomRateRequestId) {
        this.roomRateLoading.set(false);
      }
    }
  }

  private findRoomRate(details: DetalleTarifaResponse[], categoria: string, tipo: string): DetalleTarifaResponse | undefined {
    const normalizedCategory = categoria.trim().toUpperCase();
    const normalizedType = tipo.trim().toUpperCase();
    return details.find(
      (detail) =>
        String(detail.MR04_CatHabita ?? '').trim().toUpperCase() === normalizedCategory &&
        String(detail.MR04_TipHabita ?? '').trim().toUpperCase() === normalizedType
    );
  }

  private buildRoomRateKey(codTarifa: string, categoria: string, tipo: string): string {
    const parts = [codTarifa, categoria, tipo].map((value) => value.trim().toUpperCase());
    return parts.every(Boolean) ? parts.join('|') : '';
  }

  private recalculateMealPlanInclusions(): void {
    const codPlan = this.reservaForm.controls.codPlan.value.trim();
    if (!codPlan || this.isNoMealPlan(codPlan)) {
      this.inclusiones.clear();
      this.syncTotal();
      return;
    }

    if (this.mealPlanDetails.length === 0) {
      this.syncTotal();
      return;
    }

    const cantidadPax = this.getMealPlanPaxQuantity();
    const noches = Math.max(0, Number(this.reservaForm.controls.totNoches.value) || 0);
    this.inclusiones.clear();

    for (const detail of this.mealPlanDetails) {
      const precio = this.toFiniteNumber(detail.precio);
      this.inclusiones.push(
        this.createInclusionGroup({
          codServ: String(detail.codServ ?? '').trim(),
          desServ: String(detail.descSrv ?? '').trim(),
          tipPax: String(detail.tipPax ?? '').trim(),
          precio,
          cantidad: cantidadPax,
          totServ: cantidadPax * precio * noches,
          cCosto: String(detail.area ?? '').trim()
        })
      );
    }

    this.syncTotal();
  }

  private getMealPlanPaxQuantity(): number {
    if (this.habitaciones.length > 0) {
      return this.habitaciones.controls.reduce((total, group) => {
        const raw = group.getRawValue();
        const pax = raw.pax || this.getTipoHabitacionPax(raw.categoria, raw.tipo);
        return total + pax * (Number(raw.cantidad) || 0);
      }, 0);
    }

    const raw = this.habitacionForm.getRawValue();
    const pax = raw.pax || this.getTipoHabitacionPax(raw.categoria, raw.tipo);
    return pax * (Number(raw.cantidad) || 0);
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByCode(_: number, item: { codigo?: string }): string {
    return item.codigo ?? '';
  }

  trackByCategoria(_: number, item: CategoriaHabitacionOption): string {
    return item.codigo;
  }

  trackByTipoHabitacion(_: number, item: TipoHabitacionOption): string {
    return item.codigo;
  }

  getCategoriaLabel(codigo: string): string {
    const categoria = this.roomCategories.find((item) => item.codigo === codigo);
    return categoria ? `${categoria.codigo} - ${categoria.descripcion}` : codigo;
  }

  getTipoHabitacionLabel(codigo: string): string {
    const tipo = this.roomTypes.find((item) => item.codigo === codigo);
    return tipo ? `${tipo.codigo} - ${tipo.descripcion}` : codigo;
  }

  habitacionesTotal(): number {
    return this.habitaciones.controls.reduce((sum, group) => sum + group.controls.total.value, 0);
  }

  inclusionesTotal(): number {
    return this.inclusiones.controls.reduce((sum, group) => sum + group.controls.totServ.value, 0);
  }

  serviciosSubtotal(): number {
    return this.servicios.controls.reduce((sum, group) => sum + group.controls.cantidad.value * group.controls.precio.value, 0);
  }

  impuestos(): number {
    return this.servicios.controls.reduce((sum, group) => sum + group.controls.impuesto.value, 0);
  }

  totalReserva(): number {
    return this.habitacionesTotal() + this.inclusionesTotal() + this.serviciosSubtotal() + this.impuestos();
  }

  private loadCatalogs(): void {
    this.isCatalogLoading = true;
    forkJoin({
      planes: this.loadMealPlans().pipe(catchError(() => of([] as WalkInOption[]))),
      categorias: this.loadCategoriasHabitacion().pipe(catchError(() => of([] as CategoriaHabitacionOption[])))
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ planes, categorias }) => {
        this.planes = planes;
        this.roomCategories = categorias;
        this.applyPlanDefault();
        this.applyRoomCategoryDefault();
        this.isCatalogLoading = false;
      });
  }

  private loadMealPlans() {
    return this.mealPlansService.getMealPlans().pipe(
      map((plans) =>
        plans
          .map((plan) => this.mapMealPlan(plan))
          .filter((plan) => plan.codigo)
          .sort((a, b) => a.orden - b.orden || a.descripcion.localeCompare(b.descripcion))
          .map(({ codigo, descripcion }) => ({ codigo, descripcion }))
      )
    );
  }

  private mapMealPlan(plan: MealPlan): WalkInOption & { orden: number } {
    return {
      codigo: String(plan.MR06_CodPlan ?? '').trim(),
      descripcion: String(plan.MR06_PlanAlimenticio ?? '').trim(),
      orden: Number(plan.MR06_Orden ?? 0)
    };
  }

  private loadCategoriasHabitacion() {
    return this.http.get<CategoriaHabitacionApiDto[] | { datos?: CategoriaHabitacionApiDto[]; data?: CategoriaHabitacionApiDto[] }>(this.categoriaHabitacionUrl).pipe(
      map((response) => this.normalizeCategoriasHabitacionResponse(response)),
      map((items) =>
        items
          .map((item) => this.mapCategoriaHabitacion(item))
          .filter((item) => item.codigo && item.activo)
          .sort((a, b) => a.orden - b.orden || a.descripcion.localeCompare(b.descripcion))
      )
    );
  }

  private normalizeCategoriasHabitacionResponse(
    response: CategoriaHabitacionApiDto[] | { datos?: CategoriaHabitacionApiDto[]; data?: CategoriaHabitacionApiDto[] }
  ): CategoriaHabitacionApiDto[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.datos)) {
      return response.datos;
    }

    return Array.isArray(response?.data) ? response.data : [];
  }

  private mapCategoriaHabitacion(item: CategoriaHabitacionApiDto): CategoriaHabitacionOption {
    return {
      codigo: (item.CR01_CodCate ?? '').trim(),
      descripcion: (item.CR01_Categoria ?? '').trim(),
      habitaciones: Number(item.CR01_NumHabita ?? 0),
      orden: Number(item.CR01_Orden ?? 0),
      operador: (item.CR01_Operador ?? '').trim(),
      activo: item.CR01_ESTADO === undefined ? true : Number(item.CR01_ESTADO) === 1
    };
  }

  private loadTiposHabitacion(categoria: string) {
    const codigoCategoria = categoria.trim();
    if (!codigoCategoria) {
      return of([] as TipoHabitacionOption[]);
    }

    return this.http
      .get<TipoHabitacionApiDto[] | { datos?: TipoHabitacionApiDto[]; data?: TipoHabitacionApiDto[] }>(
        `${this.apiBaseUrl}/tipohabitacion/categoria/${encodeURIComponent(codigoCategoria)}`
      )
      .pipe(
        map((response) => this.normalizeTiposHabitacionResponse(response)),
        map((items) =>
          items
            .map((item) => this.mapTipoHabitacion(item))
            .filter((item) => item.codigo && item.activo)
            .sort((a, b) => a.orden - b.orden || a.descripcion.localeCompare(b.descripcion))
        )
      );
  }

  private normalizeTiposHabitacionResponse(
    response: TipoHabitacionApiDto[] | { datos?: TipoHabitacionApiDto[]; data?: TipoHabitacionApiDto[] }
  ): TipoHabitacionApiDto[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.datos)) {
      return response.datos;
    }

    return Array.isArray(response?.data) ? response.data : [];
  }

  private mapTipoHabitacion(item: TipoHabitacionApiDto): TipoHabitacionOption {
    return {
      codigo: (item.CR02_TipHabita ?? '').trim(),
      categoria: (item.CR02_CatHabita ?? '').trim(),
      descripcion: (item.CR02_NomHabita ?? '').trim(),
      habitaciones: Number(item.CR02_NumHabita ?? 0),
      pax: Number(item.CR02_NumPax ?? 0),
      orden: Number(item.CR02_Orden ?? 0),
      operador: (item.CR02_Operador ?? '').trim(),
      activo: item.CR02_Activo === undefined ? true : Number(item.CR02_Activo) === 1
    };
  }

  private loadRoomTypesForCategory(categoria: string, preserveCurrentPrice = false): void {
    const currentType = this.habitacionForm.controls.tipo.value;
    this.isRoomTypesLoading = true;
    this.loadTiposHabitacion(categoria)
      .pipe(
        catchError(() => of([] as TipoHabitacionOption[])),
        finalize(() => {
          this.isRoomTypesLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((tipos) => {
        this.roomTypes = tipos;
        this.applyRoomTypeDefault(currentType, preserveCurrentPrice);
      });
  }

  private bindCatalogSearch(): void {
    this.agenciaSearchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => this.catalogService.searchAgencias(term)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((items) => {
        this.clearAgencyCodeIfTypedManually();
        this.agenciaSuggestions = items;
        this.agenciaSearchOpen = items.length > 0;
      });

    this.tarifaSearchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => this.catalogService.searchTarifas(term, true)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((items) => {
        this.clearTarifaCodeIfTypedManually();
        this.tarifaSuggestions = items;
        this.tarifaSearchOpen = items.length > 0;
      });

    this.agencyModalSearchControl.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.showAgencyModal) {
          this.loadAgencyModalPage(1);
        }
      });

    this.tarifaModalSearchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.showTarifaModal) {
          this.applyTarifaModalFilter(1);
        }
      });
  }

  private applyPlanDefault(): void {
    if (this.planes.length === 0) {
      return;
    }

    const currentPlan = this.reservaForm.controls.codPlan.value;
    const matchedPlan = this.planes.find((item) => item.codigo === currentPlan);
    if (matchedPlan) {
      return;
    }

    if (this.isEditMode()) {
      return;
    }

    this.reservaForm.controls.codPlan.setValue('', { emitEvent: false });
    this.onPlanChange('');
  }

  private isNoMealPlan(codPlan: string): boolean {
    return codPlan.trim().toUpperCase() === 'SPL';
  }

  private applyRoomCategoryDefault(): void {
    const firstCategory = this.roomCategories[0];
    if (!firstCategory) {
      return;
    }

    const currentCategory = this.habitacionForm.controls.categoria.value;
    const categoryExists = this.roomCategories.some((item) => item.codigo === currentCategory);
    if (!currentCategory || !categoryExists) {
      this.habitacionForm.controls.categoria.setValue(firstCategory.codigo, { emitEvent: false });
      this.loadRoomTypesForCategory(firstCategory.codigo);
    } else {
      this.loadRoomTypesForCategory(currentCategory);
    }

    this.updateHabitacionDraftTotal();
  }

  private applyRoomTypeDefault(preferredType = '', preserveCurrentPrice = false): void {
    const typeExists = this.roomTypes.some((item) => item.codigo === preferredType);
    const nextType = typeExists ? preferredType : this.roomTypes[0]?.codigo ?? '';
    this.habitacionForm.controls.tipo.setValue(nextType, { emitEvent: false });
    this.updateHabitacionDraftPax();
    this.recalculateMealPlanInclusions();
    if (!preserveCurrentPrice || !typeExists) {
      void this.refreshHabitacionDraftRate();
    }
  }

  private buildAgenciaLabel(agencia: WalkInAgenciaOption): string {
    return [agencia.codigo, agencia.descripcion].filter(Boolean).join(' - ');
  }

  private buildTarifaLabel(tarifa: WalkInTarifaOption): string {
    return [tarifa.codigo, tarifa.descripcion].filter(Boolean).join(' - ');
  }

  private applyTarifaModalFilter(page: number): void {
    const filtered = this.catalogService.filterTarifas(this.allTarifas, this.tarifaModalSearchControl.value, true);
    const totalPages = Math.ceil(filtered.length / this.tarifaModalPageSize);
    const normalizedPage = Math.min(Math.max(page, 1), Math.max(totalPages, 1));
    const start = (normalizedPage - 1) * this.tarifaModalPageSize;

    this.tarifaModalTarifas = filtered.slice(start, start + this.tarifaModalPageSize);
    this.tarifaModalPage = normalizedPage;
    this.tarifaModalTotalRecords = filtered.length;
    this.tarifaModalTotalPages = totalPages;
  }

  private clearAgencyCodeIfTypedManually(): void {
    const codigo = this.reservaForm.controls.codAgencia.value.trim();
    const label = this.agenciaSearchControl.value.trim();
    if (codigo && !label.startsWith(`${codigo} -`)) {
      this.reservaForm.controls.codAgencia.setValue('', { emitEvent: false });
    }
  }

  private clearTarifaCodeIfTypedManually(): void {
    const codigo = this.reservaForm.controls.codTarifa.value.trim();
    const label = this.tarifaSearchControl.value.trim();
    if (codigo && !label.startsWith(`${codigo} -`)) {
      this.exchangeRateRequestId++;
      this.exchangeRateLoading.set(false);
      this.exchangeRateError.set('');
      this.reservaForm.patchValue({ codTarifa: '', moneda: '', tCambio: 0 }, { emitEvent: false });
      this.roomRateRequestId++;
      this.roomRateLoading.set(false);
      this.roomRateError.set('');
      this.resolvedRoomRateKey = '';
      this.habitacionForm.controls.precio.setValue(0, { emitEvent: false });
      for (const group of this.habitaciones.controls) {
        group.controls.precio.setValue(0, { emitEvent: false });
      }
      this.updateHabitacionDraftTotal();
      this.recalculateRoomTotals();
      this.refreshMealPlanForCurrentSelection(true);
    }
  }

  private getCurrentAgencySearchTerm(): string {
    const value = this.agenciaSearchControl.value.trim();
    const code = this.reservaForm.controls.codAgencia.value.trim();
    return code && value.startsWith(`${code} -`) ? value.slice(`${code} -`.length).trim() : value;
  }

  private getCurrentTarifaSearchTerm(): string {
    const value = this.tarifaSearchControl.value.trim();
    const code = this.reservaForm.controls.codTarifa.value.trim();
    return code && value.startsWith(`${code} -`) ? value.slice(`${code} -`.length).trim() : value;
  }

  private createHabitacionGroup(value: Partial<ReservaHabitacionItem> = this.defaultHabitacion()): FormGroup<HabitacionForm> {
    const categoria = value.categoria ?? '';
    const tipo = value.tipo ?? '';
    return this.fb.group({
      categoria: this.fb.control(categoria, { validators: [Validators.required] }),
      tipo: this.fb.control(tipo, { validators: [Validators.required] }),
      cantidad: this.fb.control(value.cantidad ?? 1, { validators: [Validators.min(1)] }),
      pax: this.fb.control(value.pax ?? this.getTipoHabitacionPax(categoria, tipo)),
      precio: this.fb.control(value.precio ?? 0, { validators: [Validators.min(0)] }),
      cantidadNinos: this.fb.control(value.cantidadNinos ?? 0, { validators: [Validators.min(0)] }),
      precioNino: this.fb.control(value.precioNino ?? 0, { validators: [Validators.min(0)] }),
      total: this.fb.control(value.total ?? 0)
    });
  }

  private createInclusionGroup(value: Partial<ReservaInclusionItem> = this.defaultInclusion()): FormGroup<InclusionForm> {
    return this.fb.group({
      codServ: this.fb.control(value.codServ ?? '', { validators: [Validators.required] }),
      desServ: this.fb.control(value.desServ ?? '', { validators: [Validators.required] }),
      tipPax: this.fb.control(value.tipPax ?? ''),
      precio: this.fb.control(value.precio ?? 0, { validators: [Validators.min(0)] }),
      cantidad: this.fb.control(value.cantidad ?? 1, { validators: [Validators.min(1)] }),
      totServ: this.fb.control(value.totServ ?? 0),
      cCosto: this.fb.control(value.cCosto ?? '')
    });
  }

  private createServicioGroup(value: Partial<ReservaServicioItem> = this.defaultServicio()): FormGroup<ServicioForm> {
    return this.fb.group({
      codSrv: this.fb.control(value.codSrv ?? '', { validators: [Validators.required] }),
      descripcion: this.fb.control(value.descripcion ?? '', { validators: [Validators.required] }),
      cantidad: this.fb.control(value.cantidad ?? 1, { validators: [Validators.min(1)] }),
      precio: this.fb.control(value.precio ?? 0, { validators: [Validators.min(0)] }),
      impuesto: this.fb.control(value.impuesto ?? 0, { validators: [Validators.min(0)] }),
      tipPax: this.fb.control(value.tipPax ?? 'Reserva'),
      total: this.fb.control(value.total ?? 0)
    });
  }

  private updateHabitacionDraftTotal(): void {
    const raw = this.habitacionForm.getRawValue();
    const total = raw.cantidad * raw.precio * this.reservaForm.controls.totNoches.value + raw.cantidadNinos * raw.precioNino * this.reservaForm.controls.totNoches.value;
    this.habitacionForm.controls.total.setValue(total, { emitEvent: false });
  }

  private updateHabitacionDraftPax(): void {
    const raw = this.habitacionForm.getRawValue();
    const pax = this.getTipoHabitacionPax(raw.categoria, raw.tipo);
    if (this.habitacionForm.controls.pax.value !== pax) {
      this.habitacionForm.controls.pax.setValue(pax, { emitEvent: false });
    }
  }

  private updateInclusionDraftTotal(): void {
    const raw = this.inclusionForm.getRawValue();
    this.inclusionForm.controls.totServ.setValue(raw.cantidad * raw.precio * this.reservaForm.controls.totNoches.value, { emitEvent: false });
  }

  private updateServicioDraftTotal(): void {
    const raw = this.servicioForm.getRawValue();
    this.servicioForm.controls.total.setValue(raw.cantidad * raw.precio + raw.impuesto, { emitEvent: false });
  }

  private recalculateStay(): void {
    const ingreso = this.parseDateValue(this.reservaForm.controls.fecIngreso.value);
    const salida = this.parseDateValue(this.reservaForm.controls.fecSalida.value);

    if (!ingreso || !salida || salida <= ingreso) {
      this.reservaForm.controls.totNoches.setValue(0, { emitEvent: false });
      this.reservaForm.controls.totDias.setValue(0, { emitEvent: false });
      this.recalculateRoomTotals();
      this.recalculateMealPlanInclusions();
      return;
    }

    const nights = Math.round((salida.getTime() - ingreso.getTime()) / 86400000);
    this.reservaForm.controls.totNoches.setValue(nights, { emitEvent: false });
    this.reservaForm.controls.totDias.setValue(nights + 1, { emitEvent: false });
    this.recalculateRoomTotals();
    this.updateHabitacionDraftTotal();
    this.recalculateMealPlanInclusions();
  }

  minimumDepartureDate(): string {
    return this.addDaysToInputDate(this.reservaForm.controls.fecIngreso.value, 1);
  }

  minimumEntryDate(): string {
    const operationalDate = this.operationalDateForInput();
    const originalEntry = this.originalInventorySnapshot?.fecIngreso ?? '';
    return this.isEditMode() && originalEntry && originalEntry < operationalDate
      ? originalEntry
      : operationalDate;
  }

  operationalDateForInput(): string {
    return this.toInputDate(this.operationalDate());
  }

  private reservationDatesValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const ingresoValue = String(control.get('fecIngreso')?.value ?? '');
      const salidaValue = String(control.get('fecSalida')?.value ?? '');
      const ingreso = this.parseDateValue(ingresoValue);
      const salida = this.parseDateValue(salidaValue);
      const errors: ValidationErrors = {};
      const operationalDate = this.toInputDate(this.operationalDateService.operationalDate());
      const isOriginalHistoricalEntry =
        this.isEditMode() &&
        !!this.originalInventorySnapshot &&
        ingresoValue === this.originalInventorySnapshot.fecIngreso;

      if (operationalDate && ingresoValue && ingresoValue < operationalDate && !isOriginalHistoricalEntry) {
        errors['entryBeforeOperationalDate'] = true;
      }

      if (ingreso && salida && salida <= ingreso) {
        errors['invalidStayDateRange'] = true;
      }

      return Object.keys(errors).length > 0 ? errors : null;
    };
  }

  private loadOperationalDate(): void {
    this.operationalDateService
      .ensureLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (operationalDate) => {
          this.applyOperationalDateDefaults(operationalDate);
          this.reservaForm.updateValueAndValidity({ emitEvent: false });
          if (!this.isEditMode() && this.reservaForm.controls.moneda.value.trim()) {
            void this.loadExchangeRate(this.reservaForm.controls.moneda.value);
          }
        },
        error: () => this.reservaForm.updateValueAndValidity({ emitEvent: false })
      });
  }

  private async ensureOperationalDateForValidation(): Promise<boolean> {
    try {
      const operationalDate = await firstValueFrom(this.operationalDateService.refresh());
      if (!normalizePmsDateDDMMYYYY(operationalDate)) {
        throw new Error('La fecha operativa recibida no es válida.');
      }
      this.applyOperationalDateDefaults(operationalDate);
      this.reservaForm.updateValueAndValidity({ emitEvent: false });
      return true;
    } catch {
      this.toast.warning(
        'No se pudo obtener la fecha operativa. Intente nuevamente antes de confirmar la reserva.',
        5500,
        'Validación pendiente'
      );
      return false;
    }
  }

  private applyOperationalDateDefaults(operationalDate: string): void {
    const ingresoControl = this.reservaForm.controls.fecIngreso;
    const salidaControl = this.reservaForm.controls.fecSalida;
    const creationControl = this.reservaForm.controls.fecCreacion;
    const operationalInputDate = this.toInputDate(operationalDate);

    if (!operationalInputDate || this.isEditMode()) {
      return;
    }

    if (!ingresoControl.dirty && ingresoControl.value < operationalInputDate) {
      ingresoControl.setValue(operationalInputDate);
      salidaControl.setValue(this.addDaysToInputDate(operationalInputDate, 1));
    }

    if (!creationControl.dirty) {
      creationControl.setValue(operationalInputDate);
    }
  }

  private recalculateRoomTotals(): void {
    for (const group of this.habitaciones.controls) {
      const raw = group.getRawValue();
      const total = raw.cantidad * raw.precio * this.reservaForm.controls.totNoches.value + raw.cantidadNinos * raw.precioNino * this.reservaForm.controls.totNoches.value;
      group.controls.total.setValue(total, { emitEvent: false });
    }
    this.syncTotal();
  }

  private syncTotal(): void {
    this.reservaForm.controls.totalRsv.setValue(this.totalReserva(), { emitEvent: false });
  }

  private toFiniteNumber(value: unknown): number {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private defaultHabitacion(): ReservaHabitacionItem {
    return {
      categoria: this.roomCategories?.[0]?.codigo ?? '',
      tipo: this.roomTypes?.[0]?.codigo ?? '',
      cantidad: 1,
      pax: this.roomTypes?.[0]?.pax ?? 0,
      precio: 0,
      cantidadNinos: 0,
      precioNino: 0,
      total: 0
    };
  }

  private defaultInclusion(): ReservaInclusionItem {
    return { codServ: '', desServ: '', tipPax: '', precio: 0, cantidad: 1, totServ: 0, cCosto: '' };
  }

  private defaultServicio(): ReservaServicioItem {
    return { codSrv: '', descripcion: '', cantidad: 1, precio: 0, impuesto: 0, tipPax: 'Reserva', total: 0 };
  }

  private defaultReservationDates(): Pick<
    ReturnType<FormGroup<ReservaHeaderForm>['getRawValue']>,
    'fecIngreso' | 'fecSalida' | 'fecCreacion' | 'fecConfirma' | 'fecPrepago' | 'fecAnulada' | 'totNoches' | 'totDias'
  > {
    const entryDate = this.operationalDateForInput() || this.todayAsInputDate();

    return {
      fecIngreso      : entryDate,
      fecSalida       : this.addDaysToInputDate(entryDate, 1),
      fecCreacion     : entryDate,
      fecConfirma     : '',
      fecPrepago      : '',
      fecAnulada      : '',
      totNoches       : 1,
      totDias         : 2
    };
  }

  private normalizeDraftReservationDefaults(
    draftReserva: ReservaHospedajeDraft['reserva']
  ): ReservaHospedajeDraft['reserva'] {
    const defaults = this.defaultReservationDates();
    return {
      ...draftReserva,
      ...defaults
    };
  }

  private todayAsInputDate(): string {
    return this.formatDateForInput(new Date());
  }

  private addDaysAsInputDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return this.formatDateForInput(date);
  }

  private addDaysToInputDate(value: string, days: number): string {
    const date = this.parseDateValue(value);
    if (!date) {
      return '';
    }

    date.setDate(date.getDate() + days);
    return this.formatDateForInput(date);
  }

  private toInputDate(value: string): string {
    return toPmsDateInputValue(value);
  }

  private formatDateForInput(date: Date): string {
    return toPmsDateInputValue(date);
  }

  private formatDate(date: Date): string {
    return normalizePmsDateDDMMYYYY(date);
  }

  private parseDateValue(value: string): Date | null {
    return parsePmsDate(value);
  }
}
