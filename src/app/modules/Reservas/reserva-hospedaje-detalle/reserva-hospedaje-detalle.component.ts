import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { distinctUntilChanged, finalize, firstValueFrom, map } from 'rxjs';
import Swal from 'sweetalert2';

import { OperationalAction } from 'src/app/core/models/operational-context.model';
import { OperationalPolicyService } from 'src/app/core/services/operational-policy.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { ReservationTagListComponent } from '../components/reservation-tags/reservation-tag-list.component';
import { ReservationTagSelectorComponent } from '../components/reservation-tags/reservation-tag-selector.component';
import {
  ApiResponse,
  ReservaTagAsignado,
  ReservaTagCatalogo,
  ReservaTagSeleccionado
} from '../models/reserva-tag.model';
import { ReservaTagsService } from '../services/reserva-tags.service';
import {
  ReservaHospedajeDesgloseHabitacion,
  ReservaHospedajeDetalle,
  ReservaHospedajeHabitacionDetalle,
  ReservaHospedajeInclusionDetalle,
  ReservaHospedajeServicioDetalle
} from './reserva-hospedaje-detalle.model';
import { ReservaHospedajeDetalleService } from './reserva-hospedaje-detalle.service';

@Component({
  selector: 'app-reserva-hospedaje-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule, ReservationTagListComponent, ReservationTagSelectorComponent],
  templateUrl: './reserva-hospedaje-detalle.component.html',
  styleUrls: ['./reserva-hospedaje-detalle.component.scss']
})
export class ReservaHospedajeDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ReservaHospedajeDetalleService);
  private readonly tagsService = inject(ReservaTagsService);
  private readonly toastService = inject(ToastService);
  private readonly operationalPolicy = inject(OperationalPolicyService);
  private readonly destroyRef = inject(DestroyRef);
  private reservationRequestId = 0;
  private assignedTagsRequestId = 0;
  private assignedTagsReservationCode = '';

  readonly codReserva = signal('');
  readonly reserva = signal<ReservaHospedajeDetalle | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly assignedReservationTags = signal<ReservaTagAsignado[]>([]);
  readonly isAssignedTagsLoading = signal(false);
  readonly assignedTagsError = signal('');
  readonly showReservationTagsModal = signal(false);
  readonly reservationTagsDetailsOnly = signal(false);
  readonly isSavingReservationTags = signal(false);
  readonly reservationTagsSaveError = signal('');
  readonly removingReservationTagIds = signal<ReadonlySet<number>>(new Set<number>());

  readonly habitaciones = computed(() => this.reserva()?.habitaciones ?? []);
  readonly inclusiones = computed(() => this.reserva()?.inclusiones ?? []);
  readonly servicios = computed(() => this.reserva()?.servicios ?? []);
  readonly desgloseHabitaciones = computed(() => this.reserva()?.desgloseHabitaciones ?? []);
  readonly moneda = computed(() => this.reserva()?.moneda?.trim() || 'USD');

  readonly cantidadHabitaciones = computed(() => this.habitaciones().reduce((total, item) => total + this.toNumber(item.cantHab), 0));
  readonly totalHabitaciones = computed(() => this.habitaciones().reduce((total, item) => total + this.toNumber(item.total), 0));
  readonly totalInclusiones = computed(() => this.inclusiones().reduce((total, item) => total + this.toNumber(item.totServ), 0));
  readonly totalServicios = computed(() => this.servicios().reduce((total, item) => total + this.serviceTotal(item), 0));
  readonly totalImpuestos = computed(() => this.servicios().reduce((total, item) => total + this.toNumber(item.impuesto), 0));
  readonly totalPax = computed(() =>
    this.habitaciones().reduce((total, item) => total + this.toNumber(item.numPax) * this.toNumber(item.cantHab), 0)
  );
  readonly totalNinos = computed(() => this.habitaciones().reduce((total, item) => total + this.toNumber(item.numChild), 0));
  readonly accionesBloqueadas = computed(() => this.esEstadoBloqueado(this.reserva()?.estado));
  readonly puedeGestionarTags = computed(() =>
    Boolean(this.codReserva() && this.reserva())
    && !this.accionesBloqueadas()
    && this.operationalPolicy.can(OperationalAction.UpdateOperation)
  );
  readonly tagsReadOnlyReason = computed(() => {
    if (!this.codReserva() || !this.reserva()) return 'La reserva todavía no está disponible.';
    if (this.accionesBloqueadas()) return 'La reserva se encuentra en modo de solo lectura.';
    return this.operationalPolicy.can(OperationalAction.UpdateOperation)
      ? ''
      : this.operationalPolicy.decision(OperationalAction.UpdateOperation).reason;
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(
      map((params) => params.get('codReserva')?.trim() ?? ''),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((codReserva) => this.activateReservation(codReserva));
  }

  reload(): void {
    const codReserva = this.codReserva();
    if (codReserva) {
      this.loadReserva(codReserva);
      this.loadAssignedReservationTags(codReserva, true);
    }
  }

  async openReservationTagsManagement(): Promise<void> {
    if (this.accionesBloqueadas()) {
      this.toastService.info('La reserva se encuentra en modo de solo lectura.', 4000, 'Etiquetas');
      return;
    }
    if (!(await this.operationalPolicy.require(OperationalAction.UpdateOperation))) return;
    if (!this.codReserva() || !this.reserva()) return;

    this.reservationTagsDetailsOnly.set(false);
    this.reservationTagsSaveError.set('');
    this.showReservationTagsModal.set(true);
  }

  openReservationTagDetails(): void {
    if (!this.assignedReservationTags().length) return;
    this.reservationTagsDetailsOnly.set(true);
    this.reservationTagsSaveError.set('');
    this.showReservationTagsModal.set(true);
  }

  closeReservationTagsModal(): void {
    if (!this.isSavingReservationTags()) this.showReservationTagsModal.set(false);
  }

  retryAssignedReservationTags(): void {
    this.loadAssignedReservationTags(this.codReserva(), true);
  }

  saveReservationTags(selections: ReservaTagSeleccionado[]): void {
    if (this.isSavingReservationTags() || !this.puedeGestionarTags()) return;
    const codReserva = this.cleanText(this.codReserva());
    const normalizedSelections = this.normalizeReservationTagSelections(selections);

    if (!codReserva) {
      this.reservationTagsSaveError.set('No se pudo identificar la reserva activa.');
      return;
    }
    if (!normalizedSelections.length) {
      this.reservationTagsSaveError.set('Seleccione al menos una etiqueta nueva.');
      return;
    }

    const validationError = this.validateReservationTagSelections(normalizedSelections);
    if (validationError) {
      this.reservationTagsSaveError.set(validationError);
      return;
    }

    this.isSavingReservationTags.set(true);
    this.reservationTagsSaveError.set('');
    this.tagsService.guardarTagsBatch(codReserva, {
      tags: normalizedSelections.map((selection) => ({
        idTag: selection.tag.idTag,
        observacion: selection.observacion?.trim().slice(0, 200) || null
      }))
    }).pipe(
      finalize(() => this.isSavingReservationTags.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        if (!this.isSuccessfulTagResponse(response) || !Array.isArray(response.datos)) {
          this.reservationTagsSaveError.set(
            this.cleanTagApiMessage(response?.respuesta) || 'El servidor no confirmó el guardado de las etiquetas.'
          );
          return;
        }
        const byTagId = new Map(this.assignedReservationTags().map((tag) => [tag.idTag, tag]));
        response.datos.forEach((tag) => byTagId.set(tag.idTag, tag));
        this.assignedReservationTags.set([...byTagId.values()].sort((left, right) => this.compareAssignedTags(left, right)));
        this.showReservationTagsModal.set(false);
        this.toastService.success('Etiquetas agregadas correctamente.', 4000, 'Etiquetas');
      },
      error: (error: unknown) => {
        this.reservationTagsSaveError.set(
          this.getReservationTagErrorMessage(error, 'No se pudieron guardar las etiquetas. Intente nuevamente.')
        );
      }
    });
  }

  notifyReservationTagSelection(message: string): void {
    this.toastService.info(message, 3500, 'Etiquetas');
  }

  async removeReservationTag(tag: ReservaTagAsignado): Promise<void> {
    if (tag.tipoAsignacion.toUpperCase() !== 'MANUAL') {
      this.toastService.info('Esta etiqueta es administrada automáticamente por el sistema.', 4000, 'Etiquetas');
      return;
    }
    if (!this.puedeGestionarTags() || this.removingReservationTagIds().has(tag.idTag)) return;

    const result = await Swal.fire<string>({
      title: 'Retirar etiqueta',
      text: `¿Desea retirar la etiqueta “${tag.nombre}” de esta reserva? Esta acción quedará registrada en el historial.`,
      input: 'text',
      inputValue: 'Retirada desde el detalle de la reserva.',
      inputLabel: 'Motivo (opcional)',
      inputAttributes: { maxlength: '200' },
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, retirar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545'
    });
    if (!result.isConfirmed) return;

    const codReserva = this.cleanText(this.codReserva());
    if (!codReserva) return;
    const motivo = this.cleanText(result.value).slice(0, 200) || 'Retirada desde el detalle de la reserva.';
    this.removingReservationTagIds.update((ids) => new Set([...ids, tag.idTag]));
    try {
      const response = await firstValueFrom(
        this.tagsService.retirarTag(codReserva, tag.idTag, motivo).pipe(takeUntilDestroyed(this.destroyRef))
      );
      if (!this.isSuccessfulTagResponse(response)) {
        throw new Error(this.cleanTagApiMessage(response?.respuesta) || 'El servidor no confirmó el retiro de la etiqueta.');
      }
      this.assignedReservationTags.update((tags) => tags.filter((assigned) => assigned.idTag !== tag.idTag));
      this.toastService.success('Etiqueta retirada correctamente.', 4000, 'Etiquetas');
    } catch (error: unknown) {
      this.toastService.error(this.getReservationTagErrorMessage(error, 'No se pudo retirar la etiqueta.'), 5000, 'Etiquetas');
    } finally {
      this.removingReservationTagIds.update((ids) => {
        const next = new Set(ids);
        next.delete(tag.idTag);
        return next;
      });
    }
  }

  volver(): void {
    void this.router.navigate(['/reservas/consulta-reservas']);
  }

  formatDate(value: string | null | undefined): string {
    return normalizePmsDateDDMMYYYY(value) || 'N/D';
  }

  editarReserva(): void {
    if (this.accionesBloqueadas()) {
      return;
    }

    const codReserva = this.codReserva();
    if (codReserva) {
      void this.router.navigate(['/reservas/editar-hospedaje', codReserva]);
    }
  }

  estadoLabel(estado: string | undefined): string {
    const normalized = (estado ?? '').trim().toUpperCase();
    const labels: Record<string, string> = {
      ABI: 'Abierta',
      CON: 'Confirmada',
      CCR: 'Confirmada',
      CHK: 'Check In',
      IN: 'Check In',
      OUT: 'Check Out',
      ANU: 'Cancelada',
      WLI: 'Lista interna',
      WLT: 'Lista de espera'
    };

    return labels[normalized] ?? (normalized || 'Sin estado');
  }

  estadoClass(estado: string | undefined): string {
    const normalized = (estado ?? '').trim().toUpperCase();
    const classes: Record<string, string> = {
      ABI: 'status-badge status-badge--primary',
      CON: 'status-badge status-badge--success',
      CCR: 'status-badge status-badge--success',
      CHK: 'status-badge status-badge--info',
      IN: 'status-badge status-badge--info',
      OUT: 'status-badge status-badge--muted',
      ANU: 'status-badge status-badge--danger',
      WLI: 'status-badge status-badge--warning',
      WLT: 'status-badge status-badge--warning'
    };

    return classes[normalized] ?? 'status-badge status-badge--muted';
  }

  roomDescription(item: ReservaHospedajeHabitacionDetalle): string {
    return (
      [item.catHabita, item.tipHabita]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join(' / ') || 'Habitacion'
    );
  }

  inclusionDescription(item: ReservaHospedajeInclusionDetalle): string {
    return String(item.desServ ?? item.codServ ?? '').trim() || 'Inclusion';
  }

  serviceDescription(item: ReservaHospedajeServicioDetalle): string {
    return String(item.descripcion ?? item.desServ ?? item.codSrv ?? item.codServ ?? '').trim() || 'Servicio';
  }

  serviceTotal(item: ReservaHospedajeServicioDetalle): number {
    if (item.total != null) {
      return this.toNumber(item.total);
    }

    if (item.totServ != null) {
      return this.toNumber(item.totServ);
    }

    return this.toNumber(item.cantidad) * this.toNumber(item.precio);
  }

  breakdownRoomDescription(item: ReservaHospedajeDesgloseHabitacion): string {
    return (
      [item.catHabita, item.tipHabita]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join(' / ') || 'Habitacion'
    );
  }

  processedLabel(value: unknown): string {
    return this.toNumber(value) === 1 ? 'Procesada' : 'Pendiente';
  }

  toNumber(value: unknown): number {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private esEstadoBloqueado(estado: string | undefined): boolean {
    const normalized = (estado ?? '').trim().toUpperCase();
    return normalized === 'ANU' || normalized === 'CANCELADO' || normalized === 'CHK' || normalized === 'IN' || normalized === 'CHECK IN';
  }

  private activateReservation(codReserva: string): void {
    if (!codReserva) {
      void this.router.navigate(['/reservas/consulta-reservas']);
      return;
    }

    this.codReserva.set(codReserva);
    this.reserva.set(null);
    this.errorMessage.set('');
    this.showReservationTagsModal.set(false);
    this.assignedReservationTags.set([]);
    this.assignedTagsError.set('');
    this.assignedTagsReservationCode = '';
    this.loadReserva(codReserva);
    this.loadAssignedReservationTags(codReserva);
  }

  private loadReserva(codReserva: string): void {
    const requestId = ++this.reservationRequestId;
    const normalizedCode = codReserva.trim().toUpperCase();
    this.loading.set(true);
    this.errorMessage.set('');

    this.service
      .getByReservationCode(codReserva)
      .pipe(
        finalize(() => {
          if (requestId === this.reservationRequestId) this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (detalle) => {
          if (requestId !== this.reservationRequestId || normalizedCode !== this.codReserva().trim().toUpperCase()) return;
          this.reserva.set(detalle);
        },
        error: (error: unknown) => {
          if (requestId !== this.reservationRequestId) return;
          console.error('No se pudo cargar el detalle de la reserva.', error);
          this.reserva.set(null);
          this.errorMessage.set('No se pudo cargar el detalle de la reserva.');
        }
      });
  }

  private loadAssignedReservationTags(codReservaValue: string, force = false): void {
    const codReserva = this.cleanText(codReservaValue);
    const normalizedCode = codReserva.toUpperCase();
    if (!codReserva) {
      this.assignedTagsReservationCode = '';
      this.assignedReservationTags.set([]);
      this.assignedTagsError.set('No se pudo identificar la reserva para consultar sus etiquetas.');
      return;
    }
    if (!force && normalizedCode === this.assignedTagsReservationCode) return;

    const requestId = ++this.assignedTagsRequestId;
    this.assignedTagsReservationCode = normalizedCode;
    this.assignedReservationTags.set([]);
    this.assignedTagsError.set('');
    this.isAssignedTagsLoading.set(true);

    this.tagsService.obtenerTagsReserva(codReserva).pipe(
      finalize(() => {
        if (requestId === this.assignedTagsRequestId) this.isAssignedTagsLoading.set(false);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        if (requestId !== this.assignedTagsRequestId || normalizedCode !== this.assignedTagsReservationCode) return;
        if (!this.isSuccessfulTagResponse(response) || !Array.isArray(response.datos)) {
          this.assignedTagsError.set(
            this.cleanTagApiMessage(response?.respuesta) || 'No se pudieron cargar las etiquetas asignadas.'
          );
          return;
        }
        this.assignedReservationTags.set([...response.datos].sort((left, right) => this.compareAssignedTags(left, right)));
      },
      error: (error: unknown) => {
        if (requestId !== this.assignedTagsRequestId) return;
        this.assignedTagsError.set(
          this.getReservationTagErrorMessage(error, 'No se pudieron cargar las etiquetas asignadas.')
        );
      }
    });
  }

  private normalizeReservationTagSelections(selections: ReservaTagSeleccionado[]): ReservaTagSeleccionado[] {
    const unique = new Map<number, ReservaTagSeleccionado>();
    selections.forEach((selection) => {
      if (!unique.has(selection.tag.idTag)) {
        unique.set(selection.tag.idTag, {
          tag: selection.tag,
          observacion: selection.observacion?.trim().slice(0, 200) || null
        });
      }
    });
    return [...unique.values()];
  }

  private validateReservationTagSelections(selections: ReservaTagSeleccionado[]): string {
    const assigned = this.assignedReservationTags();
    const assignedIds = new Set(assigned.map((tag) => tag.idTag));
    const localGroups = new Map<string, ReservaTagCatalogo>();

    for (const selection of selections) {
      const tag = selection.tag;
      if (!tag.activo || !tag.permiteAsignacionManual) {
        return `La etiqueta “${tag.nombre}” ya no está disponible para asignación manual.`;
      }
      if (assignedIds.has(tag.idTag)) {
        return `La etiqueta “${tag.nombre}” ya está asignada a la reserva.`;
      }
      const group = this.cleanText(tag.grupoExclusion).toUpperCase();
      if (!group) continue;
      const persistedConflict = assigned.find((item) =>
        item.idTag !== tag.idTag && this.cleanText(item.grupoExclusion).toUpperCase() === group
      );
      if (persistedConflict) {
        return `Retire primero la etiqueta existente “${persistedConflict.nombre}” antes de agregar “${tag.nombre}”.`;
      }
      const localConflict = localGroups.get(group);
      if (localConflict && localConflict.idTag !== tag.idTag) {
        return `Las etiquetas “${localConflict.nombre}” y “${tag.nombre}” son incompatibles.`;
      }
      localGroups.set(group, tag);
    }
    return '';
  }

  private compareAssignedTags(left: ReservaTagAsignado, right: ReservaTagAsignado): number {
    return Number(right.esAlerta) - Number(left.esAlerta)
      || right.prioridad - left.prioridad
      || left.ordenCategoria - right.ordenCategoria
      || left.nombre.localeCompare(right.nombre);
  }

  private isSuccessfulTagResponse<T>(response: ApiResponse<T> | null | undefined): boolean {
    return response?.exito === true && (response.respuesta?.startsWith('OK|') ?? false);
  }

  private cleanTagApiMessage(message: string | null | undefined): string {
    return (message ?? '').replace(/^(OK|ERROR)\|/i, '').replace(/\|/g, ' · ').trim();
  }

  private getReservationTagErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return this.cleanTagApiMessage(error.message);
    if (typeof error === 'object' && error !== null) {
      const candidate = error as { error?: { respuesta?: unknown; message?: unknown }; message?: unknown };
      const value = candidate.error?.respuesta ?? candidate.error?.message ?? candidate.message;
      if (typeof value === 'string' && value.trim()) return this.cleanTagApiMessage(value);
    }
    return fallback;
  }

  private cleanText(value: string | number | null | undefined): string {
    return (value ?? '').toString().trim();
  }
}
