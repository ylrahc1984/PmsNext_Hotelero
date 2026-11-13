import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, firstValueFrom, map, of, Subject, switchMap, timeout } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';

import { ToastService } from 'src/app/core/services/toast.service';
import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { Nationality } from 'src/app/modules/front-desk/settings/nationalities/models/nationality.model';
import { WalkInOption } from 'src/app/modules/front-desk/walk-in/models/walk-in.model';
import { WalkInService } from 'src/app/modules/front-desk/walk-in/services/walk-in.service';
import { ReservaHospedajeDesgloseHabitacion } from 'src/app/modules/Reservas/reserva-hospedaje-detalle/reserva-hospedaje-detalle.model';
import { ReservaHospedajeDetalleService } from 'src/app/modules/Reservas/reserva-hospedaje-detalle/reserva-hospedaje-detalle.service';
import {
  RoomingListV2ApiResponse,
  RoomingListV2DialogContext,
  RoomingListV2Formulario,
  RoomingListV2GuardarRequest,
  RoomingListV2Huesped,
  RoomingListV2IdentificacionRequest,
  RoomingListV2Resultado
} from '../../models/rooming-list-v2.model';
import { RoomingListV2Service } from '../../services/rooming-list-v2.service';

export interface RoomingListGuestPreview {
  name: string;
  documentType: string;
  document: string;
  nationality: string;
  birthDate: string;
}

