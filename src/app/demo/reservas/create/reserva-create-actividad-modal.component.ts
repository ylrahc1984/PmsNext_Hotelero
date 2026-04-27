import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { OperatorFunction, Subject, Subscription, firstValueFrom, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, switchMap, takeUntil } from 'rxjs/operators';
import { NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';

import { ActividadDetalleForm, ActividadPickupForm } from './reserva-create.models';
import { PickupRapidoModalSavePayload, ReservaCreatePickupRapidoModalComponent } from './reserva-create-pickup-rapido-modal.component';
import { ReservaPickupRapidoService } from './reserva-pickup-rapido.service';
import { FISCAL_CONFIG } from 'src/app/core/config/fiscal.config';
import { calculateFiscalTotals } from 'src/app/core/config/fiscal.utils';
import { safeJsonParse, safeJsonStringify } from './reserva-create.utils';
import { ServicioUI } from '../../catalogos/servicios/servicios.service';
import { PlanTarifaUI } from '../../catalogos/listas-precios/planes-tarifas.service';
import { ListaPrecioUI } from '../../catalogos/listas-precios/lista-precio.models';
import { TipoPaxUI } from '../services/tipo-pax.service';
import { ReservaCreateTarifaService } from './reserva-create.tarifa.service';
import { DetallePrecioServicioApiItem } from './reserva-create.tarifa.models';
import { ListaPickupService } from '../../catalogos/lista-pickup/lista-pickup.service';
import { PickupListaItem } from '../../catalogos/lista-pickup/lista-pickup.models';

export interface Tarifa {
  tipoPax   ?: string;
  tipo      : string;
  precio    : number;
  cantidad  : number;
  total     : number;
}

export interface ActividadDetalle {
  codServicio       : string;
  nomServicio       : string;
  tipoServicio     ?: string;
  reglaPrecioID     : number;
  tarifas           : Tarifa[];
  totalLinea        : number;
}

export interface ActividadDetallePayload {
  codServicio           : string;
  nomServicio           : string;
  tipoServicio         ?: string;
  fecServicio           : string;
  horaServicio          : string;
  horaPickup            : string;
  reglaPrecioID         : number;
  adultos               : number;
  ninos                 : number;
  montoServicio         : number;
  detallesPax           : Array<{
    tipoPax     : string;
    cantidad    : number;
    precioNeto  : number;
  }>;
}

export interface ActividadModalSavePayload {
  codPlan           : string;
  planTarifario     : string;
  codLstPrecio      : string;
  fechaServicio     : string;
  horaPickup        : string;
  horaInicio        : string;
  observaciones     : string;
  pickups           : ActividadPickupForm[];
  actividades       : ActividadDetalle[];
  totalGeneral      : number;
  porDescuento      : number;
  descuentoMonto    : number;
  payload           : ActividadDetallePayload[];
}

type PickupFormGroup = FormGroup<{
  direccion     : FormControl<string>;
  zona          : FormControl<string>;
  google        : FormControl<string>;
  placeId       : FormControl<string>;
  lat           : FormControl<number>;
  lng           : FormControl<number>;
  error         : FormControl<string>;
}>;

type TarifaFormGroup = FormGroup<{
  tipoPax     : FormControl<string>;
  tipo        : FormControl<string>;
  precio      : FormControl<number>;
  cantidad    : FormControl<number>;
  total       : FormControl<number>;
}>;

type ActividadDetalleFormGroup = FormGroup<{
  codServicio       : FormControl<string>;
  nomServicio       : FormControl<string>;
  tipoServicio      : FormControl<string>;
  reglaPrecioID     : FormControl<number>;
  expanded          : FormControl<boolean>;
  totalLinea        : FormControl<number>;
  tarifas           : FormArray<TarifaFormGroup>;
}>;

type ActividadModalFormGroup = FormGroup<{
  codPlan         : FormControl<string>;
  codLstPrecio    : FormControl<string>;
  fechaServicio   : FormControl<string>;
  horaPickup      : FormControl<string>;
  horaInicio      : FormControl<string>;
  observaciones   : FormControl<string>;
  pickups         : FormArray<PickupFormGroup>;
  actividades     : FormArray<ActividadDetalleFormGroup>;
  totalGeneral    : FormControl<number>;
}>;

@Component({
  selector: 'app-reserva-create-actividad-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbTypeaheadModule, ReservaCreatePickupRapidoModalComponent],
  templateUrl: './reserva-create-actividad-modal.component.html',
  styleUrls: ['./reserva-create-actividad-modal.component.scss']
})
export class ReservaCreateActividadModalComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() open = false;
  @Input() saving = false;
  @Input({ required: true }) actividadForm!: ActividadDetalleForm;
  @Input() servicios: ServicioUI[] = [];
  @Input() serviciosLoading = false;
  @Input() tiposPax: TipoPaxUI[] = [];
  @Input() planesTarifas: PlanTarifaUI[] = [];
  @Input() listaPrecios: ListaPrecioUI[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<ActividadModalSavePayload>();
  @Output() serviceChange = new EventEmitter<string>();

  readonly form: ActividadModalFormGroup;
  readonly servicioSearchControl: FormControl<string>;
  @ViewChild('servicioSearchInput') servicioSearchInput?: ElementRef<HTMLInputElement>;

  tarifasLoading = false;
  tarifaError = '';
  comboActivo = false;
  porDescuentoInput = 0;
  descuentoMontoInput = 0;
  subTotal = 0;
  porDescuento = 0;
  descuento = 0;
  neto = 0;
  impuesto = 0;
  montoServicio = 0;
  pickupLookupLoading = false;
  showPickupRapidoModal = false;
  guardandoPickupRapido = false;
  pickupRapidoError = '';
  serviciosPageNumber = 1;
  readonly serviciosPageSize = 7;
  serviciosPageHasNext = false;
  serviciosPageItemsCount = 0;
  submitLocked = false;

  private destroy$ = new Subject<void>();
  private actividadesSubscriptions = new Subscription();
  private actividadesStateMap = new Map<string, ActividadDetalle>();
  private readonly tarifaDefaults: ReadonlyArray<{ tipoPax: string; tipo: string }> = [
    { tipoPax: 'PAX', tipo: 'PAX' },
    { tipoPax: 'CHL', tipo: 'CHILDS' },
    { tipoPax: 'NAC', tipo: 'NACIONAL' }
  ];

  private resolveTipoServicioValue(value: unknown, fallback = ''): string {
    const normalized = (value || fallback || '').toString().trim().toUpperCase();
    if (!normalized) return '';
    if (normalized === 'TRF' || normalized === 'TRANSFER' || normalized === 'TRASLADO' || normalized === 'TRASLADOS') {
      return 'TRANS';
    }
    if (normalized === 'ACT' || normalized === 'ACTIVIDAD' || normalized === 'ACTIVIDADES' || normalized === 'TOURS') {
      return 'TOUR';
    }
    return normalized;
  }

  private resolvePlanTarifario(codPlan: string): string {
    const normalized = (codPlan || '').toString().trim();
    if (!normalized) return '';
    const match = (this.planesTarifas ?? []).find((item) => (item?.planId ?? '').toString().trim() === normalized);
    return match ? String(match.planId) : normalized;
  }

  constructor(
    private fb: FormBuilder,
    private tarifaService: ReservaCreateTarifaService,
    private listaPickupService: ListaPickupService,
    private pickupRapidoService: ReservaPickupRapidoService
  ) {
    this.form = this.fb.group({
      codPlan: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
      codLstPrecio: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
      fechaServicio: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
      horaPickup: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)]
      }),
      horaInicio: this.fb.control('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)]
      }),
      observaciones: this.fb.control('', { nonNullable: true }),
      pickups: this.fb.array<PickupFormGroup>([]),
      actividades: this.fb.array<ActividadDetalleFormGroup>([]),
      totalGeneral: this.fb.control(0, { nonNullable: true })
    });

    this.servicioSearchControl = this.fb.control('', { nonNullable: true });
    this.servicioSearchControl.valueChanges
      .pipe(
        map((value) => (value ?? '').toString().trim()),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (!this.open) return;
        this.serviciosPageNumber = 1;
        this.cargarServiciosDetalleGeneral();
      });

    this.form.controls.codLstPrecio.valueChanges
      .pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.open) return;
        this.onListaPrecioChange();
      });

    this.form.controls.codPlan.valueChanges
      .pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.open) return;
        this.syncInputModel();
        this.cargarServiciosDetalleGeneral();
      });

    this.form.controls.horaInicio.valueChanges
      .pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.open) return;
        this.recalculateHoraPickup();
      });
  }

  get pickupsArray(): FormArray<PickupFormGroup> {
    return this.form.controls.pickups;
  }

  get pickupGroup(): PickupFormGroup {
    return this.ensureSinglePickupGroup();
  }

  get actividadesArray(): FormArray<ActividadDetalleFormGroup> {
    return this.form.controls.actividades;
  }

  get selectedListaPrecio(): ListaPrecioUI | null {
    const code = (this.form.controls.codLstPrecio.value || '').toString().trim();
    if (!code) return null;
    return (this.listaPrecios || []).find((item) => (item.codigo ?? '').toString().trim() === code) ?? null;
  }

  get resumenActividades(): ActividadDetalle[] {
    return Array.from(this.actividadesStateMap.values());
  }

  get serviciosSeleccionados(): ActividadDetalle[] {
    return this.resumenActividades.filter((item) => this.hasActividadCantidad(item));
  }

  get isSubmitting(): boolean {
    return this.submitLocked || this.saving;
  }

  get serviciosRangeLabel(): string {
    const count = Number(this.serviciosPageItemsCount ?? 0) || 0;
    if (count <= 0) {
      return 'Mostrando 0–0 de 0 actividades';
    }
    const start = (this.serviciosPageNumber - 1) * this.serviciosPageSize + 1;
    const end = start + count - 1;
    const totalLabel = this.serviciosPageHasNext ? `${end}+` : `${end}`;
    return `Mostrando ${start}–${end} de ${totalLabel} actividades`;
  }

  isActividadActiva(actividad: ActividadDetalleFormGroup): boolean {
    return actividad.controls.tarifas.controls.some((tarifa) => (Number(tarifa.controls.cantidad.value ?? 0) || 0) > 0);
  }

  getActividadCantidadTotal(actividad: ActividadDetalle): number {
    return (actividad.tarifas ?? []).reduce((sum, tarifa) => sum + (Number(tarifa.cantidad ?? 0) || 0), 0);
  }

  getActividadCantidadDetalle(actividad: ActividadDetalle): string {
    const counts = new Map<string, number>();
    for (const tarifa of actividad.tarifas ?? []) {
      const qty = Number(tarifa.cantidad ?? 0) || 0;
      if (qty <= 0) continue;
      const tipo = this.resolveTarifaTipoPax(tarifa);
      counts.set(tipo, (counts.get(tipo) ?? 0) + qty);
    }

    const ordered = this.getOrderedTipoPaxCodes(Array.from(counts.keys()));
    return ordered.filter((tipo) => counts.has(tipo)).map((tipo) => `${counts.get(tipo)} ${tipo}`).join(' · ');
  }

  recalcularTotales(): void {
    this.calcularTotales();
  }

  onComboActivoChange(): void {
    if (this.comboActivo && this.porDescuentoInput === 0 && this.descuentoMontoInput === 0) {
      this.porDescuentoInput = 5;
      this.descuentoMontoInput = this.roundCurrency(this.getTotalFinalSinDescuento() * 0.05);
    }
    if (!this.comboActivo) {
      this.porDescuentoInput = 0;
      this.descuentoMontoInput = 0;
    }
    this.calcularTotales();
  }

  onPorDescuentoInputChange(val: number | string): void {
    const pct = Math.min(100, Math.max(0, Number(val ?? 0) || 0));
    this.porDescuentoInput = pct;
    this.descuentoMontoInput = this.roundCurrency(this.getTotalFinalSinDescuento() * pct / 100);
    this.calcularTotales();
  }

  onDescuentoMontoInputChange(val: number | string): void {
    const totalFinalSinDescuento = this.getTotalFinalSinDescuento();
    const monto = Math.min(totalFinalSinDescuento, Math.max(0, Number(val ?? 0) || 0));
    this.descuentoMontoInput = monto;
    this.porDescuentoInput = totalFinalSinDescuento > 0
      ? this.roundCurrency((monto / totalFinalSinDescuento) * 100)
      : 0;
    this.calcularTotales();
  }

  clearActividadFromResumen(actividad: ActividadDetalle): void {
    const key = this.buildActividadKey(actividad.codServicio);
    if (!key) return;

    this.actividadesStateMap.delete(key);

    const index = this.actividadesArray.controls.findIndex((group) => this.buildActividadKey(group.controls.codServicio.value) === key);
    if (index >= 0) {
      const group = this.actividadesArray.at(index);
      group.controls.tarifas.controls.forEach((tarifaGroup) => {
        tarifaGroup.controls.cantidad.setValue(0, { emitEvent: false });
        tarifaGroup.controls.total.setValue(0, { emitEvent: false });
      });
      group.controls.totalLinea.setValue(0, { emitEvent: false });
    }

    this.calcularTotales();
    this.syncInputModel();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const openChange = changes['open'];
    if (openChange?.currentValue !== true) {
      this.submitLocked = false;
      this.showPickupRapidoModal = false;
      this.guardandoPickupRapido = false;
      this.pickupRapidoError = '';
    }

    if (changes['saving'] && changes['saving'].currentValue !== true) {
      this.submitLocked = false;
    }

    if (openChange?.currentValue === true && openChange?.previousValue !== true) {
      this.submitLocked = false;
      this.hydrateFormFromInput();
      this.focusSearchInput();
      return;
    }

    if (this.open && changes['actividadForm'] && !changes['actividadForm'].firstChange) {
      this.hydrateFormFromInput();
      return;
    }

    if (this.open && (changes['listaPrecios'] || changes['planesTarifas'])) {
      this.ensureTarifaDefaults();
      this.serviciosPageNumber = 1;
      this.cargarServiciosDetalleGeneral();
    }
    if (this.open && changes['servicios']) {
      this.serviciosPageNumber = 1;
      this.cargarServiciosDetalleGeneral();
    }
  }

  ngOnDestroy(): void {
    this.actividadesSubscriptions.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    if (this.open) {
      this.focusSearchInput();
    }
  }

  onClose(): void {
    if (this.isSubmitting) {
      return;
    }
    this.close.emit();
  }

  onHoraInput(field: 'horaPickup' | 'horaInicio', value: string): void {
    const control = this.form.controls[field];
    const sanitized = this.sanitizeHoraInput(value);
    if (control.value !== sanitized) {
      control.setValue(sanitized);
      return;
    }

    if (field === 'horaPickup') {
      this.syncInputModel();
    }
  }

  onHoraBlur(field: 'horaPickup' | 'horaInicio'): void {
    const control = this.form.controls[field];
    const normalized = this.normalizeHoraValue(control.value);
    if (control.value !== normalized) {
      control.setValue(normalized);
    }
    control.markAsTouched();

    if (field === 'horaInicio') {
      this.recalculateHoraPickup();
    } else {
      this.syncInputModel();
    }
  }

  onSubmit(): void {
    if (this.isSubmitting) {
      return;
    }

    this.normalizeHoraFields();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.calcularTotales();
    const payload = this.construirPayload();
    if (!payload.length) {
      this.tarifaError = 'Debe ingresar al menos una cantidad mayor a cero en alguna tarifa.';
      return;
    }

    this.syncInputModel();
    this.submitLocked = true;

    const raw = this.form.getRawValue();
    const actividades = this.getAllActividadesValue();
    this.save.emit({
      codPlan: raw.codPlan,
      planTarifario: this.resolvePlanTarifario(raw.codPlan),
      codLstPrecio: raw.codLstPrecio,
      fechaServicio: raw.fechaServicio,
      horaPickup: raw.horaPickup,
      horaInicio: raw.horaInicio,
      observaciones: raw.observaciones,
      pickups: this.getPickupsValue(),
      actividades,
      totalGeneral: raw.totalGeneral,
      porDescuento: this.porDescuento,
      descuentoMonto: this.descuento,
      payload
    });
  }

  abrirModalPickupRapido(): void {
    if (this.guardandoPickupRapido) {
      return;
    }

    this.pickupRapidoError = '';
    this.showPickupRapidoModal = true;
  }

  cerrarModalPickupRapido(): void {
    if (this.guardandoPickupRapido) {
      return;
    }

    this.showPickupRapidoModal = false;
    this.pickupRapidoError = '';
  }

  async guardarPickupRapido(payload: PickupRapidoModalSavePayload): Promise<void> {
    if (this.guardandoPickupRapido) {
      return;
    }

    const nombre = (payload?.nombre ?? '').toString().trim();
    const duracion = (payload?.duracion ?? '').toString().trim();
    if (!nombre || !duracion) {
      this.pickupRapidoError = 'Debe indicar el nombre y la duracion del pickup.';
      return;
    }

    this.pickupRapidoError = '';
    this.guardandoPickupRapido = true;

    try {
      const response = await firstValueFrom(
        this.pickupRapidoService.crearPickupRapido({
          nombre,
          duracion
        })
      );

      const pickup = response?.pickup;
      this.applyPickupSelection({
        id: pickup?.id ?? response?.idPickupCreado ?? 0,
        nombre: pickup?.nombre ?? nombre,
        duracion: pickup?.duracion ?? duracion,
        localizacion: pickup?.localizacion ?? ''
      }, 'pickup-rapido');

      this.showPickupRapidoModal = false;
      this.pickupRapidoError = '';
    } catch (error) {
      console.error('[ReservaCreateActividadModal] guardarPickupRapido', error);
      this.pickupRapidoError = this.resolvePickupRapidoError(error);
    } finally {
      this.guardandoPickupRapido = false;
    }
  }

  readonly searchPickup: OperatorFunction<string, readonly PickupListaItem[]> = (text$) =>
    text$.pipe(
      map((value) => (value ?? '').toString().trim()),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((term) => {
        if (term.length < 2) {
          return of([]);
        }

        this.pickupLookupLoading = true;
        return this.listaPickupService.getAll(term).pipe(
          map((items) =>
            (items ?? [])
              .filter((item) => Number(item?.CR11_Estado ?? 0) === 1)
              .slice(0, 20)
          ),
          catchError(() => of([])),
          finalize(() => {
            this.pickupLookupLoading = false;
          })
        );
      })
    );

  pickupResultFormatter = (item: PickupListaItem): string => (item?.CR11_Nombre || '').toString();

  pickupInputFormatter = (item: PickupListaItem | string | null): string => {
    if (!item) return '';
    return typeof item === 'string' ? item : (item.CR11_Nombre || '').toString();
  };

  getTarifasServicio(codServicio: string, actividadActual?: ActividadDetalle) {
    const codLstPrecio = (this.form.controls.codLstPrecio.value || '').trim();

    if (!codLstPrecio) {
      return of(this.buildActividadFallback(codServicio, actividadActual));
    }

    return this.tarifaService.getTarifasServicio({ codLstPrecio, codServicio }).pipe(
      map((result) => {
        const baseActividad = result
          ? this.buildActividadFromApi(result, codServicio)
          : this.buildActividadFallback(codServicio, actividadActual);
        return this.mergeActividadConCantidades(baseActividad, actividadActual);
      }),
      catchError(() => of(this.buildActividadFallback(codServicio, actividadActual)))
    );
  }

  private cargarServiciosDetalleGeneral(): void {
    this.captureCurrentPageState();

    const codLstPrecio = (this.form.controls.codLstPrecio.value || '').trim();
    if (!codLstPrecio) {
      this.tarifaError = 'Seleccione la lista de precios en el encabezado para mostrar tarifas reales por servicio.';
      this.serviciosPageItemsCount = this.actividadesArray.length;
      this.serviciosPageHasNext = false;
      return;
    }

    this.tarifaError = '';
    this.tarifasLoading = true;
    const nombreServicio = (this.servicioSearchControl.value || '').trim();

    this.tarifaService
      .getTarifasServicioDetalle({
        codLstPrecio,
        nombreServicio,
        pageNumber: this.serviciosPageNumber,
        pageSize: this.serviciosPageSize
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.tarifasLoading = false;
        })
      )
      .subscribe({
        next: (items) => {
          const actividades = (items ?? []).map((item) => this.mergeActividadConCantidades(this.buildActividadFromApi(item, item.CodServicio), this.getActividadFromState(item.CodServicio)));
          this.serviciosPageItemsCount = actividades.length;
          this.serviciosPageHasNext = actividades.length === this.serviciosPageSize;
          this.setActividades(actividades);
        },
        error: () => {
          this.serviciosPageItemsCount = 0;
          this.serviciosPageHasNext = false;
          this.tarifaError = 'No se pudieron cargar los servicios para la lista de precios seleccionada.';
          this.setActividades([]);
        }
      });
  }

  calcularTotales(index?: number): void {
    if (typeof index === 'number' && index >= 0 && index < this.actividadesArray.length) {
      this.calcularTotalesLinea(this.actividadesArray.at(index));
    } else {
      this.actividadesArray.controls.forEach((group) => this.calcularTotalesLinea(group));
    }

    this.captureCurrentPageState();
    const serviciosSeleccionados = this.getAllActividadesValue().filter((actividad) => this.hasActividadCantidad(actividad));
    this.subTotal = this.roundCurrency(
      serviciosSeleccionados.reduce((sum, actividad) => sum + (Number(actividad.totalLinea ?? 0) || 0), 0)
    );

    const descuentoActivo = this.comboActivo && serviciosSeleccionados.length >= 2;
    if (!descuentoActivo) {
      this.comboActivo = false;
      this.porDescuentoInput = 0;
      this.descuentoMontoInput = 0;
    }
    const totalFinalSinDescuento = this.getTotalFinalSinDescuento();
    this.porDescuento = descuentoActivo ? this.porDescuentoInput : 0;
    this.descuento = descuentoActivo
      ? this.roundCurrency(Math.min(this.descuentoMontoInput, totalFinalSinDescuento))
      : 0;
    const descuentoBase = descuentoActivo
      ? this.convertFinalDiscountToBaseDiscount(this.descuento)
      : 0;

    const totals = calculateFiscalTotals(this.subTotal, descuentoBase, '0', {
      pricesIncludeTax: FISCAL_CONFIG.pricesIncludeTax,
      taxRate: FISCAL_CONFIG.taxRate,
      redondeoDecimales: 2
    });

    this.neto = totals.neto;
    this.impuesto = totals.iva;
    this.montoServicio = totals.total;

    this.form.controls.totalGeneral.setValue(this.montoServicio, { emitEvent: false });
    if (this.actividadForm) {
      this.actividadForm.montoServicio = this.montoServicio;
      this.actividadForm.totalGeneral = this.montoServicio;
    }
  }

  construirPayload(): ActividadDetallePayload[] {
    const raw = this.form.getRawValue();
    const horaServicio = (raw.horaInicio || raw.horaPickup || '').trim();
    const horaPickup = (raw.horaPickup || '').trim();
    const actividades = this.getAllActividadesValue();

    return actividades
      .filter((actividad) => this.hasActividadCantidad(actividad))
      .map((actividad) => {
        const detallesPax = (actividad.tarifas ?? [])
          .filter((tarifa) => Number(tarifa.cantidad ?? 0) > 0)
          .map((tarifa) => ({
            tipoPax: this.resolveTarifaTipoPax(tarifa),
            cantidad: Number(tarifa.cantidad ?? 0) || 0,
            precioNeto: Number(tarifa.total ?? 0) || 0
          }));

        const adultos = this.getCantidadByTipoPax(actividad.tarifas, ['PAX', 'ADT', 'ADL']);
        const ninos = this.getCantidadByTipoPax(actividad.tarifas, ['CHL', 'NIN']);

        return {
          codServicio: actividad.codServicio,
          nomServicio: actividad.nomServicio,
          tipoServicio: this.resolveTipoServicioValue(actividad.tipoServicio, 'TOUR'),
          fecServicio: raw.fechaServicio,
          horaServicio,
          horaPickup,
          reglaPrecioID: actividad.reglaPrecioID,
          adultos,
          ninos,
          montoServicio: Number(actividad.totalLinea ?? 0) || 0,
          detallesPax
        };
      })
      .filter((item) => item.detallesPax.length > 0);
  }

  onPickupListaSelected(event: { item: PickupListaItem; preventDefault: () => void }): void {
    const pickupItem = event?.item;
    event?.preventDefault?.();
    this.applyPickupSelection({
      id: pickupItem?.CR11_ID,
      nombre: pickupItem?.CR11_Nombre,
      duracion: pickupItem?.CR11_Duracion,
      localizacion: pickupItem?.CR11_Localizacion
    }, 'lista-pickup');
  }

  onPickupDireccionChange(): void {
    const row = this.pickupGroup;
    if (!row) return;

    const direccion = (row.controls.direccion.value || '').trim();
    if (direccion) return;

    row.patchValue(
      {
        google: '',
        placeId: '',
        lat: 0,
        lng: 0,
        error: ''
      },
      { emitEvent: false }
    );

    this.recalculateHoraPickup();
  }

  toggleActividad(index: number): void {
    const row = this.actividadesArray.at(index);
    if (!row) return;

    row.controls.expanded.setValue(!row.controls.expanded.value, { emitEvent: false });
  }

  goToPreviousServiciosPage(): void {
    if (this.tarifasLoading || this.serviciosPageNumber <= 1) {
      return;
    }

    this.serviciosPageNumber -= 1;
    this.cargarServiciosDetalleGeneral();
  }

  goToNextServiciosPage(): void {
    if (this.tarifasLoading || !this.serviciosPageHasNext) {
      return;
    }

    this.serviciosPageNumber += 1;
    this.cargarServiciosDetalleGeneral();
  }

  removeActividad(index: number): void {
    if (index < 0 || index >= this.actividadesArray.length) {
      return;
    }

    const codServicio = this.actividadesArray.at(index)?.controls.codServicio.value || '';
    this.actividadesStateMap.delete(this.buildActividadKey(codServicio));
    this.actividadesArray.removeAt(index);
    this.rebindActividadSubscriptions();
    this.calcularTotales();
    this.syncInputModel();
  }

  trackByIndex(index: number): number {
    return index;
  }

  private hydrateFormFromInput(): void {
    this.tarifaError = '';
    this.serviciosPageNumber = 1;
    this.serviciosPageHasNext = false;
    this.serviciosPageItemsCount = 0;
    this.servicioSearchControl.setValue('', { emitEvent: false });

    const today = new Date().toISOString().slice(0, 10);
    this.form.patchValue(
      {
        codPlan: this.resolveDefaultCodPlan(),
        codLstPrecio: this.resolveDefaultCodLstPrecio(),
        fechaServicio: (this.actividadForm?.fechaServicio || today).toString(),
        horaPickup: this.normalizeHoraValue((this.actividadForm?.horaPickup || '').toString()),
        horaInicio: this.normalizeHoraValue((this.actividadForm?.horaInicio || '').toString()),
        observaciones: (this.actividadForm?.observaciones || '').toString(),
        totalGeneral: Number(this.actividadForm?.totalGeneral ?? this.actividadForm?.montoServicio ?? 0) || 0
      },
      { emitEvent: false }
    );

    const pickup = this.getSinglePickupFromInput(this.actividadForm?.pickups ?? []);
    this.resetSinglePickupGroup(pickup);
    if (!(this.form.controls.horaPickup.value || '').toString().trim()) {
      this.recalculateHoraPickup();
    }

    const actividades = this.normalizeActividades(this.actividadForm?.actividades ?? []);
    const totalGeneralGuardado = Number(this.actividadForm?.totalGeneral ?? this.actividadForm?.montoServicio ?? 0) || 0;
    const subtotalGuardado = this.roundCurrency(
      actividades.reduce((sum, actividad) => sum + (Number(actividad?.totalLinea ?? 0) || 0), 0)
    );
    this.comboActivo = actividades.length >= 2 && totalGeneralGuardado > 0 && totalGeneralGuardado < subtotalGuardado;
    if (this.comboActivo && subtotalGuardado > 0) {
      const descGuardado = this.roundCurrency(subtotalGuardado - totalGeneralGuardado);
      this.descuentoMontoInput = descGuardado;
      this.porDescuentoInput = this.roundCurrency((descGuardado / subtotalGuardado) * 100);
    } else {
      this.porDescuentoInput = 0;
      this.descuentoMontoInput = 0;
    }
    this.actividadesStateMap.clear();
    actividades.forEach((actividad) => this.setActividadState(actividad));
    this.setActividades([]);
    this.cargarServiciosDetalleGeneral();
  }

  private ensureTarifaDefaults(): void {
    if (!this.open) return;
    const currentPlan = (this.form.controls.codPlan.value || '').toString().trim();
    const currentLista = (this.form.controls.codLstPrecio.value || '').toString().trim();
    const nextPlan = currentPlan || this.resolveDefaultCodPlan();
    const nextLista = currentLista || this.resolveDefaultCodLstPrecio();
    this.form.patchValue({ codPlan: nextPlan, codLstPrecio: nextLista }, { emitEvent: false });
  }

  private resolveDefaultCodPlan(): string {
    const fromInput = (this.actividadForm?.codPlan || '').toString().trim();
    if (fromInput) return fromInput;
    const first = this.planesTarifas?.[0];
    return first ? String(first.planId) : '';
  }

  private resolveDefaultCodLstPrecio(): string {
    const fromInput = (this.actividadForm?.codLstPrecio || '').toString().trim();
    if (fromInput) return fromInput;
    const first = this.listaPrecios?.[0];
    return first ? String(first.codigo) : '';
  }

  private buildActividadFromApi(apiItem: DetallePrecioServicioApiItem, codServicioFallback: string): ActividadDetalle {
    const modoPrecio = this.getModoPrecioPorPlan(this.form.controls.codPlan.value);
    const apiTarifas = (apiItem?.Precios ?? []).map((row, index) => {
      const tipoPax = this.normalizeTipoPaxCode(row?.tipoPax || row?.tipo || this.tarifaDefaults[index]?.tipoPax || '');
      const tipo = (row?.descripcion || this.mapTipoPaxToLabel(tipoPax) || tipoPax).toString().trim();
      const precioBase = modoPrecio === 'N' ? row?.montoComision : row?.precio;
      return {
        tipoPax,
        tipo,
        precio: Number(precioBase ?? 0) || 0,
        cantidad: 0,
        total: 0
      };
    });
    const tarifas = this.normalizeTarifas(apiTarifas);

    const codServicio = (apiItem?.CodServicio || codServicioFallback || '').toString().trim();
    const servicio = this.servicios.find((item) => item.codReceta === codServicio);

    return {
      codServicio,
      nomServicio: (apiItem?.NomServicio || servicio?.nomReceta || codServicio).toString(),
      tipoServicio: this.resolveTipoServicioValue(apiItem?.TipoServicio, servicio?.codGrupo || servicio?.codCateg || ''),
      reglaPrecioID: Number(apiItem?.ReglaPrecioID ?? 0) || 0,
      tarifas,
      totalLinea: 0
    };
  }

  private buildActividadFallback(codServicio: string, actividadActual?: ActividadDetalle): ActividadDetalle {
    const servicio = this.servicios.find((item) => item.codReceta === codServicio);
    const tarifas = this.normalizeTarifas(actividadActual?.tarifas ?? []);

    return {
      codServicio: (codServicio || '').toString().trim(),
      nomServicio: (servicio?.nomReceta || actividadActual?.nomServicio || codServicio).toString().trim(),
      tipoServicio: this.resolveTipoServicioValue(actividadActual?.tipoServicio, servicio?.codGrupo || servicio?.codCateg || ''),
      reglaPrecioID: Number(actividadActual?.reglaPrecioID ?? 0) || 0,
      tarifas,
      totalLinea: Number(actividadActual?.totalLinea ?? 0) || 0
    };
  }

  private mergeActividadConCantidades(base: ActividadDetalle, existing?: ActividadDetalle): ActividadDetalle {
    if (!existing) {
      return base;
    }

    const qtyByTipo = new Map<string, number>();
    for (const tarifa of existing.tarifas ?? []) {
      const key = this.resolveTarifaTipoPax(tarifa);
      qtyByTipo.set(key, this.normalizeCantidad(tarifa.cantidad));
    }

    const tarifas = (base.tarifas ?? []).map((tarifa) => {
      const tipoPax = this.resolveTarifaTipoPax(tarifa);
      const cantidad = qtyByTipo.get(tipoPax) ?? 0;
      return {
        ...tarifa,
        tipoPax,
        cantidad,
        total: cantidad * (Number(tarifa.precio ?? 0) || 0)
      };
    });

    const totalLinea = tarifas.reduce((sum, tarifa) => sum + (Number(tarifa.total ?? 0) || 0), 0);

    return {
      ...base,
      tarifas,
      totalLinea
    };
  }

  private normalizeTarifaTipo(tipo: string): string {
    return (tipo || '')
      .toString()
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private normalizeTipoPaxCode(code: string): string {
    const normalized = this.normalizeTarifaTipo(code);
    if (!normalized) return '';
    if (normalized === 'ADULTO' || normalized === 'ADULT' || normalized === 'ADT' || normalized === 'ADL') return 'PAX';
    if (normalized === 'NINO' || normalized === 'NINOS' || normalized === 'CHILD' || normalized === 'CHILDS') return 'CHL';
    if (normalized === 'NACIONAL') return 'NAC';
    return normalized;
  }

  private mapTipoPaxToLabel(tipoPax: string): string {
    const normalized = this.normalizeTipoPaxCode(tipoPax);
    const found = this.tarifaDefaults.find((item) => item.tipoPax === normalized);
    if (found) return found.tipo;
    return normalized || 'PAX';
  }

  private resolveTarifaTipoPax(tarifa: Partial<Tarifa>): string {
    const direct = this.normalizeTipoPaxCode((tarifa?.tipoPax || '').toString());
    if (direct) return direct;

    const fromLabel = this.normalizeTarifaTipo((tarifa?.tipo || '').toString());
    if (!fromLabel) return 'PAX';
    if (fromLabel.startsWith('CHL') || fromLabel.startsWith('NIN')) return 'CHL';
    if (fromLabel.startsWith('NAC')) return 'NAC';
    if (fromLabel.startsWith('PAX') || fromLabel.startsWith('ADUL')) return 'PAX';
    return fromLabel;
  }

  private getModoPrecioPorPlan(planId: string | number): 'R' | 'N' {
    const normalized = Number(planId ?? 0) || 0;
    const plan = (this.planesTarifas ?? []).find((item) => Number(item?.planId ?? 0) === normalized);
    const tipo = (plan?.tipoTarifa || '').toString().trim().toUpperCase();
    return tipo === 'N' ? 'N' : 'R';
  }

  private buildDefaultTarifas(): Tarifa[] {
    return this.tarifaDefaults.map((item) => ({
      tipoPax: item.tipoPax,
      tipo: item.tipo,
      precio: 0,
      cantidad: 0,
      total: 0
    }));
  }

  private getOrderedTipoPaxCodes(keys: string[]): string[] {
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const item of this.tarifaDefaults) {
      if (seen.has(item.tipoPax)) continue;
      ordered.push(item.tipoPax);
      seen.add(item.tipoPax);
    }
    for (const key of keys) {
      if (!key || seen.has(key)) continue;
      ordered.push(key);
      seen.add(key);
    }
    return ordered;
  }

  private buildActividadFormGroup(actividad: ActividadDetalle): ActividadDetalleFormGroup {
    const tarifas = (actividad.tarifas ?? []).map((tarifa) => this.buildTarifaFormGroup(tarifa));

    return this.fb.group({
      codServicio: this.fb.control((actividad.codServicio || '').toString(), { nonNullable: true }),
      nomServicio: this.fb.control((actividad.nomServicio || '').toString(), { nonNullable: true }),
      tipoServicio: this.fb.control((actividad.tipoServicio || '').toString(), { nonNullable: true }),
      reglaPrecioID: this.fb.control(Number(actividad.reglaPrecioID ?? 0) || 0, { nonNullable: true }),
      expanded: this.fb.control(false, { nonNullable: true }),
      totalLinea: this.fb.control(Number(actividad.totalLinea ?? 0) || 0, { nonNullable: true }),
      tarifas: this.fb.array<TarifaFormGroup>(tarifas)
    });
  }

  private buildTarifaFormGroup(tarifa: Tarifa): TarifaFormGroup {
    return this.fb.group({
      tipoPax: this.fb.control(this.resolveTarifaTipoPax(tarifa), { nonNullable: true }),
      tipo: this.fb.control((tarifa.tipo || '').toString(), { nonNullable: true }),
      precio: this.fb.control(Number(tarifa.precio ?? 0) || 0, { nonNullable: true }),
      cantidad: this.fb.control(Number(tarifa.cantidad ?? 0) || 0, { nonNullable: true }),
      total: this.fb.control(Number(tarifa.total ?? 0) || 0, { nonNullable: true })
    });
  }

  private buildPickupFormGroup(pickup?: Partial<ActividadPickupForm>): PickupFormGroup {
    return this.fb.group({
      direccion: this.fb.control((pickup?.direccion || '').toString(), { nonNullable: true, validators: [Validators.required] }),
      zona: this.fb.control((pickup?.zona || '').toString(), { nonNullable: true }),
      google: this.fb.control((pickup?.google || '').toString(), { nonNullable: true }),
      placeId: this.fb.control((pickup?.placeId || '').toString(), { nonNullable: true }),
      lat: this.fb.control(Number(pickup?.lat ?? 0) || 0, { nonNullable: true }),
      lng: this.fb.control(Number(pickup?.lng ?? 0) || 0, { nonNullable: true }),
      error: this.fb.control((pickup?.error || '').toString(), { nonNullable: true })
    });
  }

  private buildPickupValue(): ActividadPickupForm {
    return {
      direccion: '',
      zona: '',
      google: '',
      placeId: '',
      lat: 0,
      lng: 0,
      error: ''
    };
  }

  private normalizeActividades(items: ActividadDetalle[]): ActividadDetalle[] {
    if (!Array.isArray(items) || !items.length) {
      return [];
    }

    return items
      .filter((item) => !!(item?.codServicio || '').toString().trim())
      .map((item) => ({
        codServicio: (item.codServicio || '').toString().trim(),
        nomServicio: (item.nomServicio || item.codServicio || '').toString().trim(),
        tipoServicio: this.resolveTipoServicioValue(item.tipoServicio),
        reglaPrecioID: Number(item.reglaPrecioID ?? 0) || 0,
        tarifas: this.normalizeTarifas(item.tarifas),
        totalLinea: Number(item.totalLinea ?? 0) || 0
      }));
  }

  private normalizeTarifas(items: Tarifa[]): Tarifa[] {
    const mapByTipo = new Map<string, Tarifa>();

    for (const item of items ?? []) {
      const tipoPax = this.resolveTarifaTipoPax(item);
      if (!tipoPax) continue;
      mapByTipo.set(tipoPax, {
        tipoPax,
        tipo: (item?.tipo || this.mapTipoPaxToLabel(tipoPax)).toString().trim(),
        precio: Number(item.precio ?? 0) || 0,
        cantidad: Number(item.cantidad ?? 0) || 0,
        total: Number(item.total ?? 0) || 0
      });
    }

    if (!mapByTipo.size) {
      return this.buildDefaultTarifas();
    }

    const orderedCodes = this.getOrderedTipoPaxCodes(Array.from(mapByTipo.keys()));
    return orderedCodes.map((tipoPax) => {
      const current = mapByTipo.get(tipoPax);
      return {
        tipoPax,
        tipo: (current?.tipo || this.mapTipoPaxToLabel(tipoPax)).toString().trim(),
        precio: Number(current?.precio ?? 0) || 0,
        cantidad: Number(current?.cantidad ?? 0) || 0,
        total: Number(current?.total ?? 0) || 0
      };
    });
  }

  private rebindActividadSubscriptions(): void {
    this.actividadesSubscriptions.unsubscribe();
    this.actividadesSubscriptions = new Subscription();

    this.actividadesArray.controls.forEach((group) => {
      const sub = group.controls.tarifas.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
        const index = this.actividadesArray.controls.indexOf(group);
        this.calcularTotales(index >= 0 ? index : undefined);
      });

      this.actividadesSubscriptions.add(sub);
    });
  }

  private calcularTotalesLinea(actividadGroup: ActividadDetalleFormGroup): void {
    let totalLinea = 0;

    actividadGroup.controls.tarifas.controls.forEach((tarifaGroup) => {
      const precio = Number(tarifaGroup.controls.precio.value ?? 0) || 0;
      const cantidad = this.normalizeCantidad(tarifaGroup.controls.cantidad.value);
      const total = cantidad * precio;

      if (tarifaGroup.controls.cantidad.value !== cantidad) {
        tarifaGroup.controls.cantidad.setValue(cantidad, { emitEvent: false });
      }

      tarifaGroup.controls.total.setValue(total, { emitEvent: false });
      totalLinea += total;
    });

    actividadGroup.controls.totalLinea.setValue(totalLinea, { emitEvent: false });
  }

  private normalizeCantidad(value: number): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.floor(numeric);
  }

  private roundCurrency(value: number): number {
    return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100;
  }

  private getTotalFinalSinDescuento(): number {
    const totals = calculateFiscalTotals(this.subTotal, 0, '0', {
      pricesIncludeTax: FISCAL_CONFIG.pricesIncludeTax,
      taxRate: FISCAL_CONFIG.taxRate,
      redondeoDecimales: 2
    });
    return totals.total;
  }

  private convertFinalDiscountToBaseDiscount(finalDiscount: number): number {
    const totalSinDescuento = this.getTotalFinalSinDescuento();
    if (this.subTotal <= 0 || totalSinDescuento <= 0) {
      return 0;
    }
    return this.roundCurrency(Math.min(this.subTotal, Math.max(0, finalDiscount) * (this.subTotal / totalSinDescuento)));
  }

  private resolvePickupRapidoError(error: unknown): string {
    const apiError = error as { error?: { mensaje?: unknown; respuesta?: unknown }; message?: unknown } | null;
    const message =
      apiError?.error?.mensaje ||
      apiError?.error?.respuesta ||
      apiError?.message;

    return (message ?? '').toString().trim() || 'No se pudo crear el pickup rapido.';
  }

  private applyPickupSelection(
    pickup: { id?: unknown; nombre?: unknown; duracion?: unknown; localizacion?: unknown },
    source: 'lista-pickup' | 'pickup-rapido'
  ): void {
    const row = this.pickupGroup;
    if (!row) return;

    const nombre = (pickup?.nombre ?? '').toString();
    const localizacion = (pickup?.localizacion ?? '').toString();
    const duracion = (pickup?.duracion ?? '').toString();
    const id = Number(pickup?.id ?? 0) || 0;

    row.patchValue(
      {
        direccion: nombre,
        zona: localizacion,
        google: safeJsonStringify({
          source,
          id,
          nombre,
          duracion,
          localizacion
        }),
        placeId: id ? String(id) : '',
        lat: 0,
        lng: 0,
        error: ''
      },
      { emitEvent: false }
    );

    this.recalculateHoraPickup(duracion);
  }

  private recalculateHoraPickup(durationOverride?: unknown): void {
    const horaInicio = this.normalizeHoraValue(this.form.controls.horaInicio.value);
    const durationMinutes = this.parsePickupDurationToMinutes(durationOverride) ?? this.getPickupDurationMinutes();

    if (horaInicio && durationMinutes != null) {
      const calculatedHoraPickup = this.subtractMinutesFromHora(horaInicio, durationMinutes);
      if (calculatedHoraPickup) {
        this.form.controls.horaPickup.setValue(calculatedHoraPickup, { emitEvent: false });
      }
    }

    this.syncInputModel();
  }

  private normalizeHoraFields(): void {
    const horaInicio = this.normalizeHoraValue(this.form.controls.horaInicio.value);
    const horaPickup = this.normalizeHoraValue(this.form.controls.horaPickup.value);

    this.form.controls.horaInicio.setValue(horaInicio, { emitEvent: false });
    this.form.controls.horaPickup.setValue(horaPickup, { emitEvent: false });
  }

  private sanitizeHoraInput(value: string | null | undefined): string {
    const raw = (value ?? '').toString().replace(/[^\d:]/g, '');
    const [hoursPart = '', ...rest] = raw.split(':');
    const hours = hoursPart.slice(0, 2);
    const minutes = rest.join('').slice(0, 2);

    if (raw.includes(':')) {
      return `${hours}:${minutes}`;
    }

    return raw.slice(0, 4);
  }

  private normalizeHoraValue(value: string | null | undefined): string {
    const raw = this.sanitizeHoraInput(value).trim();
    if (!raw) return '';

    const colonMatch = raw.match(/^(\d{1,2}):(\d{1,2})$/);
    if (colonMatch) {
      return this.buildHoraValue(colonMatch[1], colonMatch[2]) ?? raw;
    }

    const digits = raw.replace(/\D/g, '');
    if (digits.length === 1) {
      return this.buildHoraValue(digits, '00') ?? raw;
    }

    if (digits.length === 2) {
      const asHour = this.buildHoraValue(digits, '00');
      if (asHour) {
        return asHour;
      }

      return this.buildHoraValue(digits.slice(0, 1), `${digits.slice(1)}0`) ?? raw;
    }

    if (digits.length === 3) {
      return this.buildHoraValue(digits.slice(0, 1), digits.slice(1)) ?? raw;
    }

    if (digits.length === 4) {
      return this.buildHoraValue(digits.slice(0, 2), digits.slice(2)) ?? raw;
    }

    return raw;
  }

  private buildHoraValue(hoursText: string, minutesText: string): string | null {
    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
      return null;
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  private getPickupDurationMinutes(): number | null {
    return this.extractPickupDurationMinutes(this.pickupGroup);
  }

  private extractPickupDurationMinutes(group?: PickupFormGroup | null): number | null {
    if (!group) return null;
    const pickupMeta = safeJsonParse<{ duracion?: unknown }>(group.controls.google.value);
    return this.parsePickupDurationToMinutes(pickupMeta?.duracion);
  }

  private parsePickupDurationToMinutes(value: unknown): number | null {
    const raw = (value ?? '').toString().trim();
    if (!raw) return null;

    const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return null;

    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes >= 60) {
      return null;
    }

    return hours * 60 + minutes;
  }

  private subtractMinutesFromHora(hora: string, minutesToSubtract: number): string {
    const match = (hora || '').toString().trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return '';

    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours >= 24 || minutes < 0 || minutes >= 60) {
      return '';
    }

    const minutesPerDay = 24 * 60;
    const totalMinutes = hours * 60 + minutes;
    const normalizedMinutes = ((totalMinutes - Math.max(0, Math.floor(minutesToSubtract))) % minutesPerDay + minutesPerDay) % minutesPerDay;
    const nextHours = Math.floor(normalizedMinutes / 60);
    const nextMinutes = normalizedMinutes % 60;
    return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
  }

  private getPickupsValue(): ActividadPickupForm[] {
    const group = this.pickupGroup;
    return [group].map((groupItem) => ({
      direccion: (groupItem.controls.direccion.value || '').toString(),
      zona: (groupItem.controls.zona.value || '').toString(),
      google: (groupItem.controls.google.value || '').toString(),
      placeId: (groupItem.controls.placeId.value || '').toString(),
      lat: Number(groupItem.controls.lat.value ?? 0) || 0,
      lng: Number(groupItem.controls.lng.value ?? 0) || 0,
      error: (groupItem.controls.error.value || '').toString()
    }));
  }

  private ensureSinglePickupGroup(): PickupFormGroup {
    if (!this.pickupsArray.length) {
      this.pickupsArray.push(this.buildPickupFormGroup());
    }

    while (this.pickupsArray.length > 1) {
      this.pickupsArray.removeAt(this.pickupsArray.length - 1);
    }

    return this.pickupsArray.at(0);
  }

  private resetSinglePickupGroup(pickup?: Partial<ActividadPickupForm>): void {
    this.pickupsArray.clear();
    this.pickupsArray.push(this.buildPickupFormGroup(pickup));
  }

  private getSinglePickupFromInput(pickups: ActividadPickupForm[]): ActividadPickupForm {
    const firstWithData = (pickups ?? []).find((item) =>
      !!(
        (item?.direccion || '').toString().trim() ||
        (item?.placeId || '').toString().trim() ||
        (item?.google || '').toString().trim()
      )
    );
    return firstWithData ?? this.buildPickupValue();
  }

  private getActividadesValue(): ActividadDetalle[] {
    return this.actividadesArray.controls.map((group) => ({
      codServicio: (group.controls.codServicio.value || '').toString(),
      nomServicio: (group.controls.nomServicio.value || '').toString(),
      tipoServicio: this.resolveTipoServicioValue(group.controls.tipoServicio.value),
      reglaPrecioID: Number(group.controls.reglaPrecioID.value ?? 0) || 0,
      tarifas: group.controls.tarifas.controls.map((tarifaGroup) => ({
        tipoPax: this.normalizeTipoPaxCode((tarifaGroup.controls.tipoPax.value || '').toString()),
        tipo: (tarifaGroup.controls.tipo.value || '').toString(),
        precio: Number(tarifaGroup.controls.precio.value ?? 0) || 0,
        cantidad: Number(tarifaGroup.controls.cantidad.value ?? 0) || 0,
        total: Number(tarifaGroup.controls.total.value ?? 0) || 0
      })),
      totalLinea: Number(group.controls.totalLinea.value ?? 0) || 0
    }));
  }

  private getAllActividadesValue(): ActividadDetalle[] {
    this.captureCurrentPageState();
    return Array.from(this.actividadesStateMap.values()).map((item) => ({
      codServicio: (item.codServicio || '').toString(),
      nomServicio: (item.nomServicio || '').toString(),
      tipoServicio: this.resolveTipoServicioValue(item.tipoServicio),
      reglaPrecioID: Number(item.reglaPrecioID ?? 0) || 0,
      tarifas: this.normalizeTarifas(item.tarifas),
      totalLinea: Number(item.totalLinea ?? 0) || 0
    }));
  }

  private getCantidadByTipoPax(tarifas: Tarifa[], tiposObjetivo: string[]): number {
    const targets = new Set((tiposObjetivo ?? []).map((item) => this.normalizeTipoPaxCode(item)));
    return (tarifas ?? [])
      .filter((tarifa) => targets.has(this.resolveTarifaTipoPax(tarifa)))
      .reduce((sum, tarifa) => sum + (Number(tarifa.cantidad ?? 0) || 0), 0);
  }

  private setActividades(actividades: ActividadDetalle[]): void {
    this.actividadesArray.clear();
    for (const actividad of actividades ?? []) {
      this.actividadesArray.push(this.buildActividadFormGroup(actividad));
    }

    this.rebindActividadSubscriptions();
    this.calcularTotales();
    this.syncInputModel();
  }

  private syncInputModel(): void {
    if (!this.actividadForm) return;

    const raw = this.form.getRawValue();
    const actividades = this.getAllActividadesValue();

    this.actividadForm.codPlan = (raw.codPlan || '').toString();
    this.actividadForm.planTarifa = this.resolvePlanTarifario(raw.codPlan);
    this.actividadForm.codLstPrecio = (raw.codLstPrecio || '').toString();
    this.actividadForm.fechaServicio = raw.fechaServicio;
    this.actividadForm.horaPickup = raw.horaPickup;
    this.actividadForm.horaInicio = raw.horaInicio;
    this.actividadForm.observaciones = raw.observaciones;
    this.actividadForm.pickups = this.getPickupsValue();
    this.actividadForm.actividades = actividades;
    this.actividadForm.totalGeneral = raw.totalGeneral;
    this.actividadForm.montoServicio = raw.totalGeneral;

    const first = actividades[0];
    this.actividadForm.codServicio = first?.codServicio || '';
    this.actividadForm.nomServicio = first?.nomServicio || '';
    this.actividadForm.tipoServicio = first?.tipoServicio || '';
  }

  private onListaPrecioChange(): void {
    this.tarifaError = '';
    this.serviciosPageNumber = 1;
    this.serviciosPageHasNext = false;
    this.serviciosPageItemsCount = 0;
    this.actividadesStateMap.clear();
    this.setActividades([]);
    this.cargarServiciosDetalleGeneral();
  }

  private captureCurrentPageState(): void {
    for (const actividad of this.getActividadesValue()) {
      this.setActividadState(actividad);
    }
  }

  private setActividadState(actividad: ActividadDetalle): void {
    const key = this.buildActividadKey(actividad.codServicio);
    if (!key) return;

    const normalized: ActividadDetalle = {
      codServicio: (actividad.codServicio || '').toString().trim(),
      nomServicio: (actividad.nomServicio || actividad.codServicio || '').toString().trim(),
      tipoServicio: this.resolveTipoServicioValue(actividad.tipoServicio),
      reglaPrecioID: Number(actividad.reglaPrecioID ?? 0) || 0,
      tarifas: this.normalizeTarifas(actividad.tarifas),
      totalLinea: Number(actividad.totalLinea ?? 0) || 0
    };

    if (!this.hasActividadCantidad(normalized)) {
      this.actividadesStateMap.delete(key);
      return;
    }

    this.actividadesStateMap.set(key, normalized);
  }

  private hasActividadCantidad(actividad: ActividadDetalle | null | undefined): boolean {
    return (actividad?.tarifas ?? []).some((tarifa) => Number(tarifa.cantidad ?? 0) > 0);
  }

  private getActividadFromState(codServicio: string): ActividadDetalle | undefined {
    return this.actividadesStateMap.get(this.buildActividadKey(codServicio));
  }

  private buildActividadKey(codServicio: string): string {
    return (codServicio || '').toString().trim().toUpperCase();
  }

  private focusSearchInput(): void {
    setTimeout(() => {
      this.servicioSearchInput?.nativeElement?.focus();
    }, 0);
  }
}
