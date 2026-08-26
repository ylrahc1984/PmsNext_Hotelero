import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { EMPTY, exhaustMap, firstValueFrom, forkJoin, from, fromEvent, of } from 'rxjs';
import { catchError, finalize, map, mergeMap } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { normalizePmsDateDDMMYYYY, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { ReservaTagAsignado } from 'src/app/modules/Reservas/models/reserva-tag.model';
import { ReservaTagsService } from 'src/app/modules/Reservas/services/reserva-tags.service';
import { ReservationTagListComponent } from 'src/app/modules/Reservas/components/reservation-tags/reservation-tag-list.component';

import {
  CheckInArrival,
  CheckInArrivalKpi,
  CheckInArrivalSortColumn,
  CheckInArrivalSortDirection,
  RoomingListGuest
} from './models/check-in-arrival.model';
import { CheckInArrivalsService } from './services/check-in-arrivals.service';
import { GuestRegistrationPdfService } from './services/guest-registration-pdf.service';
import { Nationality } from '../settings/nationalities/models/nationality.model';
import { WalkInOption } from '../walk-in/models/walk-in.model';
import { WalkInService } from '../walk-in/services/walk-in.service';
import {
  GuestSelfCheckinDialogComponent,
  SelfCheckInGuestSave,
  SelfCheckInOption
} from './components/guest-self-checkin-dialog/guest-self-checkin-dialog.component';

interface CheckInArrivalFilterForm {
  fechaIngreso      : string;
  soloPendientes    : boolean;
  busqueda          : string;
}

interface PaginationOption {
  label     : string;
  value     : number;
}

type RoomingListStatus = 'LOADING' | 'COMPLETE' | 'MISSING' | 'ERROR';

@Component({
  selector: 'app-check-in-arrivals',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GuestSelfCheckinDialogComponent, ReservationTagListComponent],
  templateUrl: './check-in-arrivals.component.html',
  styleUrls: ['./check-in-arrivals.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CheckInArrivalsComponent implements OnInit {
  private readonly arrivalsService = inject(CheckInArrivalsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly walkInService = inject(WalkInService);
  private readonly operationalDateService = inject(OperationalDateService);
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly guestRegistrationPdf = inject(GuestRegistrationPdfService);
  private readonly reservaTagsService = inject(ReservaTagsService);
  private operationalDateInput = '';

  readonly pageSizeOptions: PaginationOption[] = [
    { label: '10', value: 10 },
    { label: '20', value: 20 },
    { label: '50', value: 50 }
  ];

  readonly columns: { label: string; key: CheckInArrivalSortColumn }[] = [
    { label: 'Habitacion', key: 'numHabita' },
    { label: 'Categoria', key: 'catHabita' },
    { label: 'Tipo', key: 'tipHabita' },
    { label: 'Reserva', key: 'codReserva' },
    { label: 'Agencia', key: 'nomAgencia' },
    { label: 'Descripcion', key: 'descripcion' },
    { label: 'Entrada', key: 'fechaIng' },
    { label: 'Salida', key: 'fechaSal' },
    { label: 'Noches', key: 'totNoches' },
    { label: 'Adultos', key: 'numPax' },
    { label: 'Ninos', key: 'numChild' },
    { label: 'Plan', key: 'codPlan' },
    { label: 'Estado', key: 'estado' }
  ];

  readonly filtersForm = this.fb.nonNullable.group<CheckInArrivalFilterForm>({
    fechaIngreso      : this.getOperationalDateInput(),
    soloPendientes    : true,
    busqueda          : ''
  });

  readonly roomingGuestForm = this.fb.nonNullable.group({
    codNacion       : ['', Validators.required],
    tipDocu         : ['', Validators.required],
    numDocu         : ['', Validators.required],
    nombre          : ['', Validators.required],
    apellido        : ['', Validators.required],
    fecNac          : [this.formatDateInput(new Date()), Validators.required],
    sexo            : [''],
    estCivil        : [''],
    tiPax           : ['PAX', Validators.required],
    direccion       : [''],
    email           : ['', Validators.email],
    motivo          : [''],
    procede         : [''],
    mdoArribo       : ['']
  });

  readonly nationalitySearchControl = this.fb.nonNullable.control('');

  arrivals: CheckInArrival[] = [];
  filteredArrivals: CheckInArrival[] = [];
  pagedArrivals: CheckInArrival[] = [];
  kpis: CheckInArrivalKpi[] = [];
  selectedArrival: CheckInArrival | null = null;

  loading = false;
  reloading = false;
  errorMessage = '';
  page = 1;
  pageSize = 10;
  totalPages = 1;
  sortColumn: CheckInArrivalSortColumn = 'fechaIng';
  sortDirection: CheckInArrivalSortDirection = 'asc';
  activeDetailKey: string | null = null;
  activeActionsMenuKey: string | null = null;
  roomingArrival: CheckInArrival | null = null;
  roomingGuests: RoomingListGuest[] = [];
  roomingLoading = false;
  roomingSaving = false;
  roomingError = '';
  showRoomingForm = false;
  checkingInKey: string | null = null;
  readonly roomingStatusByRoom = new Map<string, RoomingListStatus>();
  readonly tagsByReservation = new Map<string, ReservaTagAsignado[]>();
  readonly tagLoadingReservations = new Set<string>();
  readonly tagErrorReservations = new Set<string>();
  private readonly roomingGuestsByRoom = new Map<string, RoomingListGuest[]>();
  private roomingStatusLoadId = 0;
  private tagLoadId = 0;
  documentTypes: WalkInOption[] = [];
  nationalities: Nationality[] = [];
  selfCheckinNationalities: SelfCheckInOption[] = [];
  nationalitySearchOpen = false;
  selfCheckinArrival: CheckInArrival | null = null;
  selfCheckinGuests: RoomingListGuest[] = [];
  selfCheckinSaving = false;
  selfCheckinError = '';
  private selfCheckinSavedAny = false;
  registrationPrintingKey: string | null = null;

  ngOnInit(): void {
    this.loadRoomingCatalogs();
    this.bindFocusRefresh();
    this.initializeOperationalDate();
  }

  buscar(): void {
    const filters = this.filtersForm.getRawValue();
    const fechaApi = this.formatDateApi(filters.fechaIngreso);

    this.loading = this.arrivals.length === 0;
    this.reloading = this.arrivals.length > 0;
    this.errorMessage = '';

    this.arrivalsService
      .getPendientes(fechaApi, filters.soloPendientes)
      .pipe(
        catchError((error) => {
          console.error('No se pudieron cargar los arribos pendientes.', error);
          this.errorMessage = 'No se pudieron cargar los arribos para la fecha seleccionada.';
          return of([] as CheckInArrival[]);
        }),
        finalize(() => {
          this.loading = false;
          this.reloading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((arrivals) => {
        this.arrivals = arrivals.map((arrival) => this.normalizeArrival(arrival));
        this.loadRoomingStatuses(this.arrivals);
        this.loadReservationTags(this.arrivals);
        this.selectedArrival = this.arrivals[0] ?? null;
        this.activeDetailKey = null;
        this.page = 1;
        this.refreshView();
      });
  }

  limpiar(): void {
    const operationalDate = this.getOperationalDateInput();
    if (!operationalDate) {
      this.handleOperationalDateError();
      return;
    }

    this.filtersForm.setValue({
      fechaIngreso: operationalDate,
      soloPendientes: true,
      busqueda: ''
    });
    this.buscar();
  }

  aplicarBusqueda(): void {
    this.page = 1;
    this.refreshView();
  }

  seleccionarArrival(arrival: CheckInArrival): void {
    this.selectedArrival = arrival;
    this.closeActionsMenu();
  }

  toggleObservacion(arrival: CheckInArrival): void {
    if (!this.hasObservacion(arrival)) {
      return;
    }

    this.toggleReservationDetail(arrival);
  }

  toggleReservationTags(arrival: CheckInArrival): void {
    if (!this.getReservationTags(arrival).length) {
      return;
    }

    this.toggleReservationDetail(arrival);
  }

  toggleActionsMenu(arrival: CheckInArrival): void {
    const key = this.getArrivalKey(arrival);
    this.activeActionsMenuKey = this.activeActionsMenuKey === key ? null : key;
  }

  isActionsMenuOpen(arrival: CheckInArrival): boolean {
    return this.activeActionsMenuKey === this.getArrivalKey(arrival);
  }

  closeActionsMenu(): void {
    this.activeActionsMenuKey = null;
  }

  ordenar(column: CheckInArrivalSortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.refreshView();
  }

  cambiarPageSize(value: string): void {
    this.pageSize = Number(value) || 10;
    this.page = 1;
    this.refreshView();
  }

  paginaAnterior(): void {
    if (this.page <= 1) {
      return;
    }

    this.page -= 1;
    this.refreshPage();
  }

  paginaSiguiente(): void {
    if (this.page >= this.totalPages) {
      return;
    }

    this.page += 1;
    this.refreshPage();
  }

  getSortIcon(column: CheckInArrivalSortColumn): string {
    if (this.sortColumn !== column) {
      return 'unfold_more';
    }

    return this.sortDirection === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
  }

  getRangeLabel(): string {
    if (this.filteredArrivals.length === 0) {
      return '0 de 0';
    }

    const start = (this.page - 1) * this.pageSize + 1;
    const end = Math.min(this.page * this.pageSize, this.filteredArrivals.length);

    return `${start}-${end} de ${this.filteredArrivals.length}`;
  }

  isSelected(arrival: CheckInArrival): boolean {
    return !!this.selectedArrival && this.getArrivalKey(this.selectedArrival) === this.getArrivalKey(arrival);
  }

  isReservationDetailOpen(arrival: CheckInArrival): boolean {
    return this.activeDetailKey === this.getArrivalKey(arrival);
  }

  hasObservacion(arrival: CheckInArrival): boolean {
    return arrival.observacion.trim().length > 0;
  }

  getReservationTags(arrival: CheckInArrival): ReservaTagAsignado[] {
    return this.tagsByReservation.get(this.getReservationCodeKey(arrival.codReserva)) ?? [];
  }

  isReservationTagsLoading(arrival: CheckInArrival): boolean {
    return this.tagLoadingReservations.has(this.getReservationCodeKey(arrival.codReserva));
  }

  hasReservationTagsError(arrival: CheckInArrival): boolean {
    return this.tagErrorReservations.has(this.getReservationCodeKey(arrival.codReserva));
  }

  getHabitacionLabel(arrival: CheckInArrival): string {
    return this.hasHabitacion(arrival) ? arrival.numHabita : 'Sin Habitacion';
  }

  getHabitacionBadgeClass(arrival: CheckInArrival): string {
    return this.hasHabitacion(arrival) ? 'text-bg-success' : 'text-bg-danger';
  }

  getHabitacionBadgeLabel(arrival: CheckInArrival): string {
    return this.hasHabitacion(arrival) ? 'Habitacion Asignada' : 'Sin Habitacion';
  }

  getRoomingListStatus(arrival: CheckInArrival): RoomingListStatus | null {
    if (!this.hasHabitacion(arrival) || Number(arrival.procesado) === 1) return null;
    return this.roomingStatusByRoom.get(this.getRoomingKey(arrival)) ?? 'LOADING';
  }

  getRoomingListBadgeLabel(arrival: CheckInArrival): string {
    const status = this.getRoomingListStatus(arrival);
    if (status === 'COMPLETE') return 'Rooming registrado';
    if (status === 'MISSING') return 'Rooming pendiente';
    if (status === 'ERROR') return 'Rooming no verificado';
    return 'Verificando rooming';
  }

  getRoomingListBadgeClass(arrival: CheckInArrival): string {
    const status = this.getRoomingListStatus(arrival);
    if (status === 'COMPLETE') return 'rooming-status--complete';
    if (status === 'MISSING') return 'rooming-status--missing';
    if (status === 'ERROR') return 'rooming-status--error';
    return 'rooming-status--loading';
  }

  isRoomingListComplete(arrival: CheckInArrival): boolean {
    return this.getRoomingListStatus(arrival) === 'COMPLETE';
  }

  getCheckInDisabledReason(arrival: CheckInArrival): string {
    if (Number(arrival.procesado) === 1) return 'Check-In realizado';
    if (this.checkingInKey === this.getArrivalKey(arrival)) return 'Check-In en proceso';
    if (!this.hasHabitacion(arrival)) return 'Debe asignar una habitación antes del Check-In';
    const roomingStatus = this.getRoomingListStatus(arrival);
    if (roomingStatus === 'MISSING') return 'Debe ingresar al menos un huésped en el rooming list';
    if (roomingStatus === 'ERROR') return 'No fue posible verificar el rooming list';
    if (roomingStatus !== 'COMPLETE') return 'Verificando el rooming list';
    return '';
  }

  formatDisplayDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value) || '-';
  }

  getProcesadoBadgeClass(arrival: CheckInArrival): string {
    return Number(arrival.procesado) === 1 ? 'text-bg-primary' : 'text-bg-warning';
  }

  getProcesadoBadgeLabel(arrival: CheckInArrival): string {
    return Number(arrival.procesado) === 1 ? 'Check In realizado' : 'Pendiente';
  }

  isCheckInDisabled(arrival: CheckInArrival | null): boolean {
    return !arrival || !!this.getCheckInDisabledReason(arrival);
  }

  isCheckingIn(arrival: CheckInArrival): boolean {
    return this.checkingInKey === this.getArrivalKey(arrival);
  }

  async realizarCheckIn(reserva: CheckInArrival): Promise<void> {
    this.closeActionsMenu();
    if (Number(reserva.procesado) === 1 || this.checkingInKey === this.getArrivalKey(reserva)) return;
    if (!this.hasHabitacion(reserva)) {
      await Swal.fire({ title: 'Habitación requerida', text: 'Asigne una habitación antes de realizar el Check-In.', icon: 'warning' });
      return;
    }
    if (!this.isRoomingListComplete(reserva)) {
      const status = this.getRoomingListStatus(reserva);
      await Swal.fire({
        title: status === 'ERROR' ? 'Rooming list no verificado' : 'Rooming list requerido',
        text:
          status === 'ERROR'
            ? 'No fue posible verificar el rooming list. Intente consultarlo nuevamente antes del Check-In.'
            : 'Debe ingresar al menos un huésped en el rooming list antes de realizar el Check-In.',
        icon: 'warning'
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Confirmar Check-In',
      html: `<div style="text-align:left"><p>Se registrará el ingreso de la reserva <strong>${this.escapeHtml(reserva.codReserva)}</strong>.</p><p style="margin:0">Habitación: <strong>${this.escapeHtml(reserva.numHabita)}</strong></p></div>`,
      icon: 'question', showCancelButton: true, confirmButtonText: 'Realizar Check-In', cancelButtonText: 'Cancelar',
      confirmButtonColor: '#198754'
    });
    if (!result.isConfirmed) return;

    const fecIngreso = this.formatCheckInDate(reserva.fechaIng);
    const fecSalida = this.formatCheckInDate(reserva.fechaSal);
    if (!fecIngreso || !fecSalida) {
      await Swal.fire({ title: 'Fechas inválidas', text: 'No fue posible preparar las fechas de ingreso y salida.', icon: 'error' });
      return;
    }

    this.checkingInKey = this.getArrivalKey(reserva);
    this.cdr.markForCheck();
    this.arrivalsService.checkIn({
      proceso: 0,
      numHabitacion: reserva.numHabita,
      categoria: reserva.catHabita,
      tipo: reserva.tipHabita,
      codReserva: reserva.codReserva,
      codAgencia: reserva.codAgencia,
      codTarifa: reserva.codTarifa,
      codPlan: reserva.codPlan,
      fecIngreso,
      fecSalida,
      totNoches: Number(reserva.totNoches) || 0,
      numPax: Number(reserva.numPax) || 0,
      numChild: Number(reserva.numChild) || 0,
      folio: reserva.folio,
      comentarios: reserva.observacion,
      operador: this.authService.getCurrentUser()?.usuario?.trim() || 'admin'
    }).pipe(
      finalize(() => { this.checkingInKey = null; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        void Swal.fire({ title: 'Check-In realizado', text: `La reserva ${reserva.codReserva} fue procesada correctamente.`, icon: 'success', timer: 1800, showConfirmButton: false });
        this.buscar();
      },
      error: (error) => {
        console.error('No se pudo realizar el Check-In.', error);
        void Swal.fire({ title: 'No se pudo realizar el Check-In', text: error?.error?.respuesta || error?.error?.mensaje || 'Intente nuevamente.', icon: 'error' });
      }
    });
  }

  verReserva(reserva: CheckInArrival): void {
    console.log('Ver Reserva', reserva);
  }

  roomingList(reserva: CheckInArrival): void {
    this.closeActionsMenu();
    this.roomingArrival = reserva;
    this.roomingGuests = [];
    this.roomingError = '';
    this.openRoomingGuestForm();
    this.loadRoomingList();
  }

  openSelfCheckIn(reserva: CheckInArrival): void {
    this.closeActionsMenu();
    this.selfCheckinArrival = reserva;
    this.selfCheckinGuests = [];
    this.selfCheckinError = '';
    this.selfCheckinSavedAny = false;
    this.arrivalsService.getRoomingList(reserva.codReserva, reserva.numHabita).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (guests) => {
        if (this.selfCheckinArrival && this.getRoomingKey(this.selfCheckinArrival) === this.getRoomingKey(reserva)) {
          this.selfCheckinGuests = guests;
          this.roomingGuestsByRoom.set(this.getRoomingKey(reserva), guests);
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.selfCheckinError = 'We could not retrieve the previously registered information. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  closeSelfCheckIn(): void {
    if (this.selfCheckinSaving) return;
    if (this.selfCheckinArrival) {
      this.setRoomingStatus(this.selfCheckinArrival, this.selfCheckinGuests.length || this.selfCheckinSavedAny ? 'COMPLETE' : 'MISSING');
    }
    this.selfCheckinArrival = null;
    this.selfCheckinGuests = [];
    this.selfCheckinError = '';
    this.selfCheckinSavedAny = false;
    this.cdr.markForCheck();
  }

  saveSelfCheckInGuest(guest: SelfCheckInGuestSave): void {
    const arrival = this.selfCheckinArrival;
    if (!arrival || this.selfCheckinSaving) return;

    this.selfCheckinSaving = true;
    this.selfCheckinError = '';
    this.arrivalsService.addRoomingListGuest({
      proceso: 0,
      idOpe: '',
      codRsv: arrival.codReserva,
      numHabita: arrival.numHabita,
      codNacion: guest.codigoNacionalidad,
      tipDocu: guest.tipoDocumento,
      numDocu: guest.numeroDocumento,
      nombre: guest.nombre,
      apellido: guest.apellidos,
      fecNac: '',
      sexo: '',
      estCivil: '',
      tiPax: guest.tipoPax,
      direccion: '',
      email: guest.email,
      motivo: guest.telefono,
      procede: '',
      mdoArribo: '',
      orden: guest.orden,
      operador: this.authService.getCurrentUser()?.usuario?.trim() || 'admin'
    }).pipe(
      finalize(() => { this.selfCheckinSaving = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.selfCheckinSavedAny = true;
        this.roomingGuestsByRoom.delete(this.getRoomingKey(arrival));
        this.setRoomingStatus(arrival, 'COMPLETE');
        this.cdr.markForCheck();
      },
      error: () => {
        this.selfCheckinError = 'We could not save your information. Please review the details and try again.';
        this.cdr.markForCheck();
      }
    });
  }

  finishSelfCheckIn(): void {
    if (this.selfCheckinArrival) this.setRoomingStatus(this.selfCheckinArrival, 'COMPLETE');
    this.cdr.markForCheck();
  }

  get selfCheckInHotelName(): string {
    const empresa = this.empresaContext.getSnapshot();
    return empresa?.MA04_Nombre?.trim() || empresa?.MA04_RazonSocial?.trim() || 'Casa Lamia Boutique Hotel';
  }

  closeRoomingList(): void {
    if (this.roomingSaving) return;
    this.roomingArrival = null;
    this.showRoomingForm = false;
    this.nationalitySearchOpen = false;
  }

  openRoomingGuestForm(): void {
    this.roomingGuestForm.reset({
      codNacion: '', tipDocu: '', numDocu: '', nombre: '', apellido: '',
      fecNac: this.formatDateInput(new Date()), sexo: '', estCivil: '', tiPax: 'PAX',
      direccion: '', email: '', motivo: '', procede: '', mdoArribo: ''
    });
    this.nationalitySearchControl.setValue('', { emitEvent: false });
    this.nationalitySearchOpen = false;
    this.showRoomingForm = true;
  }

  openNationalitySearch(): void {
    this.nationalitySearchOpen = true;
  }

  onNationalitySearchChange(value: string): void {
    this.nationalitySearchControl.setValue(value, { emitEvent: false });
    this.roomingGuestForm.controls.codNacion.setValue('');
    this.nationalitySearchOpen = true;
  }

  closeNationalitySearch(): void {
    setTimeout(() => {
      this.nationalitySearchOpen = false;
      this.cdr.markForCheck();
    }, 120);
  }

  selectNationality(nationality: Nationality): void {
    this.roomingGuestForm.controls.codNacion.setValue(nationality.CR06_Codigo);
    this.roomingGuestForm.controls.codNacion.markAsDirty();
    this.roomingGuestForm.controls.codNacion.markAsTouched();
    this.nationalitySearchControl.setValue(nationality.CR06_Descripcion, { emitEvent: false });
    this.nationalitySearchOpen = false;
  }

  filteredNationalities(): Nationality[] {
    const term = this.normalizeText(this.nationalitySearchControl.value);

    if (!term) {
      return this.nationalities.slice(0, 25);
    }

    return this.nationalities
      .filter((nationality) =>
        [nationality.CR06_Codigo, nationality.CR06_Descripcion]
          .some((field) => this.normalizeText(field).includes(term))
      )
      .slice(0, 25);
  }

  saveRoomingGuest(): void {
    const arrival = this.roomingArrival;
    if (!arrival || this.roomingGuestForm.invalid || this.roomingSaving) {
      this.roomingGuestForm.markAllAsTouched();
      return;
    }
    const value = this.roomingGuestForm.getRawValue();
    const operador = this.authService.getCurrentUser()?.usuario?.trim() || 'admin';
    this.roomingSaving = true;
    this.roomingError = '';
    this.arrivalsService.addRoomingListGuest({
      proceso: 0, idOpe: '', codRsv: arrival.codReserva, numHabita: arrival.numHabita,
      ...value, fecNac: this.formatDateApi(value.fecNac), orden: this.roomingGuests.length + 1, operador
    }).pipe(
      finalize(() => { this.roomingSaving = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => { this.openRoomingGuestForm(); this.loadRoomingList(); },
      error: () => { this.roomingError = 'No se pudo guardar el huésped.'; this.cdr.markForCheck(); }
    });
  }

  async deleteRoomingGuest(guest: RoomingListGuest): Promise<void> {
    if (!this.roomingArrival || this.roomingSaving) return;
    const result = await Swal.fire({
      title: 'Eliminar huésped', text: `${guest.nombre} ${guest.apellidos}`, icon: 'warning',
      showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc3545',
      customClass: { container: 'next-confirm-container' }
    });
    if (!result.isConfirmed || !this.roomingArrival) return;
    this.roomingSaving = true;
    this.arrivalsService.deleteRoomingListGuest(guest.numInterno, this.roomingArrival.codReserva).pipe(
      finalize(() => { this.roomingSaving = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => this.loadRoomingList(),
      error: () => { this.roomingError = 'No se pudo eliminar el huésped.'; this.cdr.markForCheck(); }
    });
  }

  trackByRoomingGuest(_: number, guest: RoomingListGuest): string {
    return guest.numInterno;
  }

  private loadRoomingList(): void {
    const arrival = this.roomingArrival;
    if (!arrival) return;
    this.roomingLoading = true;
    this.roomingError = '';
    this.arrivalsService.getRoomingList(arrival.codReserva, arrival.numHabita).pipe(
      finalize(() => { this.roomingLoading = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (guests) => {
        this.roomingGuests = guests;
        this.roomingGuestsByRoom.set(this.getRoomingKey(arrival), guests);
        this.setRoomingStatus(arrival, guests.length > 0 ? 'COMPLETE' : 'MISSING');
        this.cdr.markForCheck();
      },
      error: () => {
        this.roomingError = 'No se pudo consultar el rooming list.';
        this.setRoomingStatus(arrival, 'ERROR');
        this.cdr.markForCheck();
      }
    });
  }

  private loadRoomingStatuses(arrivals: CheckInArrival[]): void {
    const loadId = ++this.roomingStatusLoadId;
    this.roomingStatusByRoom.clear();
    this.roomingGuestsByRoom.clear();
    const uniqueRooms = [
      ...new Map(
        arrivals
          .filter((arrival) => this.hasHabitacion(arrival) && Number(arrival.procesado) !== 1)
          .map((arrival) => [this.getRoomingKey(arrival), arrival])
      ).values()
    ];
    uniqueRooms.forEach((arrival) => this.setRoomingStatus(arrival, 'LOADING'));
    if (!uniqueRooms.length) {
      this.cdr.markForCheck();
      return;
    }

    from(uniqueRooms)
      .pipe(
        mergeMap(
          (arrival) =>
            this.arrivalsService.getRoomingList(arrival.codReserva, arrival.numHabita).pipe(
              map((guests) => ({ arrival, guests, status: guests.length > 0 ? 'COMPLETE' : 'MISSING' }) as const),
              catchError(() => of({ arrival, guests: null, status: 'ERROR' } as const))
            ),
          5
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ arrival, guests, status }) => {
        if (loadId !== this.roomingStatusLoadId) return;
        if (guests) this.roomingGuestsByRoom.set(this.getRoomingKey(arrival), guests);
        this.setRoomingStatus(arrival, status);
        this.cdr.markForCheck();
      });
  }

  private loadReservationTags(arrivals: CheckInArrival[]): void {
    const loadId = ++this.tagLoadId;
    this.tagsByReservation.clear();
    this.tagLoadingReservations.clear();
    this.tagErrorReservations.clear();

    const reservationCodes = [...new Map(
      arrivals
        .map((arrival) => arrival.codReserva.trim())
        .filter(Boolean)
        .map((code) => [this.getReservationCodeKey(code), code])
    ).values()];

    reservationCodes.forEach((code) => this.tagLoadingReservations.add(this.getReservationCodeKey(code)));
    if (!reservationCodes.length) {
      this.cdr.markForCheck();
      return;
    }

    from(reservationCodes)
      .pipe(
        mergeMap(
          (code) => this.reservaTagsService.obtenerTagsReserva(code).pipe(
            map((response) => ({
              code,
              tags: response?.exito && Array.isArray(response.datos)
                ? [...response.datos].sort((left, right) => this.compareReservationTags(left, right))
                : null
            })),
            catchError(() => of({ code, tags: null }))
          ),
          5
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ code, tags }) => {
        if (loadId !== this.tagLoadId) return;
        const key = this.getReservationCodeKey(code);
        this.tagLoadingReservations.delete(key);
        if (tags) {
          this.tagsByReservation.set(key, tags);
        } else {
          this.tagErrorReservations.add(key);
        }
        this.cdr.markForCheck();
      });
  }

  private setRoomingStatus(arrival: CheckInArrival, status: RoomingListStatus): void {
    this.roomingStatusByRoom.set(this.getRoomingKey(arrival), status);
  }

  private loadRoomingCatalogs(): void {
    forkJoin({
      documentTypes: this.walkInService.getTiposDocumento().pipe(catchError(() => of([] as WalkInOption[]))),
      nationalities: this.walkInService.getNacionalidades().pipe(catchError(() => of([] as Nationality[])))
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ documentTypes, nationalities }) => {
      this.documentTypes = documentTypes;
      this.nationalities = nationalities;
      this.selfCheckinNationalities = nationalities.map((item) => ({
        codigo: item.CR06_Codigo,
        descripcion: item.CR06_Descripcion
      }));
      this.cdr.markForCheck();
    });
  }

  async generarHojaRegistro(reserva: CheckInArrival): Promise<void> {
    this.closeActionsMenu();
    const arrivalKey = this.getArrivalKey(reserva);
    if (this.registrationPrintingKey === arrivalKey) return;

    const printWindow = this.guestRegistrationPdf.reservePrintWindow();
    this.registrationPrintingKey = arrivalKey;
    this.cdr.markForCheck();

    try {
      const roomKey = this.getRoomingKey(reserva);
      const cachedGuests = this.roomingGuestsByRoom.get(roomKey);
      const guests = cachedGuests
        ?? await firstValueFrom(
          this.arrivalsService.getRoomingList(reserva.codReserva, reserva.numHabita).pipe(
            takeUntilDestroyed(this.destroyRef)
          )
        );
      if (!cachedGuests) this.roomingGuestsByRoom.set(roomKey, guests);

      await this.guestRegistrationPdf.printRegistrationForm(reserva, guests, { printWindow });
    } catch (error) {
      console.error('No se pudo imprimir la hoja de registro.', error);
      if (printWindow && !printWindow.closed) printWindow.close();
      await Swal.fire({
        title: 'No se pudo imprimir',
        text: 'No fue posible preparar la hoja de registro. Intente nuevamente.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    } finally {
      this.registrationPrintingKey = null;
      this.cdr.markForCheck();
    }
  }

  isRegistrationPrinting(arrival: CheckInArrival): boolean {
    return this.registrationPrintingKey === this.getArrivalKey(arrival);
  }

  imprimirArribos(): void {
    console.log('Imprimir Arribos', this.filteredArrivals);
  }

  asignarHabitacion(reserva: CheckInArrival): void {
    console.log('Asignar Habitacion', reserva);
  }

  volverRoomRack(): void {
    this.router.navigate(['/front-desk/room-rack']);
  }

  trackByReserva(_: number, arrival: CheckInArrival): string {
    return this.getArrivalKey(arrival);
  }

  trackByKpi(_: number, kpi: CheckInArrivalKpi): string {
    return kpi.label;
  }

  trackByColumn(_: number, column: { key: CheckInArrivalSortColumn }): string {
    return column.key;
  }

  private refreshView(): void {
    this.closeActionsMenu();
    this.filteredArrivals = this.sortArrivals(this.filterArrivals(this.arrivals));
    this.kpis = this.buildKpis(this.filteredArrivals);
    this.totalPages = Math.max(1, Math.ceil(this.filteredArrivals.length / this.pageSize));
    this.page = Math.min(this.page, this.totalPages);
    this.refreshPage();
    this.syncSelectedArrival();
  }

  private refreshPage(): void {
    const start = (this.page - 1) * this.pageSize;
    this.pagedArrivals = this.filteredArrivals.slice(start, start + this.pageSize);
  }

  private syncSelectedArrival(): void {
    if (!this.selectedArrival) {
      this.selectedArrival = this.filteredArrivals[0] ?? null;
      return;
    }

    const selectedKey = this.getArrivalKey(this.selectedArrival);
    this.selectedArrival = this.filteredArrivals.find((arrival) => this.getArrivalKey(arrival) === selectedKey) ?? this.filteredArrivals[0] ?? null;
  }

  private getArrivalKey(arrival: CheckInArrival): string {
    return `${arrival.codReserva}-${arrival.numHabita}-${arrival.folio}`;
  }

  private getReservationCodeKey(codReserva: string): string {
    return codReserva.trim().toUpperCase();
  }

  private toggleReservationDetail(arrival: CheckInArrival): void {
    const key = this.getArrivalKey(arrival);
    this.activeDetailKey = this.activeDetailKey === key ? null : key;
  }

  private compareReservationTags(left: ReservaTagAsignado, right: ReservaTagAsignado): number {
    return Number(right.esAlerta) - Number(left.esAlerta)
      || right.prioridad - left.prioridad
      || left.ordenCategoria - right.ordenCategoria
      || left.nombre.localeCompare(right.nombre);
  }

  private getRoomingKey(arrival: CheckInArrival): string {
    return `${arrival.codReserva.trim().toUpperCase()}-${arrival.numHabita.trim().toUpperCase()}`;
  }

  private filterArrivals(arrivals: CheckInArrival[]): CheckInArrival[] {
    const term = this.normalizeText(this.filtersForm.controls.busqueda.value);

    if (!term) {
      return arrivals;
    }

    return arrivals.filter((arrival) => {
      const searchable = [
        arrival.numHabita,
        arrival.codReserva,
        arrival.codAgencia,
        arrival.nomAgencia,
        arrival.descripcion
      ].map((value) => this.normalizeText(value));

      return searchable.some((value) => value.includes(term));
    });
  }

  private sortArrivals(arrivals: CheckInArrival[]): CheckInArrival[] {
    return [...arrivals].sort((left, right) => {
      const leftValue = this.getSortValue(left, this.sortColumn);
      const rightValue = this.getSortValue(right, this.sortColumn);
      const result = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });

      return this.sortDirection === 'asc' ? result : result * -1;
    });
  }

  private getSortValue(arrival: CheckInArrival, column: CheckInArrivalSortColumn): string {
    if (column === 'fechaIng' || column === 'fechaSal') {
      return toPmsDateInputValue(arrival[column]);
    }
    const value = arrival[column];
    return value == null ? '' : String(value);
  }

  private buildKpis(arrivals: CheckInArrival[]): CheckInArrivalKpi[] {
    const habitacionesAsignadas = arrivals.filter((arrival) => this.hasHabitacion(arrival)).length;
    const habitacionesPendientes = arrivals.length - habitacionesAsignadas;

    return [
      { label: 'Arribos del dia', value: arrivals.length, icon: 'flight_land', accent: 'primary' },
      { label: 'Habitaciones asignadas', value: habitacionesAsignadas, icon: 'hotel', accent: 'green' },
      { label: 'Habitaciones pendientes', value: habitacionesPendientes, icon: 'meeting_room', accent: 'amber' },
      { label: 'Pax Adultos', value: this.sumNumeric(arrivals, 'numPax'), icon: 'groups', accent: 'blue' },
      { label: 'Ninos', value: this.sumNumeric(arrivals, 'numChild'), icon: 'child_care', accent: 'burgundy' },
      { label: 'Reservas sin habitacion', value: habitacionesPendientes, icon: 'event_busy', accent: 'muted' }
    ];
  }

  private sumNumeric(arrivals: CheckInArrival[], key: 'numPax' | 'numChild'): number {
    return arrivals.reduce((total, arrival) => total + (Number(arrival[key]) || 0), 0);
  }

  private hasHabitacion(arrival: CheckInArrival): boolean {
    const habitacion = arrival.numHabita.trim().toUpperCase();
    return habitacion.length > 0 && !habitacion.startsWith('HB');
  }

  private normalizeArrival(arrival: CheckInArrival): CheckInArrival {
    return {
      ...arrival,
      numHabita: this.toStringValue(arrival.numHabita),
      catHabita: this.toStringValue(arrival.catHabita),
      tipHabita: this.toStringValue(arrival.tipHabita),
      codReserva: this.toStringValue(arrival.codReserva),
      codTarifa: this.toStringValue(arrival.codTarifa),
      codPlan: this.toStringValue(arrival.codPlan),
      descripcion: this.toStringValue(arrival.descripcion),
      fechaIng: normalizePmsDateDDMMYYYY(arrival.fechaIng),
      fechaSal: normalizePmsDateDDMMYYYY(arrival.fechaSal),
      procesado: Number(arrival.procesado) || 0,
      numPax: Number(arrival.numPax) || 0,
      numChild: Number(arrival.numChild) || 0,
      cpl: Number(arrival.cpl) || 0,
      totNoches: Number(arrival.totNoches) || 0,
      totDias: Number(arrival.totDias) || 0,
      folio: this.toStringValue(arrival.folio),
      estado: this.toStringValue(arrival.estado),
      codAgencia: this.toStringValue(arrival.codAgencia),
      nomAgencia: this.toStringValue(arrival.nomAgencia),
      observacion: this.toStringValue(arrival.observacion)
    };
  }

  private toStringValue(value: unknown): string {
    return value == null ? '' : String(value).trim();
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private formatDateInput(date: Date): string {
    return toPmsDateInputValue(date);
  }

  private formatDateApi(value: string): string {
    return normalizePmsDateDDMMYYYY(value);
  }

  private formatCheckInDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value);
  }

  private initializeOperationalDate(): void {
    this.loading = true;
    this.operationalDateService
      .ensureLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (operationalDate) => {
          const inputDate = toPmsDateInputValue(operationalDate);
          if (!inputDate) {
            this.handleOperationalDateError();
            return;
          }

          this.operationalDateInput = inputDate;
          this.filtersForm.controls.fechaIngreso.setValue(inputDate, { emitEvent: false });
          this.buscar();
        },
        error: () => this.handleOperationalDateError()
      });
  }

  private bindFocusRefresh(): void {
    fromEvent(window, 'focus')
      .pipe(
        exhaustMap(() =>
          this.operationalDateService.refresh().pipe(
            catchError(() => {
              this.errorMessage = 'No se pudo actualizar la fecha operativa al recuperar el foco.';
              this.cdr.markForCheck();
              return EMPTY;
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((operationalDate) => {
        const refreshedInputDate = toPmsDateInputValue(operationalDate);
        if (!refreshedInputDate) {
          this.handleOperationalDateError();
          return;
        }

        const selectedDate = this.filtersForm.controls.fechaIngreso.value;
        if (!selectedDate || selectedDate === this.operationalDateInput) {
          this.filtersForm.controls.fechaIngreso.setValue(refreshedInputDate, { emitEvent: false });
        }
        this.operationalDateInput = refreshedInputDate;
        this.buscar();
      });
  }

  private getOperationalDateInput(): string {
    return toPmsDateInputValue(this.operationalDateService.operationalDate());
  }

  private handleOperationalDateError(): void {
    this.loading = false;
    this.reloading = false;
    this.errorMessage = 'No se pudo obtener la fecha operativa para consultar los arribos.';
    this.arrivals = [];
    this.selectedArrival = null;
    this.refreshView();
    this.cdr.markForCheck();
  }

  private escapeHtml(value: string): string {
    return (value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
  }
}
