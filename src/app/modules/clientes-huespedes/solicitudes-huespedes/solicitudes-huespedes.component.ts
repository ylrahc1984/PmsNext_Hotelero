import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

import { ToastService } from 'src/app/core/services/toast.service';
import { normalizePmsDateDDMMYYYY, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { RoomingListGuest } from 'src/app/modules/front-desk/check-in-arrivals/models/check-in-arrival.model';
import { CheckInArrivalsService } from 'src/app/modules/front-desk/check-in-arrivals/services/check-in-arrivals.service';
import { InHouseGuest } from 'src/app/modules/front-desk/in-house-guests/models/in-house-guest.model';
import { InHouseGuestsService } from 'src/app/modules/front-desk/in-house-guests/services/in-house-guests.service';
import {
  AccionSolicitudHuesped,
  EstadoSolicitudHuesped,
  SolicitudHuesped,
  SolicitudHuespedCrearRequest,
  SolicitudHuespedKpis,
  SolicitudHuespedTipo
} from './solicitudes-huespedes.models';
import { SolicitudHuespedService } from './solicitudes-huespedes.service';

interface EstadoOption {
  value: EstadoSolicitudHuesped | '';
  label: string;
}

@Component({
  selector: 'app-solicitudes-huespedes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './solicitudes-huespedes.component.html',
  styleUrls: ['./solicitudes-huespedes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SolicitudesHuespedesComponent implements OnInit {
  private readonly service = inject(SolicitudHuespedService);
  private readonly inHouseService = inject(InHouseGuestsService);
  private readonly roomingService = inject(CheckInArrivalsService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly estadoOptions: EstadoOption[] = [
    { value: '', label: 'Todos' },
    { value: 'PEN', label: 'Pendientes' },
    { value: 'ATE', label: 'En atención' },
    { value: 'COM', label: 'Completadas' },
    { value: 'CAN', label: 'Canceladas' }
  ];
  readonly operationForm = this.fb.nonNullable.group({
    observacionInterna: ['', [Validators.maxLength(1000)]]
  });

  readonly filterForm = this.fb.nonNullable.group({ estado: '', area: '' });
  readonly createForm = this.fb.group({
    idDesglose: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    idRooming: this.fb.control<number | null>(null),
    idTipoSolicitud: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    cantidad: this.fb.control<number | null>(null),
    comentario: this.fb.control<string | null>('')
  });
  solicitudes: SolicitudHuesped[] = [];
  filteredSolicitudes: SolicitudHuesped[] = [];
  areas: string[] = [];
  kpis: SolicitudHuespedKpis = { PEN: 0, ATE: 0, COM: 0, CAN: 0 };
  loading = false;
  loadedOnce = false;
  errorMessage = '';
  lastUpdated: Date | null = null;
  operationOpen = false;
  operationBusy = false;
  selectedSolicitud: SolicitudHuesped | null = null;
  selectedAction: AccionSolicitudHuesped | null = null;
  createOpen = false;
  createBusy = false;
  createSubmitted = false;
  inHouseGuests: InHouseGuest[] = [];
  selectedInHouseGuest: InHouseGuest | null = null;
  inHouseLoading = false;
  inHouseError = '';
  requestTypes: SolicitudHuespedTipo[] = [];
  typesLoading = false;
  typesError = '';
  roomingGuests: RoomingListGuest[] = [];
  roomingLoading = false;
  roomingError = '';
  private roomingLoadId = 0;

  ngOnInit(): void {
    this.filterForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.createForm.controls.idTipoSolicitud.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((idTipoSolicitud) => this.updateTypeValidators(idTipoSolicitud));
    this.consultar();
  }

  openCreate(): void {
    if (this.createBusy) return;
    this.resetCreateState();
    this.createOpen = true;
    this.loadInHouseGuests();
    if (!this.requestTypes.length) this.loadRequestTypes();
    queueMicrotask(() => document.querySelector<HTMLElement>('#new-request-room')?.focus());
  }

  closeCreate(): void {
    if (this.createBusy) return;
    this.createOpen = false;
    this.resetCreateState();
  }

  onRoomChange(idDesglose: number | null): void {
    const selected = this.inHouseGuests.find((guest) => guest.idDesglose === Number(idDesglose)) ?? null;
    this.createForm.controls.idDesglose.setValue(selected?.idDesglose ?? null);
    this.selectedInHouseGuest = selected;
    this.createForm.controls.idRooming.reset(null);
    this.roomingGuests = [];
    this.roomingError = '';
    this.loadRoomingList(selected);
  }

  onTypeChange(idTipoSolicitud: number | null): void {
    this.updateTypeValidators(idTipoSolicitud);
  }

  changeQuantity(delta: number): void {
    const current = Number(this.createForm.controls.cantidad.value) || 1;
    this.createForm.controls.cantidad.setValue(Math.max(1, Math.floor(current) + delta));
    this.createForm.controls.cantidad.markAsDirty();
  }

  submitCreate(): void {
    this.createSubmitted = true;
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid || this.createBusy) return;

    const guest = this.selectedInHouseGuest;
    const selectedType = this.selectedType;
    const idDesglose = Number(this.createForm.controls.idDesglose.value);
    const idTipoSolicitud = Number(this.createForm.controls.idTipoSolicitud.value);
    if (!guest || !Number.isInteger(idDesglose) || idDesglose <= 0 || !selectedType || !Number.isInteger(idTipoSolicitud) || idTipoSolicitud <= 0) {
      this.toast.error('Seleccione una habitación y un tipo de solicitud válidos.');
      return;
    }

    const roomingValue = Number(this.createForm.controls.idRooming.value);
    const idRooming = Number.isInteger(roomingValue) && roomingValue > 0 ? roomingValue : null;
    const quantityValue = Number(this.createForm.controls.cantidad.value);
    const cantidad = selectedType.permiteCantidad && Number.isInteger(quantityValue) && quantityValue > 0 ? quantityValue : null;
    const comentarioValue = this.createForm.controls.comentario.value?.trim() ?? '';
    const request: SolicitudHuespedCrearRequest = {
      idDesglose,
      idRooming,
      idTipoSolicitud,
      cantidad,
      comentario: comentarioValue || null
    };

    this.createBusy = true;
    this.service.crear(request).pipe(
      finalize(() => {
        this.createBusy = false;
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toast.success('Solicitud registrada correctamente.');
        this.createBusy = false;
        this.closeCreate();
        this.consultar();
      },
      error: (error: HttpErrorResponse) => {
        this.toast.error(this.backendMessage(error) || 'No fue posible registrar la solicitud.');
      }
    });
  }

  isCreateFieldInvalid(field: 'idDesglose' | 'idTipoSolicitud' | 'cantidad' | 'comentario'): boolean {
    const control = this.createForm.controls[field];
    return control.invalid && (control.touched || this.createSubmitted);
  }

  get selectedType(): SolicitudHuespedTipo | null {
    const id = Number(this.createForm.controls.idTipoSolicitud.value);
    return this.requestTypes.find((type) => type.idTipoSolicitud === id) ?? null;
  }

  formatStayDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value) || '—';
  }

  roomingGuestLabel(guest: RoomingListGuest): string {
    const name = `${guest.nombre || ''} ${guest.apellidos || ''}`.trim();
    return name || `Huésped ${guest.numInterno}`;
  }

  roomingGuestId(value: string): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  consultar(): void {
    if (this.loading) return;
    this.loading = true;
    this.errorMessage = '';
    this.service
      .consultar()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (rows) => {
          this.solicitudes = Array.isArray(rows) ? rows : [];
          this.loadedOnce = true;
          this.lastUpdated = new Date();
          this.buildAreaOptions();
          this.applyFilters();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.backendMessage(error) || 'No fue posible cargar las solicitudes. Intente nuevamente.';
          this.toast.error(this.errorMessage);
        }
      });
  }

  applyFilters(): void {
    const { estado, area } = this.filterForm.getRawValue();
    this.filteredSolicitudes = this.solicitudes.filter((solicitud) =>
      (!estado || solicitud.estado === estado) && (!area || solicitud.area === area)
    );
    this.kpis = this.filteredSolicitudes.reduce<SolicitudHuespedKpis>(
      (summary, solicitud) => ({ ...summary, [solicitud.estado]: summary[solicitud.estado] + 1 }),
      { PEN: 0, ATE: 0, COM: 0, CAN: 0 }
    );
    this.cdr.markForCheck();
  }

  clearFilters(): void {
    this.filterForm.reset({ estado: '', area: '' });
  }

  openOperation(solicitud: SolicitudHuesped, action: AccionSolicitudHuesped): void {
    this.selectedSolicitud = solicitud;
    this.selectedAction = action;
    this.operationForm.reset({ observacionInterna: '' });
    this.operationOpen = true;
    queueMicrotask(() => document.querySelector<HTMLElement>('.request-modal textarea')?.focus());
  }

  closeOperation(): void {
    if (this.operationBusy) return;
    this.operationOpen = false;
    this.selectedSolicitud = null;
    this.selectedAction = null;
  }

  confirmOperation(): void {
    const solicitud = this.selectedSolicitud;
    const action = this.selectedAction;
    if (!solicitud || !action || this.operationForm.invalid || this.operationBusy) return;

    this.operationBusy = true;
    const request = { observacionInterna: this.operationForm.controls.observacionInterna.value.trim() };
    const operation = action === 'atender'
      ? this.service.atender(solicitud.idSolicitud, request)
      : action === 'completar'
        ? this.service.completar(solicitud.idSolicitud, request)
        : this.service.cancelar(solicitud.idSolicitud, request);

    operation.pipe(finalize(() => { this.operationBusy = false; this.cdr.markForCheck(); }), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.success(`Solicitud #${solicitud.idSolicitud} actualizada correctamente.`);
        this.operationBusy = false;
        this.closeOperation();
        this.consultar();
      },
      error: (error: HttpErrorResponse) => {
        const message = this.backendMessage(error) || 'No fue posible actualizar la solicitud.';
        this.toast.error(message);
        this.consultar();
      }
    });
  }

  actionLabel(action: AccionSolicitudHuesped | null): string {
    return action === 'atender' ? 'Poner en atención' : action === 'completar' ? 'Completar' : 'Cancelar';
  }

  statusLabel(status: EstadoSolicitudHuesped): string {
    return { PEN: 'Pendiente', ATE: 'En atención', COM: 'Completada', CAN: 'Cancelada' }[status];
  }

  statusClass(status: EstadoSolicitudHuesped): string {
    return `status-badge status-badge--${status.toLowerCase()}`;
  }

  elapsedLabel(solicitud: SolicitudHuesped): string {
    const minutes = solicitud.minutosDesdeSolicitud;
    if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0) {
      if (minutes < 60) return `Hace ${minutes} min`;
      return `Hace ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
    }
    const date = new Date(solicitud.fechaSolicitud);
    if (Number.isNaN(date.getTime())) return 'Tiempo no disponible';
    return 'Fecha registrada';
  }

  exactDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-CR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  trackById(_: number, solicitud: SolicitudHuesped): number { return solicitud.idSolicitud; }

  private buildAreaOptions(): void {
    this.areas = [...new Set(this.solicitudes.map((item) => item.area?.trim()).filter((area): area is string => Boolean(area)))].sort((a, b) => a.localeCompare(b, 'es'));
  }

  private loadInHouseGuests(): void {
    if (this.inHouseLoading) return;
    this.inHouseLoading = true;
    this.inHouseError = '';
    const today = toPmsDateInputValue(new Date());
    this.inHouseService.getInHouseGuests(normalizePmsDateDDMMYYYY(today), normalizePmsDateDDMMYYYY(today), 'carga').pipe(
      finalize(() => {
        this.inHouseLoading = false;
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.inHouseGuests = response.pax ?? [];
        this.cdr.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.inHouseError = this.backendMessage(error) || 'No fue posible cargar las habitaciones actualmente en casa.';
        this.toast.error(this.inHouseError);
      }
    });
  }

  private loadRequestTypes(): void {
    if (this.typesLoading) return;
    this.typesLoading = true;
    this.typesError = '';
    this.service.consultarTipos().pipe(
      finalize(() => {
        this.typesLoading = false;
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (types) => {
        this.requestTypes = [...types].sort((left, right) => left.orden - right.orden);
        this.cdr.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.typesError = this.backendMessage(error) || 'No fue posible cargar los tipos de solicitud.';
        this.toast.error(this.typesError);
      }
    });
  }

  private loadRoomingList(guest: InHouseGuest | null): void {
    const loadId = ++this.roomingLoadId;
    if (!guest?.codReserva || !guest.numHabita) {
      this.roomingLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.roomingLoading = true;
    this.roomingError = '';
    this.roomingService.getRoomingList(guest.codReserva, guest.numHabita).pipe(
      finalize(() => {
        if (loadId === this.roomingLoadId) {
          this.roomingLoading = false;
          this.cdr.markForCheck();
        }
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (guests) => {
        if (loadId !== this.roomingLoadId) return;
        this.roomingGuests = guests;
        this.cdr.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        if (loadId !== this.roomingLoadId) return;
        this.roomingError = this.backendMessage(error) || 'No fue posible cargar los huéspedes de la habitación.';
        this.toast.error(this.roomingError);
      }
    });
  }

  private updateTypeValidators(idTipoSolicitud: number | null): void {
    const type = this.requestTypes.find((item) => item.idTipoSolicitud === Number(idTipoSolicitud));
    const quantity = this.createForm.controls.cantidad;
    const comment = this.createForm.controls.comentario;

    if (type?.permiteCantidad) {
      quantity.setValidators([Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]);
    } else {
      quantity.clearValidators();
      quantity.reset(null, { emitEvent: false });
    }
    if (type?.requiereComentario) {
      comment.setValidators([Validators.required, Validators.pattern(/\S/)]);
    } else {
      comment.clearValidators();
    }
    quantity.updateValueAndValidity({ emitEvent: false });
    comment.updateValueAndValidity({ emitEvent: false });
    this.cdr.markForCheck();
  }

  private resetCreateState(): void {
    this.createSubmitted = false;
    this.createForm.reset({ idDesglose: null, idRooming: null, idTipoSolicitud: null, cantidad: null, comentario: '' });
    this.selectedInHouseGuest = null;
    this.roomingGuests = [];
    this.roomingError = '';
    this.roomingLoadId++;
    this.updateTypeValidators(null);
  }

  private backendMessage(error: HttpErrorResponse): string {
    if (typeof error.error === 'string') return error.error.trim();
    const body = error.error as { mensaje?: string; message?: string; error?: string } | null;
    return body?.mensaje?.trim() || body?.message?.trim() || body?.error?.trim() || '';
  }
}