@Component({
  selector: 'app-rooming-list-v2-admin-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './rooming-list-v2-admin-dialog.component.html',
  styleUrls: ['./rooming-list-v2-admin-dialog.component.scss']
})
export class RoomingListV2AdminDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly roomingListService = inject(RoomingListV2Service);
  private readonly catalogService = inject(WalkInService);
  private readonly toast = inject(ToastService);
  private readonly reservationDetailService = inject(ReservaHospedajeDetalleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly stayQuery = new Subject<RoomingListV2DialogContext>();
  private stayRequestVersion = 0;

  @Input({ required: true }) context!: RoomingListV2DialogContext;
  @Input() initialGuests: RoomingListGuestPreview[] = [];
  @Output() closed = new EventEmitter<void>();

  readonly guestForm = this.fb.nonNullable.group({
    codNacion: ['', Validators.required],
    tipoDocumento: ['', Validators.required],
    numeroDocumento: ['', Validators.required],
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    tipoPax: this.fb.control<'PAX' | 'CHL'>('PAX', { validators: [Validators.required] }),
    email: ['', Validators.email],
    telefono: ['']
  });

  guests: RoomingListV2Huesped[] = [];
  readonly selectedStay = signal<RoomingListV2DialogContext | null>(null);
  readonly availableStays = signal<RoomingListV2DialogContext[]>([]);
  readonly selectionRequired = signal(false);
  readonly resolvingStays = signal(false);
  readonly noStays = signal(false);
  readonly stayResolutionError = signal('');
  nationalities: Nationality[] = [];
  documentTypes: WalkInOption[] = [];
  loading = false;
  catalogsLoading = true;
  saving = false;
  busyGuestId = '';
  errorMessage = '';
  catalogError = '';
  formVisible = false;
  editingGuest: RoomingListV2Huesped | null = null;

  readonly guestTypes: ReadonlyArray<{ code: 'PAX' | 'CHL'; label: string }> = [
    { code: 'PAX', label: 'Adulto' },
    { code: 'CHL', label: 'Niño' }
  ];

  ngOnInit(): void {
    void this.loadCatalogs();
    this.bindStayQueries();
    this.initializeStay();
  }

  get isBusy(): boolean {
    return this.saving || !!this.busyGuestId;
  }

  get canEdit(): boolean {
    return !!this.selectedStay() && !this.loading && !this.isBusy && !this.catalogsLoading && !this.catalogError;
  }

  get hasUnsavedChanges(): boolean {
    return this.formVisible && this.guestForm.dirty;
  }

  async retryStayResolution(): Promise<void> {
    if (this.context.idDesglose === undefined) await this.resolveReservationStays();
    else {
      const stay = this.selectedStay();
      if (stay) this.loadSelectedStay(stay);
    }
  }

  async selectStay(stay: RoomingListV2DialogContext): Promise<void> {
    if (this.isBusy || !stay.idDesglose?.trim()) return;
    const current = this.selectedStay();
    if (current?.idDesglose === stay.idDesglose) return;
    if (this.hasUnsavedChanges) {
      const answer = await Swal.fire({
        title: 'Descartar cambios sin guardar',
        text: 'Los cambios del formulario actual se perderán al cambiar de estancia.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Descartar y cambiar',
        cancelButtonText: 'Continuar editando',
        confirmButtonColor: '#dc3545'
      });
      if (!answer.isConfirmed || this.isBusy) return;
    }

    this.resetFormState();
    this.loadSelectedStay(stay);
  }

  startCreate(): void {
    if (!this.canEdit) return;
    this.editingGuest = null;
    this.guestForm.reset({
      codNacion: '', tipoDocumento: '', numeroDocumento: '', nombre: '', apellido: '',
      tipoPax: 'PAX', email: '', telefono: ''
    });
    this.formVisible = true;
  }

  startEdit(guest: RoomingListV2Huesped): void {
    if (!this.canEdit) return;
    this.editingGuest = guest;
    this.guestForm.reset({
      codNacion: guest.codNacional,
      tipoDocumento: guest.tipoDocumento,
      numeroDocumento: guest.numeroDocumento,
      nombre: guest.nombre ?? '',
      apellido: guest.apellidos ?? '',
      tipoPax: guest.tipoPax,
      email: guest.email ?? '',
      telefono: guest.motivo ?? ''
    });
    this.formVisible = true;
  }

  cancelForm(): void {
    if (this.isBusy) return;
    this.resetFormState();
  }

  isInvalid(controlName: keyof RoomingListV2Formulario): boolean {
    const control = this.guestForm.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  async saveGuest(): Promise<void> {
    if (!this.canEdit) return;
    this.guestForm.markAllAsTouched();
    if (this.guestForm.invalid) return;

    const original = this.editingGuest;
    const formValue = this.guestForm.getRawValue();
    const request = this.buildSaveRequest(formValue, original);
    this.saving = true;
    this.errorMessage = '';

    try {
      if (original) {
        const response = await firstValueFrom(this.roomingListService.actualizar(original.idRooming, request));
        const confirmed = this.readFunctionalResult(response);
        if (confirmed === false) {
          this.errorMessage = this.getResponseMessage(response, 'El servidor rechazó la actualización.');
          return;
        }

        const refreshed = await this.reloadGuests();
        const updated = this.guests.find((guest) => guest.idRooming === original.idRooming);
        const visibleValuesMatch = !!updated && this.matchesForm(updated, formValue);
        if (!refreshed || (confirmed === null && !visibleValuesMatch)) {
          this.errorMessage = 'No se pudo confirmar la actualización al volver a consultar la estancia.';
          return;
        }

        this.formVisible = false;
        this.editingGuest = null;
        this.toast.success('Huésped actualizado correctamente.', 4000, 'Rooming List');
        return;
      }

      const response = await firstValueFrom(this.roomingListService.registrar(request));
      if (!response?.success || response.data?.exito !== true) {
        this.errorMessage = response?.data?.mensaje || response?.message || 'El servidor no confirmó el registro.';
        return;
      }

      const refreshed = await this.reloadGuests();
      const insertedId = response.data.idRooming;
      const inserted = insertedId
        ? this.guests.some((guest) => guest.idRooming === insertedId)
        : this.guests.some((guest) => this.matchesForm(guest, formValue));
      if (!refreshed || !inserted) {
        this.errorMessage = 'El servidor aceptó el registro, pero no fue posible verificarlo en el listado actualizado.';
        return;
      }

      this.formVisible = false;
      this.editingGuest = null;
      this.toast.success(response.data.mensaje || 'Huésped registrado correctamente.', 4000, 'Rooming List');
      this.guestForm.reset({
        codNacion: '', tipoDocumento: '', numeroDocumento: '', nombre: '', apellido: '',
        tipoPax: 'PAX', email: '', telefono: ''
      });
    } catch (error) {
      this.errorMessage = this.errorText(error, 'No fue posible guardar el huésped.');
    } finally {
      this.saving = false;
    }
  }

  async assignResponsible(guest: RoomingListV2Huesped): Promise<void> {
    const stay = this.selectedStay();
    if (!stay || this.isBusy || this.loading || !this.isActive(guest) || guest.tipoPax !== 'PAX') return;
    const confirmation = await Swal.fire({
      title: 'Asignar huésped responsable',
      text: `¿Desea asignar a ${this.fullName(guest)} como responsable de esta estancia?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Asignar responsable',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1f6bff'
    });
    if (!confirmation.isConfirmed || this.isBusy || !this.isSameStay(stay, this.selectedStay())) return;

    this.busyGuestId = guest.idRooming;
    this.errorMessage = '';
    try {
      const response = await firstValueFrom(this.roomingListService.asignarResponsable(guest.idRooming, this.identificationRequest(stay)));
      const functionalResult = this.readFunctionalResult(response);
      if (functionalResult === false) {
        this.errorMessage = this.getResponseMessage(response, 'El servidor rechazó la asignación del responsable.');
        return;
      }

      const refreshed = await this.reloadGuests();
      const confirmed = this.guests.find((item) => item.idRooming === guest.idRooming)?.esResponsable === true;
      if (!refreshed || (functionalResult === null && !confirmed)) {
        this.errorMessage = 'No se pudo confirmar el responsable en el listado actualizado.';
        return;
      }
      this.toast.success('Responsable actualizado correctamente.', 4000, 'Rooming List');
    } catch (error) {
      this.errorMessage = this.errorText(error, 'No fue posible asignar el responsable.');
    } finally {
      this.busyGuestId = '';
    }
  }

  async deactivate(guest: RoomingListV2Huesped): Promise<void> {
    const stay = this.selectedStay();
    if (!stay || this.isBusy || this.loading || !this.isActive(guest)) return;
    const confirmation = await Swal.fire({
      title: 'Desactivar huésped',
      text: `Se desactivará a ${this.fullName(guest)} en esta estancia.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545'
    });
    if (!confirmation.isConfirmed || this.isBusy || !this.isSameStay(stay, this.selectedStay())) return;

    this.busyGuestId = guest.idRooming;
    this.errorMessage = '';
    try {
      const response = await firstValueFrom(this.roomingListService.desactivar(guest.idRooming, this.identificationRequest(stay)));
      const functionalResult = this.readFunctionalResult(response);
      if (functionalResult === false) {
        this.errorMessage = this.getResponseMessage(response, 'El servidor rechazó la desactivación.');
        return;
      }

      const refreshed = await this.reloadGuests();
      const remaining = this.guests.find((item) => item.idRooming === guest.idRooming);
      const deactivated = !remaining || !this.isActive(remaining);
      if (!refreshed || (functionalResult === null && !deactivated)) {
        this.errorMessage = 'No se pudo confirmar la desactivación en el listado actualizado.';
        return;
      }
      this.toast.success('Huésped desactivado correctamente.', 4000, 'Rooming List');
    } catch (error) {
      this.errorMessage = this.errorText(error, 'No fue posible desactivar al huésped.');
    } finally {
      this.busyGuestId = '';
    }
  }

  fullName(guest: RoomingListV2Huesped): string {
    return [guest.nombre, guest.apellidos].filter((value) => !!value?.trim()).join(' ') || 'Huésped sin nombre';
  }

  isActive(guest: RoomingListV2Huesped): boolean {
    return (guest.estado ?? '').trim().toUpperCase() === 'ACT';
  }

  async close(): Promise<void> {
    if (this.isBusy) return;
    if (this.hasUnsavedChanges) {
      const answer = await Swal.fire({
        title: 'Descartar cambios sin guardar',
        text: 'Los cambios del formulario se perderán al cerrar el Rooming List.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Descartar y cerrar',
        cancelButtonText: 'Continuar editando',
        confirmButtonColor: '#dc3545'
      });
      if (!answer.isConfirmed || this.isBusy) return;
    }
    this.closed.emit();
  }

  private async loadCatalogs(): Promise<void> {
    this.catalogsLoading = true;
    try {
      const [nationalities, documents] = await Promise.all([
        firstValueFrom(this.catalogService.getNacionalidades().pipe(timeout({ first: 20000 }))),
        firstValueFrom(this.catalogService.getTiposDocumento().pipe(timeout({ first: 20000 })))
      ]);
      this.nationalities = nationalities.filter((item) => !!item.CR06_Codigo?.trim() && !!item.CR06_Descripcion?.trim());
      this.documentTypes = documents.filter((item) => !!item.codigo?.trim() && !!item.descripcion?.trim());
      if (!this.nationalities.length || !this.documentTypes.length) {
        this.catalogError = 'No se pudieron cargar los catálogos de nacionalidad y documento. Intente nuevamente.';
      }
    } catch (error) {
      this.catalogError = this.errorText(error, 'No se pudieron cargar los catálogos requeridos.');
    } finally {
      this.catalogsLoading = false;
    }
  }

  private bindStayQueries(): void {
    this.stayQuery.pipe(
      switchMap((stay) => {
        const version = this.stayRequestVersion;
        return this.roomingListService.consultar(stay.codReserva, stay.idDesglose!).pipe(
          timeout({ first: 20000 }),
          map((response) => ({ stay, response, error: null as unknown, version })),
          catchError((error: unknown) => of({ stay, response: null, error, version }))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ stay, response, error, version }) => {
      if (version !== this.stayRequestVersion || !this.isSameStay(stay, this.selectedStay())) return;
      this.loading = false;
      if (error) {
        this.guests = [];
        this.errorMessage = this.errorText(error, 'No se pudo consultar el Rooming List de esta estancia.');
        return;
      }
      if (!response?.success || !Array.isArray(response.data)) {
        this.guests = [];
        this.errorMessage = response?.message || 'La respuesta de Rooming List no tiene el formato esperado.';
        return;
      }
      this.errorMessage = '';
      this.guests = response.data;
    });
  }

  private initializeStay(): void {
    if (this.context.idDesglose !== undefined) {
      if (!this.context.idDesglose.trim()) {
        this.stayResolutionError.set('No se recibió IdDesglose. No se utilizará el número de habitación para reconstruirlo.');
        return;
      }
      const stay = this.completeContext(this.context);
      this.availableStays.set([stay]);
      this.loadSelectedStay(stay);
      return;
    }
    void this.resolveReservationStays();
  }

  private async resolveReservationStays(): Promise<void> {
    if (this.resolvingStays() || this.isBusy) return;
    const codReserva = this.context.codReserva.trim();
    if (!codReserva) {
      this.stayResolutionError.set('No se recibió el código de reserva.');
      return;
    }

    const requestVersion = ++this.stayRequestVersion;
    this.resolvingStays.set(true);
    this.noStays.set(false);
    this.stayResolutionError.set('');
    this.selectionRequired.set(false);
    this.availableStays.set([]);
    this.selectedStay.set(null);
    this.guests = [];
    this.loading = false;
    this.errorMessage = '';

    try {
      const detail = await firstValueFrom(
        this.reservationDetailService.getByReservationCode(codReserva).pipe(timeout({ first: 20000 }), takeUntilDestroyed(this.destroyRef))
      );
      if (requestVersion !== this.stayRequestVersion) return;
      this.resolvingStays.set(false);
      const breakdowns = detail.desgloseHabitaciones ?? [];
      if (!breakdowns.length) {
        this.noStays.set(true);
        return;
      }
      if (breakdowns.some((item) => !item.idDesglose?.trim())) {
        this.stayResolutionError.set('El detalle de reserva no devolvió IdDesglose para todas las estancias. No se reconstruirá desde NumHabita.');
        return;
      }
      const ids = breakdowns.map((item) => item.idDesglose.trim());
      if (new Set(ids).size !== ids.length) {
        this.stayResolutionError.set('El detalle devolvió IdDesglose repetidos; no se puede determinar la estancia de forma segura.');
        return;
      }

      const stays = breakdowns.map((item) => this.contextFromBreakdown(codReserva, item));
      const requestedRoom = this.normalizeRoomNumber(this.context.numHabita);
      if (requestedRoom) {
        const roomMatches = stays.filter((stay) => this.normalizeRoomNumber(stay.numHabita) === requestedRoom);
        const requestedCheckIn = normalizePmsDateDDMMYYYY(this.context.fechaIngreso ?? '');
        const requestedCheckOut = normalizePmsDateDDMMYYYY(this.context.fechaSalida ?? '');
        const dateMatches = roomMatches.filter((stay) =>
          (!requestedCheckIn || !stay.fechaIngreso || normalizePmsDateDDMMYYYY(stay.fechaIngreso) === requestedCheckIn) &&
          (!requestedCheckOut || !stay.fechaSalida || normalizePmsDateDDMMYYYY(stay.fechaSalida) === requestedCheckOut)
        );
        const candidates = dateMatches.length ? dateMatches : roomMatches;
        if (candidates.length !== 1) {
          this.availableStays.set([]);
          this.stayResolutionError.set(
            candidates.length > 1
              ? 'Hay más de una estancia para esta habitación y no se pudo distinguir por fechas.'
              : `No se encontró un desglose para la habitación ${this.context.numHabita}.`
          );
          return;
        }
        this.availableStays.set([candidates[0]]);
        this.loadSelectedStay(candidates[0]);
        return;
      }

      this.availableStays.set(stays);
      if (stays.length === 1) {
        this.loadSelectedStay(stays[0]);
      } else {
        this.selectionRequired.set(true);
      }
    } catch (error) {
      if (requestVersion === this.stayRequestVersion) {
        this.stayResolutionError.set(this.errorText(error, 'No fue posible consultar el detalle de la reserva.'));
      }
    } finally {
      if (requestVersion === this.stayRequestVersion) this.resolvingStays.set(false);
    }
  }

  private contextFromBreakdown(codReserva: string, item: ReservaHospedajeDesgloseHabitacion): RoomingListV2DialogContext {
    return {
      codReserva,
      idDesglose: item.idDesglose,
      numHabita: item.numHabita ?? '',
      categoria: item.catHabita || undefined,
      tipoHabita: item.tipHabita || undefined,
      fechaIngreso: item.fechaIngreso || null,
      fechaSalida: item.fechaSalida || null,
      numPax: item.numPax ?? undefined,
      numChild: item.numChild ?? undefined
    };
  }

  private completeContext(context: RoomingListV2DialogContext): RoomingListV2DialogContext {
    return { ...context, numHabita: context.numHabita ?? '' };
  }

  private normalizeRoomNumber(value: string | number | null | undefined): string {
    const normalized = String(value ?? '').trim().toUpperCase();
    const numeric = Number(normalized);
    return normalized && Number.isFinite(numeric) ? String(numeric) : normalized;
  }

  private loadSelectedStay(stay: RoomingListV2DialogContext): void {
    if (!stay.idDesglose?.trim()) {
      this.stayResolutionError.set('No se recibió IdDesglose. No se utilizará el número de habitación para reconstruirlo.');
      return;
    }
    const completeStay = this.completeContext(stay);
    this.stayRequestVersion++;
    this.selectedStay.set(completeStay);
    this.selectionRequired.set(false);
    this.noStays.set(false);
    this.stayResolutionError.set('');
    this.guests = [];
    this.errorMessage = '';
    this.loading = true;
    this.stayQuery.next(completeStay);
  }

  private isSameStay(left: RoomingListV2DialogContext | null, right: RoomingListV2DialogContext | null): boolean {
    return !!left && !!right && left.codReserva === right.codReserva && left.idDesglose === right.idDesglose;
  }

  private resetFormState(): void {
    this.formVisible = false;
    this.editingGuest = null;
    this.guestForm.reset({
      codNacion: '', tipoDocumento: '', numeroDocumento: '', nombre: '', apellido: '',
      tipoPax: 'PAX', email: '', telefono: ''
    });
    this.guestForm.markAsPristine();
    this.guestForm.markAsUntouched();
  }

  private async reloadGuests(): Promise<boolean> {
    const stay = this.selectedStay();
    if (!stay?.idDesglose) return false;
    const version = this.stayRequestVersion;
    this.loading = true;
    this.errorMessage = '';
    try {
      const response = await firstValueFrom(this.roomingListService.consultar(stay.codReserva, stay.idDesglose).pipe(timeout({ first: 20000 })));
      if (version !== this.stayRequestVersion || !this.isSameStay(stay, this.selectedStay())) return false;
      if (!response?.success || !Array.isArray(response.data)) {
        this.guests = [];
        this.errorMessage = response?.message || 'La respuesta de Rooming List no tiene el formato esperado.';
        return false;
      }
      this.guests = response.data;
      return true;
    } catch (error) {
      if (version !== this.stayRequestVersion || !this.isSameStay(stay, this.selectedStay())) return false;
      this.guests = [];
      this.errorMessage = this.errorText(error, 'No se pudo consultar el Rooming List de esta estancia.');
      return false;
    } finally {
      this.loading = false;
    }
  }

  private buildSaveRequest(form: RoomingListV2Formulario, original: RoomingListV2Huesped | null): RoomingListV2GuardarRequest {
    const stay = this.selectedStay();
    if (!stay?.idDesglose) throw new Error('No se ha seleccionado una estancia válida.');
    return {
      codReserva: stay.codReserva,
      idDesglose: stay.idDesglose,
      codNacion: form.codNacion,
      tipoDocumento: form.tipoDocumento,
      numeroDocumento: form.numeroDocumento,
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      tipoPax: form.tipoPax,
      email: form.email.trim() || null,
      ...(original ? {
        fechaNacimiento: original.fechaNacimiento,
        sexo: original.sexo,
        estadoCivil: original.estadoCivil,
        direccion: original.direccion,
        procede: original.procede,
        medioArribo: original.medioArribo
      } : {}),
      motivo: form.telefono.trim() || null
    };
  }

  private identificationRequest(stay: RoomingListV2DialogContext): RoomingListV2IdentificacionRequest {
    if (!stay.idDesglose) throw new Error('No se ha seleccionado una estancia válida.');
    return { codReserva: stay.codReserva, idDesglose: stay.idDesglose };
  }

  private matchesForm(guest: RoomingListV2Huesped, form: RoomingListV2Formulario): boolean {
    return guest.codNacional === form.codNacion
      && guest.tipoDocumento === form.tipoDocumento
      && guest.numeroDocumento === form.numeroDocumento
      && (guest.nombre ?? '') === form.nombre.trim()
      && (guest.apellidos ?? '') === form.apellido.trim()
      && guest.tipoPax === form.tipoPax
      && (guest.email ?? '') === form.email.trim();
  }

  private readFunctionalResult(response: RoomingListV2ApiResponse<unknown> | null | undefined): boolean | null {
    if (!response) return null;
    if (response.success === false) return false;
    if (response.success !== true) return null;
    const data = response.data;
    if (data && typeof data === 'object' && 'exito' in data && typeof data.exito === 'boolean') return data.exito;
    return null;
  }

  private getResponseMessage(response: RoomingListV2ApiResponse<unknown>, fallback: string): string {
    const data = response.data;
    if (data && typeof data === 'object' && 'mensaje' in data && typeof data.mensaje === 'string') return data.mensaje;
    return response.message || fallback;
  }

  private errorText(error: unknown, fallback: string): string {
    const candidate = error as { status?: number; error?: { message?: string; title?: string }; message?: string };
    if ((error as { name?: string })?.name === 'TimeoutError') {
      return 'La consulta tardó más de 20 segundos. Puede reintentarla.';
    }
    const backendMessage = candidate?.error?.message || candidate?.error?.title;
    if (backendMessage) return backendMessage;
    switch (candidate?.status) {
      case 400: return 'La información enviada no es válida. Revise los campos e intente nuevamente.';
      case 401: return 'La sesión no está autorizada. Vuelva a iniciar sesión e intente nuevamente.';
      case 403: return 'Su usuario no tiene permiso para administrar huéspedes en esta estancia.';
      case 404: return 'No se encontró la reserva, estancia o huésped solicitado.';
      case 409: return 'La información cambió o existe un conflicto. Actualice la lista e intente nuevamente.';
      case 0: return 'No se pudo conectar con el servidor. Verifique la conexión e intente nuevamente.';
      default: return candidate?.message || fallback;
    }
  }
}
