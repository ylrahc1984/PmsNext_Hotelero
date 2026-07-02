import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, forkJoin, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ToastService } from 'src/app/core/services/toast.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { PaxType } from '../settings/pax-types/models/pax-type.model';
import { Nationality } from '../settings/nationalities/models/nationality.model';
import { RoomRackNavigationState } from '../pages/room-rack/models/room-rack-room.model';
import { WalkInAgenciaOption, WalkInGuest, WalkInOption, WalkInRequest, WalkInTarifaOption } from './models/walk-in.model';
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
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

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
    moneda: this.fb.control('USD', { validators: [Validators.required] }),
    planAlimentacion: this.fb.control('', { validators: [Validators.required] }),
    observaciones: this.fb.control('', { validators: [Validators.maxLength(500)] })
  });

  readonly stayValue = signal(this.stayForm.getRawValue());

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
  tarifaSuggestions: WalkInTarifaOption[] = [];

  isCatalogLoading = false;
  isSaving = false;
  showGuestModal = false;
  isEditingGuest = false;
  editingGuestId = '';
  agenciaSearchOpen = false;
  tarifaSearchOpen = false;

  ngOnInit(): void {
    this.patchRoom();
    this.loadCatalogs();
    this.bindStayCalculations();
    this.bindAutocomplete();
  }

  openAddGuestModal(): void {
    this.isEditingGuest = false;
    this.editingGuestId = '';
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
    this.showGuestModal = true;
  }

  closeGuestModal(): void {
    this.showGuestModal = false;
    this.guestForm.markAsUntouched();
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
    this.closeGuestModal();
  }

  deleteGuest(guest: WalkInGuest): void {
    this.guests.update((items) => items.filter((item) => item.id !== guest.id));
  }

  selectAgencia(agencia: WalkInAgenciaOption): void {
    this.stayForm.patchValue(
      {
        agenciaCodigo: agencia.codigo,
        agenciaNombre: `${agencia.codigo} - ${agencia.descripcion}`
      },
      { emitEvent: false }
    );
    this.syncStayValue();
    this.agenciaSuggestions = [];
    this.agenciaSearchOpen = false;
  }

  selectTarifa(tarifa: WalkInTarifaOption): void {
    this.stayForm.patchValue(
      {
        tarifaCodigo: tarifa.codigo,
        tarifaDescripcion: `${tarifa.codigo} - ${tarifa.descripcion}`,
        moneda: tarifa.moneda || this.stayForm.controls.moneda.value,
        tarifaNoche: tarifa.tarifaNoche || this.stayForm.controls.tarifaNoche.value
      },
      { emitEvent: false }
    );
    this.syncStayValue();
    this.tarifaSuggestions = [];
    this.tarifaSearchOpen = false;
  }

  saveWalkIn(): void {
    if (this.stayForm.invalid || !this.selectedRoom() || this.guests().length === 0 || !this.isValidDateRange()) {
      this.stayForm.markAllAsTouched();
      this.toastService.addToast({
        title: 'Validación',
        message: 'Complete la habitación, fechas, tarifa, plan y al menos un huésped.',
        type: 'warning'
      });
      return;
    }

    this.isSaving = true;
    const payload: WalkInRequest = {
      estancia: this.stayForm.getRawValue(),
      huespedes: this.guests(),
      habitacionSeleccionada: this.selectedRoom()
    };

    this.walkInService
      .createWalkIn(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.toastService.addToast({ title: 'Walk In', message: 'Walk In preparado correctamente.', type: 'success' });
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

  private patchRoom(): void {
    const room = this.selectedRoom();
    if (!room) return;

    this.stayForm.controls.habitacion.setValue(room.CR05_NumHab, { emitEvent: false });
    this.stayForm.controls.cantidadPax.setValue(Math.max(Number(room.CR05_NumPax || 1), 1), { emitEvent: false });
    this.syncStayValue();
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
        this.applyDemoDefaults();
        this.isCatalogLoading = false;
      });
  }

  private bindStayCalculations(): void {
    this.stayForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncStayValue());
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
        this.agenciaSuggestions = items;
        this.agenciaSearchOpen = items.length > 0;
      });

    this.stayForm.controls.tarifaDescripcion.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => this.walkInService.searchTarifas(term)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((items) => {
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

  private applyDemoDefaults(): void {
    const agencia = this.walkInService.getDemoAgenciaPrincipal();
    const tarifa = this.walkInService.getDemoTarifas()[0];

    this.stayForm.patchValue(
      {
        agenciaCodigo: agencia.codigo,
        agenciaNombre: `${agencia.codigo} - ${agencia.descripcion}`,
        planAlimentacion: this.planes[0]?.codigo ?? '',
        tarifaCodigo: tarifa.codigo,
        tarifaDescripcion: `${tarifa.codigo} - ${tarifa.descripcion}`,
        tarifaNoche: tarifa.tarifaNoche,
        moneda: tarifa.moneda
      },
      { emitEvent: false }
    );
    this.syncStayValue();
  }

  private syncStayValue(): void {
    this.stayValue.set(this.stayForm.getRawValue());
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
