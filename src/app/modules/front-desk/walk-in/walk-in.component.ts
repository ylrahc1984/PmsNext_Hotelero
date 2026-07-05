import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, forkJoin, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { PaxType } from '../settings/pax-types/models/pax-type.model';
import { Nationality } from '../settings/nationalities/models/nationality.model';
import { RoomRackNavigationState } from '../pages/room-rack/models/room-rack-room.model';
import { WalkInAgenciaOption, WalkInGuest, WalkInOption, WalkInSavePayload, WalkInStay, WalkInTarifaOption } from './models/walk-in.model';
import { WalkInService } from './services/walk-in.service';

interface StayForm {
  fechaEntrada: FormControl<string>;
  fechaSalida: FormControl<string>;
  noches: FormControl<number>;
  habitacion: FormControl<number>;
  cantidadPax: FormControl<number>;
  cantidadChildren: FormControl<number>;
  agenciaCodigo: FormControl<string>;
  agenciaNombre: FormControl<string>;
  tarifaCodigo: FormControl<string>;
  tarifaDescripcion: FormControl<string>;
  tarifaNoche: FormControl<number>;
  moneda: FormControl<string>;
  planAlimentacion: FormControl<string>;
  observaciones: FormControl<string>;
}

interface GuestForm {
  tipoDocumento: FormControl<string>;
  numeroDocumento: FormControl<string>;
  nacionalidad: FormControl<string>;
  nombre: FormControl<string>;
  apellidos: FormControl<string>;
  direccion: FormControl<string>;
  correo: FormControl<string>;
  fechaNacimiento: FormControl<string>;
  tipoPax: FormControl<string>;
  creditoActivo: FormControl<boolean>;
}

interface WalkInDraft {
  stay: WalkInStay;
  guests: WalkInGuest[];
  selectedRoom: RoomRackNavigationState | null;
  updatedAt: string;
}

@Component({
  selector: 'app-walk-in',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './walk-in.component.html',
  styleUrls: ['./walk-in.component.scss']
})
export class WalkInComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly walkInService = inject(WalkInService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly draftStorageKey = 'pmsnext.walk-in.draft';
  private draftRestored = false;

  readonly selectedRoom = signal<RoomRackNavigationState | null>(this.resolveSelectedRoom());
  readonly guests = signal<WalkInGuest[]>([]);
  readonly totalServicios = signal(0);

  readonly stayForm: FormGroup<StayForm> = this.fb.group({
    fechaEntrada: this.fb.control(this.todayAsInputDate(), { validators: [Validators.required] }),
    fechaSalida: this.fb.control(this.addDaysAsInputDate(1), { validators: [Validators.required] }),
    noches: this.fb.control(1, { validators: [Validators.required, Validators.min(1)] }),
    habitacion: this.fb.control(0, { validators: [Validators.required, Validators.min(1)] }),
    cantidadPax: this.fb.control(1, { validators: [Validators.required, Validators.min(1)] }),
    cantidadChildren: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
    agenciaCodigo: this.fb.control(''),
    agenciaNombre: this.fb.control('', { validators: [Validators.maxLength(160)] }),
    tarifaCodigo: this.fb.control('', { validators: [Validators.required] }),
    tarifaDescripcion: this.fb.control('', { validators: [Validators.required, Validators.maxLength(160)] }),
    tarifaNoche: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
    moneda: this.fb.control('', { validators: [Validators.required] }),
    planAlimentacion: this.fb.control('', { validators: [Validators.required] }),
    observaciones: this.fb.control('', { validators: [Validators.maxLength(500)] })
  });

  readonly stayValue = signal(this.stayForm.getRawValue());
  readonly agencyModalSearchControl = this.fb.control('');
  readonly tarifaModalSearchControl = this.fb.control('');
  readonly nationalitySearchControl = this.fb.control('');

  readonly guestForm: FormGroup<GuestForm> = this.fb.group({
    tipoDocumento: this.fb.control('', { validators: [Validators.required] }),
    numeroDocumento: this.fb.control('', { validators: [Validators.required, Validators.maxLength(30)] }),
    nacionalidad: this.fb.control('', { validators: [Validators.required] }),
    nombre: this.fb.control('', { validators: [Validators.required, Validators.maxLength(80)] }),
    apellidos: this.fb.control('', { validators: [Validators.required, Validators.maxLength(120)] }),
    direccion: this.fb.control('', { validators: [Validators.maxLength(220)] }),
    correo: this.fb.control('', { validators: [Validators.email, Validators.maxLength(120)] }),
    fechaNacimiento: this.fb.control('', { validators: [Validators.required] }),
    tipoPax: this.fb.control('', { validators: [Validators.required] }),
    creditoActivo: this.fb.control(false)
  });

  readonly summary = computed(() => {
    const raw = this.stayValue();
    const nights = Number(raw.noches || 0);
    const rate = Number(raw.tarifaNoche || 0);
    const totalHabitacion = nights * rate;
    const servicios = this.totalServicios();

    return {
      habitacion: raw.habitacion,
      noches: nights,
      pax: raw.cantidadPax,
      children: raw.cantidadChildren,
      tarifaNoche: rate,
      totalHabitacion,
      totalServicios: servicios,
      totalIncluido: totalHabitacion + servicios,
      total: totalHabitacion + servicios
    };
  });

  tiposDocumento: WalkInOption[] = [];
  nacionalidades: Nationality[] = [];
  tiposPax: PaxType[] = [];
  planes: WalkInOption[] = [];
  agenciaSuggestions: WalkInAgenciaOption[] = [];
  agencyModalAgencies: WalkInAgenciaOption[] = [];
  tarifaSuggestions: WalkInTarifaOption[] = [];
  tarifaModalTarifas: WalkInTarifaOption[] = [];
  private allTarifas: WalkInTarifaOption[] = [];

  isCatalogLoading = false;
  isSaving = false;
  showGuestModal = false;
  showAgencyModal = false;
  showTarifaModal = false;
  isEditingGuest = false;
  editingGuestId = '';
  agenciaSearchOpen = false;
  agencyModalLoading = false;
  agencyModalError = '';
  agencyModalPage = 1;
  agencyModalPageSize = 10;
  agencyModalTotalRecords = 0;
  agencyModalTotalPages = 0;
  tarifaSearchOpen = false;
  nationalitySearchOpen = false;
  tarifaModalLoading = false;
  tarifaModalError = '';
  tarifaModalPage = 1;
  tarifaModalPageSize = 10;
  tarifaModalTotalRecords = 0;
  tarifaModalTotalPages = 0;

  ngOnInit(): void {
    this.restoreDraft();
    this.patchRoom();
    this.loadCatalogs();
    this.bindStayCalculations();
    this.bindAutocomplete();
  }

  openAddGuestModal(): void {
    this.isEditingGuest = false;
    this.editingGuestId = '';
    this.nationalitySearchControl.setValue('', { emitEvent: false });
    this.nationalitySearchOpen = false;
    this.guestForm.reset({
      tipoDocumento: this.tiposDocumento[0]?.codigo ?? '',
      numeroDocumento: '',
      nacionalidad: '',
      nombre: '',
      apellidos: '',
      direccion: '',
      correo: '',
      fechaNacimiento: '',
      tipoPax: this.tiposPax[0]?.CR03_CodTipo ?? '',
      creditoActivo: false
    });
    this.showGuestModal = true;
  }

  openEditGuestModal(guest: WalkInGuest): void {
    this.isEditingGuest = true;
    this.editingGuestId = guest.id;
    this.guestForm.reset({ ...guest });
    this.nationalitySearchControl.setValue(this.getNationalityLabel(guest.nacionalidad), { emitEvent: false });
    this.nationalitySearchOpen = false;
    this.showGuestModal = true;
  }

  closeGuestModal(): void {
    this.showGuestModal = false;
    this.nationalitySearchOpen = false;
    this.guestForm.markAsUntouched();
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

  openAgenciaSuggestions(): void {
    this.walkInService
      .searchAgencias('')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.agenciaSuggestions = items;
        this.agenciaSearchOpen = items.length > 0;
      });
  }

  openTarifaSuggestions(): void {
    this.walkInService
      .searchTarifas('')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.tarifaSuggestions = items;
        this.tarifaSearchOpen = items.length > 0;
      });
  }

  openNationalitySearch(): void {
    this.nationalitySearchOpen = true;
  }

  onNationalitySearchChange(value: string): void {
    this.nationalitySearchControl.setValue(value, { emitEvent: false });
    this.guestForm.controls.nacionalidad.setValue('');
    this.nationalitySearchOpen = true;
  }

  closeNationalitySearch(): void {
    setTimeout(() => {
      this.nationalitySearchOpen = false;
    }, 120);
  }

  selectNationality(nationality: Nationality): void {
    this.guestForm.controls.nacionalidad.setValue(nationality.CR06_Codigo);
    this.guestForm.controls.nacionalidad.markAsDirty();
    this.guestForm.controls.nacionalidad.markAsTouched();
    this.nationalitySearchControl.setValue(nationality.CR06_Descripcion, { emitEvent: false });
    this.nationalitySearchOpen = false;
  }

  filteredNationalities(): Nationality[] {
    const term = this.normalizeText(this.nationalitySearchControl.value);

    if (!term) {
      return this.nacionalidades.slice(0, 25);
    }

    return this.nacionalidades
      .filter((nationality) =>
        [nationality.CR06_Codigo, nationality.CR06_Descripcion].some((field) => this.normalizeText(field).includes(term))
      )
      .slice(0, 25);
  }

  saveGuest(): void {
    if (this.guestForm.invalid) {
      this.guestForm.markAllAsTouched();
      return;
    }

    const raw = this.guestForm.getRawValue();
    const guest: WalkInGuest = {
      id: this.isEditingGuest ? this.editingGuestId : crypto.randomUUID(),
      ...raw
    };

    this.guests.update((items) =>
      this.isEditingGuest ? items.map((item) => (item.id === guest.id ? guest : item)) : [...items, guest]
    );
    this.persistDraft();
    this.closeGuestModal();
  }

  deleteGuest(guest: WalkInGuest): void {
    this.guests.update((items) => items.filter((item) => item.id !== guest.id));
    this.persistDraft();
  }

  selectAgencia(agencia: WalkInAgenciaOption): void {
    this.stayForm.patchValue(
      {
        agenciaCodigo: agencia.codigo,
        agenciaNombre: this.buildAgenciaLabel(agencia)
      },
      { emitEvent: false }
    );
    this.syncStayValue();
    this.persistDraft();
    this.agenciaSuggestions = [];
    this.agenciaSearchOpen = false;
    this.showAgencyModal = false;
  }

  loadAgencyModalPage(page: number): void {
    const normalizedPage = Math.max(page, 1);
    const searchTerm = this.agencyModalSearchControl.value.trim();
    const pageSize = searchTerm.length >= 2 ? 50 : 10;
    this.agencyModalLoading = true;
    this.agencyModalError = '';

    const request =
      searchTerm.length >= 2
        ? this.walkInService.buscarAgenciasPorNombre(searchTerm, normalizedPage, pageSize)
        : this.walkInService.getAgenciasPaginadas(normalizedPage, pageSize);

    request
      .pipe(
        finalize(() => {
          this.agencyModalLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
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

  selectTarifa(tarifa: WalkInTarifaOption): void {
    this.stayForm.patchValue(
      {
        tarifaCodigo: tarifa.codigo,
        tarifaDescripcion: this.buildTarifaLabel(tarifa),
        moneda: tarifa.moneda,
        tarifaNoche: tarifa.tarifaNoche || this.stayForm.controls.tarifaNoche.value
      },
      { emitEvent: false }
    );
    this.syncStayValue();
    this.persistDraft();
    this.tarifaSuggestions = [];
    this.tarifaSearchOpen = false;
    this.showTarifaModal = false;
  }

  loadTarifasModal(): void {
    this.tarifaModalLoading = true;
    this.tarifaModalError = '';

    this.walkInService
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

  async saveWalkIn(): Promise<void> {
    if (this.stayForm.invalid || !this.selectedRoom() || this.guests().length === 0 || !this.isValidDateRange()) {
      this.stayForm.markAllAsTouched();
      this.toastService.addToast({
        title: 'Validación',
        message: 'Complete la habitación, fechas, tarifa, plan y al menos un huésped.',
        type: 'warning'
      });
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Guardar Walk In',
      text: 'Se registrará el Walk In con la información capturada. ¿Desea continuar?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    this.isSaving = true;
    const payload = this.buildWalkInPayload();

    this.walkInService
      .createWalkIn(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.clearDraft();
          this.toastService.addToast({ title: 'Walk In', message: 'Walk In preparado correctamente.', type: 'success' });
          this.router.navigate(['/front-desk/room-rack']);
        },
        error: () => {
          this.isSaving = false;
          this.toastService.addToast({ title: 'Error', message: 'No se pudo guardar el Walk In.', type: 'error' });
        }
      });
  }

  cancel(): void {
    this.router.navigate(['/front-desk/room-rack']);
  }

  isStayFieldInvalid(field: keyof StayForm): boolean {
    const control = this.stayForm.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  isGuestFieldInvalid(field: keyof GuestForm): boolean {
    const control = this.guestForm.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  getFieldError(control: FormControl<string | number | boolean>): string {
    if (control.errors?.['required']) return 'Campo requerido';
    if (control.errors?.['min']) return 'Valor inválido';
    if (control.errors?.['email']) return 'Correo inválido';
    if (control.errors?.['maxlength']) return 'Longitud máxima excedida';
    return '';
  }

  getNationalityLabel(code: string): string {
    const item = this.nacionalidades.find((nationality) => nationality.CR06_Codigo === code);
    return item?.CR06_Descripcion ?? code;
  }

  getPaxTypeLabel(code: string): string {
    const item = this.tiposPax.find((paxType) => paxType.CR03_CodTipo === code);
    return item?.CR03_Descripcion ?? code;
  }

  trackByGuest(_: number, guest: WalkInGuest): string {
    return guest.id;
  }

  trackByCode(_: number, item: { codigo?: string; CR06_Codigo?: string; CR03_CodTipo?: string }): string {
    return item.codigo ?? item.CR06_Codigo ?? item.CR03_CodTipo ?? '';
  }

  getAgencyModalSearchLabel(): string {
    const term = this.agencyModalSearchControl.value.trim();
    return term ? `Resultados para "${term}"` : 'Agencias registradas';
  }

  getTarifaModalSearchLabel(): string {
    const term = this.tarifaModalSearchControl.value.trim();
    return term ? `Resultados para "${term}"` : 'Tarifas registradas';
  }

  private patchRoom(): void {
    const room = this.selectedRoom();
    if (!room) return;

    if (!this.draftRestored) {
      this.stayForm.controls.habitacion.setValue(room.CR05_NumHab, { emitEvent: false });
      this.stayForm.controls.cantidadPax.setValue(Math.max(Number(room.CR05_NumPax || 1), 1), { emitEvent: false });
    } else if (!this.stayForm.controls.habitacion.value) {
      this.stayForm.controls.habitacion.setValue(room.CR05_NumHab, { emitEvent: false });
    }

    this.syncStayValue();
    this.persistDraft();
  }

  private loadCatalogs(): void {
    this.isCatalogLoading = true;
    forkJoin({
      tiposDocumento: this.walkInService.getTiposDocumento().pipe(catchError(() => of([] as WalkInOption[]))),
      nacionalidades: this.walkInService.getNacionalidades().pipe(catchError(() => of([] as Nationality[]))),
      tiposPax: this.walkInService.getTiposPax().pipe(catchError(() => of([] as PaxType[]))),
      planes: this.walkInService.getPlanes().pipe(catchError(() => of([] as WalkInOption[])))
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ tiposDocumento, nacionalidades, tiposPax, planes }) => {
        this.tiposDocumento = tiposDocumento;
        this.nacionalidades = nacionalidades;
        this.tiposPax = tiposPax;
        this.planes = planes;
        this.applyCatalogDefaults();
        this.isCatalogLoading = false;
      });
  }

  private bindStayCalculations(): void {
    this.stayForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.syncStayValue();
      this.persistDraft();
    });
    this.stayForm.controls.fechaEntrada.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.updateNights());
    this.stayForm.controls.fechaSalida.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.updateNights());
  }

  private bindAutocomplete(): void {
    this.stayForm.controls.agenciaNombre.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => this.walkInService.searchAgencias(term)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((items) => {
        this.clearAgencyCodeIfTypedManually();
        this.agenciaSuggestions = items;
        this.agenciaSearchOpen = items.length > 0;
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

    this.stayForm.controls.tarifaDescripcion.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => this.walkInService.searchTarifas(term)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((items) => {
        this.clearTarifaCodeIfTypedManually();
        this.tarifaSuggestions = items;
        this.tarifaSearchOpen = items.length > 0;
      });
  }

  private updateNights(): void {
    const entrada = new Date(`${this.stayForm.controls.fechaEntrada.value}T00:00:00`);
    const salida = new Date(`${this.stayForm.controls.fechaSalida.value}T00:00:00`);
    const diff = Math.ceil((salida.getTime() - entrada.getTime()) / 86400000);
    this.stayForm.controls.noches.setValue(Math.max(diff, 0), { emitEvent: false });
    this.syncStayValue();
  }

  private applyCatalogDefaults(): void {
    if (this.stayForm.controls.planAlimentacion.value) {
      return;
    }

    this.stayForm.patchValue(
      {
        planAlimentacion: this.planes[0]?.codigo ?? ''
      },
      { emitEvent: false }
    );
    this.syncStayValue();
    this.persistDraft();
  }

  private syncStayValue(): void {
    this.stayValue.set(this.stayForm.getRawValue());
  }

  private buildWalkInPayload(): WalkInSavePayload {
    const raw = this.stayForm.getRawValue();
    const room = this.selectedRoom();
    const operador = this.getOperador();
    const noches = Number(raw.noches || 0);
    const tarifa = Number(raw.tarifaNoche || 0);
    const totalHabitacion = noches * tarifa;
    const habitacion = String(raw.habitacion || room?.CR05_NumHab || '');

    return {
      proceso: 1,
      codReserva: '',
      codAgencia: this.safeString(raw.agenciaCodigo),
      codTarifa: this.safeString(raw.tarifaCodigo),
      codPlan: this.safeString(raw.planAlimentacion),
      fecIngreso: this.formatDateForApi(raw.fechaEntrada),
      fecSalida: this.formatDateForApi(raw.fechaSalida),
      fecCreacion: this.formatDateForApi(new Date()),
      fecConfirma: '',
      fecPrepago: '',
      fecAnulada: '',
      totNoches: noches,
      totDias: noches + 1,
      descripcion: this.safeString(raw.tarifaDescripcion),
      tCambio: 0,
      folio: '',
      estado: '1',
      moneda: this.safeString(raw.moneda),
      totalRsv: this.summary().total,
      observaciones: this.safeString(raw.observaciones),
      procesa: 0,
      numHabitacion: habitacion,
      categoria: this.safeString(room?.CR05_CateHab),
      tipo: this.safeString(room?.CR05_TipoHab),
      numPax: Number(raw.cantidadPax || 0),
      numChild: Number(raw.cantidadChildren || 0),
      lCredito: this.guests().some((guest) => guest.creditoActivo) ? 1 : 0,
      mtoCredito: 0,
      numTarjeta: '',
      vence: '',
      autoriza: '',
      tarifa,
      operador,
      detHab: [
        {
          catHabita: this.safeString(room?.CR05_CateHab),
          tipHabita: this.safeString(room?.CR05_TipoHab),
          cantHab: 1,
          precio: tarifa,
          moneda: this.safeString(raw.moneda),
          total: totalHabitacion,
          cpl: 0,
          impuesto: 0,
          numPax: Number(raw.cantidadPax || 0),
          numChild: Number(raw.cantidadChildren || 0),
          totChild: Number(raw.cantidadChildren || 0),
          cCosto: 'HOSPED',
          orden: 1
        }
      ],
      detInclu: [],
      detSrv: [],
      detRoom: this.guests().map((guest, index) => ({
        numHabita: habitacion,
        codNacional: this.safeString(guest.nacionalidad),
        tipDocu: this.safeString(guest.tipoDocumento),
        numDocu: this.safeString(guest.numeroDocumento),
        nombre: this.safeString(guest.nombre),
        apellidos: this.safeString(guest.apellidos),
        fecNaci: this.formatDateForApi(guest.fechaNacimiento),
        sexo: '',
        estCivil: '',
        tipoPax: this.safeString(guest.tipoPax),
        direccion: this.safeString(guest.direccion),
        email: this.safeString(guest.correo),
        motivo: '',
        procede: '',
        mdoArribo: '',
        orden: index + 1,
        operador
      }))
    };
  }

  private restoreDraft(): void {
    const draft = this.readDraft();
    if (!draft) return;

    const navigationRoom = this.selectedRoom();
    if (navigationRoom && !this.isSameDraftRoom(draft, navigationRoom)) {
      this.clearDraft();
      return;
    }

    if (!navigationRoom && draft.selectedRoom) {
      this.selectedRoom.set(draft.selectedRoom);
    }

    this.stayForm.patchValue(draft.stay, { emitEvent: false });
    this.guests.set(Array.isArray(draft.guests) ? draft.guests : []);
    this.draftRestored = true;
    this.syncStayValue();
  }

  private readDraft(): WalkInDraft | null {
    try {
      const raw = localStorage.getItem(this.draftStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<WalkInDraft>;
      if (!parsed?.stay) return null;

      return {
        stay: parsed.stay as WalkInStay,
        guests: Array.isArray(parsed.guests) ? parsed.guests : [],
        selectedRoom: parsed.selectedRoom ?? null,
        updatedAt: this.safeString(parsed.updatedAt)
      };
    } catch {
      return null;
    }
  }

  private persistDraft(): void {
    try {
      const draft: WalkInDraft = {
        stay: this.stayForm.getRawValue(),
        guests: this.guests(),
        selectedRoom: this.selectedRoom(),
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(this.draftStorageKey, JSON.stringify(draft));
    } catch {
      // Draft persistence should never block the operational flow.
    }
  }

  private clearDraft(): void {
    try {
      localStorage.removeItem(this.draftStorageKey);
    } catch {
      // Ignore storage cleanup errors.
    }
  }

  private isSameDraftRoom(draft: WalkInDraft, room: RoomRackNavigationState): boolean {
    const draftRoom = Number(draft.selectedRoom?.CR05_NumHab || draft.stay?.habitacion || 0);
    return draftRoom === Number(room.CR05_NumHab || 0);
  }

  private getOperador(): string {
    const user = this.authService.getCurrentUser();
    return this.safeString(user?.usuario || user?.nombre || 'SISTEMA');
  }

  private safeString(value: unknown): string {
    return value == null ? '' : String(value).trim();
  }

  private normalizeText(value: unknown): string {
    return this.safeString(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private formatDateForApi(value: unknown): string {
    const text = this.safeString(value);
    if (!text) return '';

    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
      return text;
    }

    const date = value instanceof Date ? value : new Date(text);
    if (Number.isNaN(date.getTime())) {
      return text;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  private buildAgenciaLabel(agencia: WalkInAgenciaOption): string {
    return [agencia.codigo, agencia.descripcion].filter(Boolean).join(' - ');
  }

  private buildTarifaLabel(tarifa: WalkInTarifaOption): string {
    return [tarifa.codigo, tarifa.descripcion].filter(Boolean).join(' - ');
  }

  private applyTarifaModalFilter(page: number): void {
    const filtered = this.walkInService.filterTarifas(this.allTarifas, this.tarifaModalSearchControl.value);
    const totalPages = Math.ceil(filtered.length / this.tarifaModalPageSize);
    const normalizedPage = Math.min(Math.max(page, 1), Math.max(totalPages, 1));
    const start = (normalizedPage - 1) * this.tarifaModalPageSize;

    this.tarifaModalTarifas = filtered.slice(start, start + this.tarifaModalPageSize);
    this.tarifaModalPage = normalizedPage;
    this.tarifaModalTotalRecords = filtered.length;
    this.tarifaModalTotalPages = totalPages;
  }

  private clearAgencyCodeIfTypedManually(): void {
    const codigo = this.stayForm.controls.agenciaCodigo.value.trim();
    const nombre = this.stayForm.controls.agenciaNombre.value.trim();
    if (codigo && !nombre.startsWith(`${codigo} -`)) {
      this.stayForm.controls.agenciaCodigo.setValue('', { emitEvent: false });
      this.syncStayValue();
    }
  }

  private clearTarifaCodeIfTypedManually(): void {
    const codigo = this.stayForm.controls.tarifaCodigo.value.trim();
    const descripcion = this.stayForm.controls.tarifaDescripcion.value.trim();
    if (codigo && !descripcion.startsWith(`${codigo} -`)) {
      this.stayForm.patchValue({ tarifaCodigo: '', tarifaNoche: 0, moneda: '' }, { emitEvent: false });
      this.syncStayValue();
    }
  }

  private getCurrentAgencySearchTerm(): string {
    const value = this.stayForm.controls.agenciaNombre.value.trim();
    const code = this.stayForm.controls.agenciaCodigo.value.trim();
    return code && value.startsWith(`${code} -`) ? value.slice(`${code} -`.length).trim() : value;
  }

  private getCurrentTarifaSearchTerm(): string {
    const value = this.stayForm.controls.tarifaDescripcion.value.trim();
    const code = this.stayForm.controls.tarifaCodigo.value.trim();
    return code && value.startsWith(`${code} -`) ? value.slice(`${code} -`.length).trim() : value;
  }

  private isValidDateRange(): boolean {
    return this.stayForm.controls.noches.value > 0;
  }

  private resolveSelectedRoom(): RoomRackNavigationState | null {
    const state = this.router.getCurrentNavigation()?.extras.state ?? window.history.state;
    const room = state?.['roomRackRoom'] as RoomRackNavigationState | undefined;
    return room ?? null;
  }

  private todayAsInputDate(): string {
    return new Date().toISOString().substring(0, 10);
  }

  private addDaysAsInputDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().substring(0, 10);
  }
}
