import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { firstValueFrom, of } from 'rxjs';
import { catchError, distinctUntilChanged, filter, finalize, map } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';
import { OperationalAction } from 'src/app/core/models/operational-context.model';
import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { OperationalPolicyService } from 'src/app/core/services/operational-policy.service';
import { CanDeactivateReservaCreate } from 'src/app/core/guards/can-deactivate-reserva-create.guard';
import {
  addPmsCalendarDays,
  differenceInPmsCalendarDays,
  normalizePmsDateDDMMYYYY,
  toPmsDateInputValue
} from 'src/app/core/utils/pms-date.util';
import { RoomStatus, RoomType } from '../../interfaces/room-status.interface';
import {
  RoomChangePayload,
  RoomStayManagementService
} from '../../../front-desk/pages/room-stay-management/services/room-stay-management.service';
import { CalendarGridComponent } from '../components/calendar-grid/calendar-grid.component';
import { CalendarHeaderComponent } from '../components/calendar-header/calendar-header.component';
import { CalendarToolbarComponent } from '../components/calendar-toolbar/calendar-toolbar.component';
import { ReservationAssignmentPanelComponent } from '../components/reservation-assignment-panel/reservation-assignment-panel.component';
import { ReservationCalendarDetailPanelComponent } from '../components/reservation-calendar-detail-panel/reservation-calendar-detail-panel.component';
import { RoomSidebarComponent } from '../components/room-sidebar/room-sidebar.component';
import {
  CalendarAssignableReservation,
  CalendarAssignmentTarget,
  CalendarData,
  CalendarExchangeTrayAssignmentRequest,
  CalendarFilterStatus,
  CalendarReservation,
  CalendarReservationBlockSelect,
  CalendarReservationBlockView,
  CalendarReservationDropRequest,
  CalendarRoomAssignmentRequest,
  CalendarRoomAssignmentResponse,
  ExchangeTrayReservation,
  RoomExchangeChange
} from '../interfaces/calendar.interface';
import { CalendarService } from '../services/calendar.service';
import { isCheckedInCalendarReservation } from '../utils/calendar-reservation.util';

interface PendingRoomMoveVerification {
  auditId: string;
  flow: 'PRECHECKING_ASSIGNMENT' | 'ROOM_CHANGE_CHK';
  reservationCode: string;
  reservationId: string;
  previousRoomNumber: string;
  expectedRoomNumber: string;
  apiResponse: unknown;
}

@Component({
  selector: 'app-room-calendar-page',
  standalone: true,
  imports: [
    CommonModule,
    CalendarToolbarComponent,
    RoomSidebarComponent,
    CalendarHeaderComponent,
    CalendarGridComponent,
    ReservationAssignmentPanelComponent,
    ReservationCalendarDetailPanelComponent
  ],
  templateUrl: './room-calendar-page.component.html',
  styleUrls: ['./room-calendar-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomCalendarPageComponent implements OnInit, CanDeactivateReservaCreate {
  private readonly calendarService = inject(CalendarService);
  private readonly roomStayManagementService = inject(RoomStayManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly operationalPolicy = inject(OperationalPolicyService);
  private readonly operationalDateService = inject(OperationalDateService);
  private readonly operationalDate$ = toObservable(this.operationalDateService.operationalDate);
  private readonly assignmentEndpoint = `${(environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '')}/prechecking/asignar-habitacion`;

  @ViewChild(RoomSidebarComponent) roomSidebar?: RoomSidebarComponent;
  @ViewChild(CalendarGridComponent) calendarGrid?: CalendarGridComponent;
  @ViewChild(ReservationAssignmentPanelComponent) assignmentPanel?: ReservationAssignmentPanelComponent;

  typeOptions: RoomType[] = [];
  readonly statusOptions: Array<{ label: string; value: CalendarFilterStatus }> = [
    { label: 'Todos', value: null },
    { label: 'Disponible', value: 'available' },
    { label: 'Entrada hoy', value: 'arrival-today' },
    { label: 'Ocupada', value: 'occupied' },
    { label: 'Salida mañana', value: 'checkout-tomorrow' },
    { label: 'Salida hoy', value: 'checkout-today' },
    { label: 'Reserva futura', value: 'future-reservation' },
    { label: 'Bloqueada', value: 'blocked' },
    { label: 'Requiere atención', value: 'attention' }
  ];

  operationalDate                    = toPmsDateInputValue(this.operationalDateService.operationalDate()) || toPmsDateInputValue(new Date());
  startDate                           = this.operationalDate;
  endDate                             = this.shiftDate(this.startDate, 29);
  search                              = '';
  type                                : RoomType | null = null;
  status                              : CalendarFilterStatus = null;
  headerScrollLeft                    = 0;
  sidebarViewportHeight               : number | null = null;
  sidebarScrollContentHeight          : number | null = null;
  isLoading                           = false;
  errorMessage                        = '';
  assignmentPanelCollapsed            = false;
  isAssigningRoom                     = false;
  selectedPendingReservation          : CalendarAssignableReservation | null = null;
  selectedReservationDetailBlock      : CalendarReservationBlockView | null = null;
  selectedReservationDetailIsPending  = false;
  exchangeMode                        = false;
  exchangeTrayReservations            : ExchangeTrayReservation[] = [];
  exchangeSessionChanges              : RoomExchangeChange[] = [];
  selectedExchangeTrayReservationId   : string | null = null;
  readonly processingReservationIds   = new Set<string>();
  private rooms                       : RoomStatus[] = [];
  private workingReservations         : CalendarReservation[] = [];
  private pendingRoomMoveVerification : PendingRoomMoveVerification | null = null;
  calendarData                        : CalendarData = this.calendarService.getCalendarData(
    this.buildQuery(),
    this.rooms,
    this.workingReservations,
    this.operationalDate
  );

  ngOnInit(): void {
    this.bindOperationalDate();
    this.operationalDateService.ensureLoaded().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: (error) => {
        console.error('No se pudo obtener la fecha operativa para cargar el calendario.', error);
        this.errorMessage = 'No se pudo obtener la fecha operativa para cargar el calendario.';
        this.cdr.markForCheck();
      }
    });
  }

  async onStartDateChange(value: string): Promise<void> {
    if (!(await this.confirmExchangeContextChange())) {
      return;
    }
    this.startDate = value;
    if (this.startDate > this.endDate) {
      this.endDate = this.startDate;
    }
    this.loadCalendar();
  }

  async onEndDateChange(value: string): Promise<void> {
    if (!(await this.confirmExchangeContextChange())) {
      return;
    }
    this.endDate = value;
    if (this.endDate < this.startDate) {
      this.startDate = this.endDate;
    }
    this.loadCalendar();
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.reloadCalendar();
  }

  onTypeChange(value: RoomType | null): void {
    this.type = value;
    this.reloadCalendar();
  }

  onStatusChange(value: CalendarFilterStatus): void {
    this.status = value;
    this.reloadCalendar();
  }

  async goToday(): Promise<void> {
    if (!(await this.confirmExchangeContextChange())) {
      return;
    }
    const range = this.rangeLength;
    this.startDate = this.operationalDate;
    this.endDate = this.shiftDate(this.startDate, range - 1);
    this.loadCalendar(true);
  }

  async shiftWindow(direction: -1 | 1): Promise<void> {
    if (!(await this.confirmExchangeContextChange())) {
      return;
    }
    const range = this.rangeLength;
    this.startDate = this.shiftDate(this.startDate, range * direction);
    this.endDate = this.shiftDate(this.endDate, range * direction);
    this.loadCalendar(true);
  }

  onGridScrollLeft(scrollLeft: number): void {
    this.headerScrollLeft = scrollLeft;
  }

  onGridScrollTop(scrollTop: number): void {
    this.roomSidebar?.setScrollTop(scrollTop);
  }

  onGridViewportHeightChange(height: number): void {
    const normalizedHeight = Math.max(0, Math.round(Number(height) || 0));
    if (!normalizedHeight || this.sidebarViewportHeight === normalizedHeight) {
      return;
    }

    this.sidebarViewportHeight = normalizedHeight;
    this.cdr.markForCheck();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => this.roomSidebar?.setScrollTop(this.calendarGrid?.getScrollTop() ?? 0));
    }
  }

  onGridScrollContentHeightChange(height: number): void {
    const normalizedHeight = Math.max(0, Math.round(Number(height) || 0));
    if (!normalizedHeight || this.sidebarScrollContentHeight === normalizedHeight) {
      return;
    }

    this.sidebarScrollContentHeight = normalizedHeight;
    this.cdr.markForCheck();
  }

  onSidebarScrollTop(scrollTop: number): void {
    this.calendarGrid?.setScrollTop(scrollTop);
  }

  openReservationDetail(payload: CalendarReservationBlockSelect): void {
    if (payload.block.reservation.isOperationalBlock) {
      return;
    }

    payload.event.preventDefault();
    payload.event.stopPropagation();
    this.selectedReservationDetailIsPending = false;
    this.selectedReservationDetailBlock = payload.block;
    this.cdr.markForCheck();
  }

  onReservationDrop(drop: CalendarReservationDropRequest): void {
    console.info('[RoomCalendar][DROP_RECEIVED] Movimiento recibido desde el grid.', {
      reservationId: drop.reservationId,
      fromRoomNumber: drop.fromRoomNumber,
      toRoomNumber: drop.toRoomNumber,
      toCategoryCode: drop.toCategoryCode,
      targetDate: drop.targetDate,
      pendingReservation: !!drop.pendingReservation
    });

    if (drop.pendingReservation) {
      console.info('[RoomCalendar][FLOW_SELECTED] Reserva pendiente: PRECHECKING_ASSIGNMENT.', {
        codReserva: drop.pendingReservation.reservationCode
      });
      void this.confirmAndAssignReservation(drop.pendingReservation, {
        roomNumber: drop.toRoomNumber,
        categoryCode: drop.toCategoryCode,
        targetDate: drop.targetDate,
        valid: true
      });
      return;
    }

    void this.confirmAndReassignCalendarReservation(drop);
  }

  toggleExchangeMode(): void {
    if (this.exchangeMode) {
      void this.cancelExchangeSession();
      return;
    }
    this.startExchangeSession();
  }

  startExchangeSession(): void {
    this.exchangeMode = true;
    this.selectedPendingReservation = null;
    this.selectedExchangeTrayReservationId = null;
    this.cdr.markForCheck();
  }

  onReservationTrayDrop(reservationId: string): void {
    void this.moveReservationToExchangeTray(reservationId);
  }

  onTrayReservationDrop(request: CalendarExchangeTrayAssignmentRequest): void {
    void this.assignTrayReservationToRoom(request.reservationId, request.toRoomNumber, request.toCategoryCode);
  }

  onTrayReservationSelect(reservationId: string): void {
    this.selectedPendingReservation = null;
    this.selectedExchangeTrayReservationId = this.selectedExchangeTrayReservationId === reservationId ? null : reservationId;
  }

  onCheckedInReservationMoveBlocked(reservation: CalendarReservation): void {
    void Swal.fire({
      title: 'Acción no permitida',
      text: `La reserva ${reservation.reservationCode || reservation.id} tiene Check-In realizado. Únicamente puede trasladarse directamente a otra habitación.`,
      icon: 'warning',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#2f5f8d'
    });
  }

  onPendingReservationDragStart(payload: { reservation: CalendarAssignableReservation; event: PointerEvent }): void {
    this.calendarGrid?.startPendingReservationDrag(payload);
  }

  onPendingReservationSelect(reservation: CalendarAssignableReservation): void {
    const isAssignable = reservation.roomNumber.trim().toUpperCase().startsWith('HB');
    this.selectedPendingReservation = isAssignable ? reservation : null;
    this.selectedReservationDetailIsPending = true;
    this.selectedReservationDetailBlock = this.calendarService.getReservationBlockView(
      {
        id: reservation.id,
        reservationCode: reservation.reservationCode,
        roomNumber: reservation.roomNumber,
        sourceRoom: reservation.sourceRoom,
        categoryCode: reservation.categoryCode,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        status: 'RESERVADA',
        reservationState: reservation.status,
        guestName: reservation.guestName,
        source: reservation.agency
      },
      this.startDate,
      Math.max(this.rangeLength, 1),
      this.operationalDate
    );
    this.cdr.markForCheck();
  }

  onAssignmentTargetSelect(target: CalendarAssignmentTarget): void {
    if (this.selectedExchangeTrayReservationId) {
      void this.assignTrayReservationToRoom(this.selectedExchangeTrayReservationId, target.roomNumber, target.categoryCode, target.valid);
      return;
    }

    if (!this.selectedPendingReservation) {
      return;
    }

    void this.confirmAndAssignReservation(this.selectedPendingReservation, target);
  }

  clearSelectedReservation(): void {
    this.selectedPendingReservation = null;
    this.selectedExchangeTrayReservationId = null;
  }

  closeReservationDetail(): void {
    this.selectedReservationDetailBlock = null;
    this.selectedReservationDetailIsPending = false;
    this.cdr.markForCheck();
  }

  onDetailAssignRequested(): void {
    if (!this.selectedReservationDetailIsPending || !this.selectedPendingReservation) {
      return;
    }

    this.closeReservationDetail();
  }

  onUnassignReservationFromMenu(block: CalendarReservationBlockView): void {
    if (this.isCheckedInReservation(block.reservation)) {
      this.onCheckedInReservationMoveBlocked(block.reservation);
      return;
    }
    void this.confirmAndUnassignCalendarReservation(block);
  }

  onMoveReservationToTrayFromMenu(block: CalendarReservationBlockView): void {
    void this.moveReservationToExchangeTray(block.reservation.id);
  }

  onDetailMoveToTrayRequested(): void {
    const block = this.selectedReservationDetailBlock;
    if (!block) {
      return;
    }
    this.closeReservationDetail();
    this.onMoveReservationToTrayFromMenu(block);
  }

  async onDetailUnassignRequested(): Promise<void> {
    const block = this.selectedReservationDetailBlock;
    if (!block || !this.canUnassignSelectedReservation()) {
      return;
    }

    const unassigned = await this.confirmAndUnassignCalendarReservation(block);
    if (unassigned) {
      this.closeReservationDetail();
    }
  }

  async onDetailEditRequested(): Promise<void> {
    const reservation = this.selectedReservationDetailBlock?.reservation;
    const reservationCode = reservation?.reservationCode?.trim() || '';
    const state = reservation?.reservationState?.trim().toUpperCase() || '';

    if (!reservation || !reservationCode || ['CHK', 'ANU'].includes(state)) {
      return;
    }

    const allowed = await this.operationalPolicy.require(OperationalAction.UpdateOperation, { refresh: true });
    if (!allowed) {
      return;
    }

    await this.router.navigate(['/reservas/editar-hospedaje', reservationCode], {
      queryParams: { returnUrl: '/reservas/calendario' }
    });
  }

  async createReservation(): Promise<void> {
    const allowed = await this.operationalPolicy.require(OperationalAction.CreateOperation);
    if (!allowed) {
      return;
    }

    await this.router.navigate(['/reservas/nueva-hospedaje'], {
      queryParams: { returnUrl: '/reservas/calendario' }
    });
  }

  canEditSelectedReservation(): boolean {
    const reservation = this.selectedReservationDetailBlock?.reservation;
    const state = reservation?.reservationState?.trim().toUpperCase() || '';
    return !!reservation?.reservationCode?.trim() && !reservation.isOperationalBlock && !['CHK', 'ANU'].includes(state);
  }

  canManageSelectedReservation(): boolean {
    return !this.selectedReservationDetailIsPending
      && !!this.selectedReservationDetailBlock
      && !this.isCheckedInReservation(this.selectedReservationDetailBlock.reservation);
  }

  canUnassignSelectedReservation(): boolean {
    const reservation = this.selectedReservationDetailBlock?.reservation;
    return !this.selectedReservationDetailIsPending
      && !!reservation
      && !reservation.isOperationalBlock
      && !this.isCheckedInReservation(reservation)
      && !!reservation.roomNumber?.trim();
  }

  get selectedExchangeTrayReservation(): ExchangeTrayReservation | null {
    return this.exchangeTrayReservations.find((item) => item.reservation.id === this.selectedExchangeTrayReservationId) ?? null;
  }

  get pendingExchangeChangesCount(): number {
    return this.exchangeSessionChanges.filter((change) => change.newRoomNumber !== change.originalRoomNumber).length;
  }

  get exchangeTrayHeight(): number {
    const laneCount = this.exchangeTrayReservations.length ? Math.max(...this.exchangeTrayReservations.map((item) => item.lane)) + 1 : 0;
    return laneCount ? Math.max(64, Math.min(laneCount, 4) * 42 + 16) : 64;
  }

  isReservationProcessing(reservationId: string): boolean {
    return this.processingReservationIds.has(reservationId);
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.pendingExchangeChangesCount) {
      return;
    }
    event.preventDefault();
    event.returnValue = '';
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.pendingExchangeChangesCount) {
      return true;
    }
    return this.confirmLeaveExchangeSession();
  }

  get visibleWindowLabel(): string {
    return `${this.formatDisplayDate(this.startDate)} - ${this.formatDisplayDate(this.endDate)}`;
  }

  async confirmExchangeSession(): Promise<void> {
    if (this.exchangeTrayReservations.length) {
      await Swal.fire({
        title: 'Reservas sin habitación',
        text: 'Existen reservas temporalmente sin habitación. Debe asignarlas antes de confirmar.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return;
    }

    if (!this.pendingExchangeChangesCount) {
      this.clearExchangeSession();
      return;
    }

    const result = await Swal.fire({
      title: 'Confirmar reasignación',
      html: this.buildExchangeSummaryHtml(),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar cambios',
      cancelButtonText: 'Continuar editando',
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d'
    });

    if (!result.isConfirmed) {
      return;
    }

    this.clearExchangeSession();
    this.loadCalendar();
    await Swal.fire({
      title: 'Reasignación completada',
      text: 'Los cambios de habitación se confirmaron correctamente. Las fechas y tarifas no fueron modificadas.',
      icon: 'success',
      timer: 1800,
      showConfirmButton: false
    });
  }

  async cancelExchangeSession(): Promise<void> {
    if (!this.pendingExchangeChangesCount) {
      this.clearExchangeSession();
      return;
    }

    const result = await Swal.fire({
      title: '¿Desea cancelar la reasignación?',
      text: 'Las reservas volverán a sus habitaciones originales.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Descartar cambios',
      cancelButtonText: 'Continuar editando',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d'
    });
    if (!result.isConfirmed) {
      return;
    }

    try {
      await this.restoreExchangeSession();
      this.clearExchangeSession();
      this.loadCalendar();
      await Swal.fire({
        title: 'Cambios descartados',
        text: 'Las reservas volvieron a sus habitaciones originales.',
        icon: 'success',
        timer: 1800,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('No se pudo restaurar la sesión de intercambio.', error);
      this.loadCalendar();
      await Swal.fire({
        title: 'No fue posible restaurar todos los cambios',
        text: `${this.getAssignmentErrorMessage(error)} El calendario se actualizará; revise las reservas antes de continuar.`,
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#dc3545'
      });
    }
  }

  async restoreReservationToOriginalRoom(reservationId: string): Promise<void> {
    const item = this.exchangeTrayReservations.find((candidate) => candidate.reservation.id === reservationId);
    if (!item) {
      return;
    }

    const targetRoom = this.rooms.find((room) => room.roomNumber === item.originalRoomNumber);
    if (!targetRoom || !this.isRoomPlacementValid(item.originalRoomNumber, item.reservation.startDate, item.reservation.endDate, reservationId)) {
      await Swal.fire({
        title: 'Habitación original no disponible',
        text: `La habitación ${item.originalRoomNumber} está ocupada para las fechas de la reserva. Libérela antes de restaurar.`,
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return;
    }

    await this.assignTrayReservationToRoom(reservationId, item.originalRoomNumber, targetRoom.type, true, false);
  }

  private async moveReservationToExchangeTray(reservationId: string): Promise<void> {
    if (!this.exchangeMode || this.isAssigningRoom) {
      return;
    }

    const reservation = this.workingReservations.find((item) => item.id === reservationId);
    if (!reservation || this.exchangeTrayReservations.some((item) => item.reservation.id === reservationId)) {
      return;
    }
    if (this.isCheckedInReservation(reservation)) {
      this.onCheckedInReservationMoveBlocked(reservation);
      return;
    }

    const reservationCode = reservation.reservationCode || this.extractReservationCode(reservation.id);
    const backendSourceRoom = reservation.sourceRoom?.trim();
    const categoryCode = reservation.categoryCode || this.rooms.find((room) => room.roomNumber === reservation.roomNumber)?.type || '';
    if (!backendSourceRoom || !categoryCode.trim()) {
      await Swal.fire({
        title: 'No se puede liberar la reserva',
        text: !backendSourceRoom
          ? `La reserva ${reservationCode} no trae habitación origen para realizar una desasignación segura.`
          : `La reserva ${reservationCode} no tiene categoría de habitación.`,
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return;
    }

    try {
      const response = await this.executeRoomAssignment(
        {
          codReserva: reservationCode,
          oldHabita: reservation.roomNumber,
          newHabita: backendSourceRoom,
          categoria: categoryCode,
          operador: this.getOperator()
        },
        reservation.id
      );
      this.assertAssignmentSucceeded(response, 'El endpoint no confirmó la desasignación temporal.');
      this.registerExchangeChange(reservation, null, 'in-tray', backendSourceRoom);
      this.applyCalendarReservationUnassignment(reservation.id);
      this.rebuildExchangeTrayReservations();
      this.assignmentPanel?.reload();
      await Swal.fire({
        title: 'Reserva liberada temporalmente',
        text: `La reserva ${reservationCode} está en la Bandeja de intercambio.`,
        icon: 'success',
        timer: 1400,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('No se pudo mover la reserva a la bandeja.', error);
      await Swal.fire({
        title: 'No fue posible mover la reserva',
        text: this.getAssignmentErrorMessage(error),
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#dc3545'
      });
    }
  }

  private async assignTrayReservationToRoom(
    reservationId: string,
    roomNumber: string,
    categoryCode: string,
    targetValid = true,
    askConfirmation = true
  ): Promise<void> {
    const item = this.exchangeTrayReservations.find((candidate) => candidate.reservation.id === reservationId);
    if (!item || this.isAssigningRoom) {
      return;
    }

    const valid = targetValid && this.isRoomPlacementValid(roomNumber, item.reservation.startDate, item.reservation.endDate, reservationId);
    const reservation = this.toAssignableReservation(item.reservation, item.backendSourceRoom);
    const target: CalendarAssignmentTarget = { roomNumber, categoryCode, targetDate: item.reservation.startDate, valid };
    const assigned = await this.confirmAndAssignReservation(reservation, target, { exchangeTrayReservationId: reservationId, skipConfirmation: !askConfirmation });
    if (assigned) {
      this.selectedExchangeTrayReservationId = null;
    }
  }

  private registerExchangeChange(
    reservation: CalendarReservation,
    newRoomNumber: string | null,
    status: RoomExchangeChange['status'],
    backendSourceRoom = reservation.sourceRoom?.trim() || reservation.roomNumber
  ): void {
    const existingIndex = this.exchangeSessionChanges.findIndex((change) => change.reservationId === reservation.id);
    const existing = existingIndex >= 0 ? this.exchangeSessionChanges[existingIndex] : null;
    const change: RoomExchangeChange = {
      reservationId: reservation.id,
      reservation: existing?.reservation ?? { ...reservation },
      originalRoomNumber: existing?.originalRoomNumber ?? reservation.roomNumber,
      backendSourceRoom: existing?.backendSourceRoom ?? backendSourceRoom,
      newRoomNumber,
      status
    };

    if (change.newRoomNumber === change.originalRoomNumber) {
      this.exchangeSessionChanges = this.exchangeSessionChanges.filter((item) => item.reservationId !== reservation.id);
    } else if (existingIndex >= 0) {
      this.exchangeSessionChanges = this.exchangeSessionChanges.map((item, index) => (index === existingIndex ? change : item));
    } else {
      this.exchangeSessionChanges = [...this.exchangeSessionChanges, change];
    }
    this.rebuildExchangeTrayReservations();
  }

  private rebuildExchangeTrayReservations(): void {
    const trayChanges = this.exchangeSessionChanges
      .filter((change) => change.status === 'in-tray' && change.newRoomNumber === null)
      .sort((left, right) => left.reservation.startDate.localeCompare(right.reservation.startDate) || left.reservation.endDate.localeCompare(right.reservation.endDate));
    const laneEndDates: string[] = [];

    this.exchangeTrayReservations = trayChanges.map((change) => {
      let lane = laneEndDates.findIndex((endDate) => endDate <= change.reservation.startDate);
      if (lane < 0) {
        lane = laneEndDates.length;
      }
      laneEndDates[lane] = change.reservation.endDate;
      return {
        reservation: change.reservation,
        originalRoomNumber: change.originalRoomNumber,
        backendSourceRoom: change.backendSourceRoom,
        currentRoomNumber: null,
        status: 'in-tray',
        lane,
        block: this.calendarService.getReservationBlockView(
          change.reservation,
          this.startDate,
          this.calendarData.dates.length,
          this.operationalDate
        )
      };
    });
    this.cdr.markForCheck();
  }

  private async restoreExchangeSession(): Promise<void> {
    const changes = this.exchangeSessionChanges.filter((change) => change.newRoomNumber !== change.originalRoomNumber);

    for (const change of changes.filter((item) => item.newRoomNumber !== null)) {
      const category = change.reservation.categoryCode || this.rooms.find((room) => room.roomNumber === change.newRoomNumber)?.type || '';
      const response = await this.executeRoomAssignment(
        {
          codReserva: change.reservation.reservationCode || this.extractReservationCode(change.reservation.id),
          oldHabita: change.newRoomNumber || change.originalRoomNumber,
          newHabita: change.backendSourceRoom,
          categoria: category,
          operador: this.getOperator()
        },
        change.reservationId
      );
      this.assertAssignmentSucceeded(response, 'No fue posible liberar una habitación durante la restauración.');
    }

    for (const change of changes) {
      const category = change.reservation.categoryCode || this.rooms.find((room) => room.roomNumber === change.originalRoomNumber)?.type || '';
      const response = await this.executeRoomAssignment(
        {
          codReserva: change.reservation.reservationCode || this.extractReservationCode(change.reservation.id),
          oldHabita: change.backendSourceRoom,
          newHabita: change.originalRoomNumber,
          categoria: category,
          operador: this.getOperator()
        },
        change.reservationId
      );
      this.assertAssignmentSucceeded(response, `No fue posible restaurar la habitación ${change.originalRoomNumber}.`);
    }
  }

  private clearExchangeSession(): void {
    this.exchangeMode = false;
    this.exchangeTrayReservations = [];
    this.exchangeSessionChanges = [];
    this.selectedExchangeTrayReservationId = null;
    this.cdr.markForCheck();
  }

  private async confirmExchangeContextChange(): Promise<boolean> {
    if (!this.pendingExchangeChangesCount) {
      return true;
    }
    await Swal.fire({
      title: 'Existe una reasignación en curso',
      text: 'Debe confirmar o descartar los cambios antes de cambiar el rango de fechas.',
      icon: 'warning',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#2f5f8d'
    });
    return false;
  }

  private async confirmLeaveExchangeSession(): Promise<boolean> {
    const result = await Swal.fire({
      title: 'Existe una reasignación en curso',
      text: 'Para salir, las reservas deben volver primero a sus habitaciones originales.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Descartar cambios y salir',
      cancelButtonText: 'Permanecer aquí',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#2f5f8d'
    });
    if (!result.isConfirmed) {
      return false;
    }

    try {
      await this.restoreExchangeSession();
      this.clearExchangeSession();
      return true;
    } catch (error) {
      console.error('No se pudo restaurar la sesión antes de salir.', error);
      await Swal.fire({
        title: 'No se puede salir todavía',
        text: 'No fue posible restaurar todas las habitaciones originales. Revise el calendario e intente nuevamente.',
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#dc3545'
      });
      return false;
    }
  }

  private buildExchangeSummaryHtml(): string {
    const rows = this.exchangeSessionChanges
      .filter((change) => change.newRoomNumber && change.newRoomNumber !== change.originalRoomNumber)
      .map(
        (change) => `
          <div style="display:grid;gap:3px;border:1px solid #dee2e6;border-radius:8px;padding:10px">
            <strong>${this.escapeHtml(change.reservation.guestName || change.reservation.reservationCode || change.reservation.id)}</strong>
            <span>${this.escapeHtml(change.originalRoomNumber)} &rarr; ${this.escapeHtml(change.newRoomNumber || '')}</span>
          </div>`
      )
      .join('');
    return `<div style="display:grid;gap:8px;text-align:left">${rows}<p style="margin:4px 0 0;color:#6c757d">Las fechas y tarifas no serán modificadas.</p></div>`;
  }

  private isRoomPlacementValid(roomNumber: string, startDate: string, endDate: string, reservationId: string): boolean {
    return this.workingReservations
      .filter((reservation) => reservation.roomNumber === roomNumber && reservation.id !== reservationId)
      .every((reservation) => endDate <= reservation.startDate || startDate >= reservation.endDate);
  }

  private toAssignableReservation(reservation: CalendarReservation, sourceRoom: string): CalendarAssignableReservation {
    return {
      id                  : reservation.id,
      reservationCode     : reservation.reservationCode || this.extractReservationCode(reservation.id),
      categoryCode        : reservation.categoryCode || this.rooms.find((room) => room.roomNumber === reservation.roomNumber)?.type || '',
      sourceRoom          ,
      roomNumber          : reservation.roomNumber,
      startDate           : reservation.startDate,
      endDate             : reservation.endDate,
      nights              : this.diffDays(reservation.startDate, reservation.endDate),
      rooms               : 1,
      guestName           : reservation.guestName,
      agency              : reservation.source,
      status              : reservation.status,
      operator            : '',
      pax                 : 0,
      children            : 0
    };
  }

  formatDisplayDate(isoDate: string): string {
    return normalizePmsDateDDMMYYYY(isoDate) || isoDate;
  }

  private reloadCalendar(resetScroll = false): void {
    this.calendarData = this.calendarService.getCalendarData(
      this.buildQuery(),
      this.rooms,
      this.workingReservations,
      this.operationalDate
    );
    if (resetScroll) {
      this.headerScrollLeft = 0;
      this.calendarGrid?.resetScroll();
      this.roomSidebar?.resetScroll();
    }
  }

  private applyPendingReservationDrop(reservation: CalendarAssignableReservation, roomNumber: string, targetDate: string): void {
    const nights = Math.max(reservation.nights, 1);
    const endDate = this.shiftDate(targetDate, nights);
    const calendarReservation: CalendarReservation = {
      id                : `pending-${reservation.id}-${roomNumber}-${targetDate}`,
      reservationCode   : reservation.reservationCode,
      roomNumber        ,
      categoryCode      : reservation.categoryCode,
      startDate         : targetDate,
      endDate           ,
      status            : 'RESERVADA',
      guestName         : reservation.guestName,
      source            : reservation.agency || reservation.reservationCode
    };

    this.workingReservations = this.workingReservations.filter((item) => item.id !== calendarReservation.id);
    this.workingReservations = [...this.workingReservations, calendarReservation];
    this.reloadCalendar();
    console.info('[RoomCalendar] Asignacion visual pendiente de integracion backend.', {
      reserva: reservation.reservationCode,
      habitacion: roomNumber,
      fechaIngreso: targetDate,
      fechaSalida: endDate
    });
  }

  private applyCalendarReservationMove(reservationId: string, roomNumber: string, targetDate: string): void {
    const sourceReservation = this.workingReservations.find((reservation) => reservation.id === reservationId);
    if (!sourceReservation) {
      return;
    }

    const nights = this.diffDays(sourceReservation.startDate, sourceReservation.endDate);
    this.workingReservations = this.workingReservations.map((reservation) =>
      reservation.id === reservationId
        ? {
            ...reservation,
            roomNumber,
            startDate: targetDate,
            endDate: this.shiftDate(targetDate, nights)
          }
        : reservation
    );
    this.reloadCalendar();
  }

  private applyCalendarReservationUnassignment(reservationId: string): void {
    this.workingReservations = this.workingReservations.filter((reservation) => reservation.id !== reservationId);
    this.reloadCalendar();
  }

  private async confirmAndUnassignCalendarReservation(block: CalendarReservationBlockView): Promise<boolean> {
    if (this.isAssigningRoom) {
      return false;
    }

    const reservation = block.reservation;
    const reservationCode = reservation.reservationCode || this.extractReservationCode(reservation.id);
    const sourceRoom = reservation.sourceRoom?.trim();

    if (!sourceRoom) {
      await Swal.fire({
        title: 'Habitacion origen requerida',
        text: `La reserva ${reservationCode} no trae habOrigen. No se puede desasignar sin saber a que habitacion origen debe regresar.`,
        icon: 'warning',
        customClass: { container: 'next-confirm-container' },
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return false;
    }

    const currentRoom = reservation.roomNumber;
    const categoryCode = reservation.categoryCode || this.rooms.find((room) => room.roomNumber === currentRoom)?.type || '';

    if (!categoryCode.trim()) {
      await Swal.fire({
        title: 'Categoria requerida',
        text: `La reserva ${reservationCode} no tiene categoria para enviar la desasignacion.`,
        icon: 'warning',
        customClass: { container: 'next-confirm-container' },
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return false;
    }

    const result = await Swal.fire({
      title: 'Desasignar habitacion',
      html: this.buildUnassignmentConfirmationHtml(reservationCode, currentRoom, sourceRoom, categoryCode),
      icon: 'warning',
      customClass: { container: 'next-confirm-container' },
      showCancelButton: true,
      confirmButtonText: 'Desasignar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#6c757d'
    });

    if (!result.isConfirmed) {
      return false;
    }

    try {
      const response = await this.executeRoomAssignment(
        {
          codReserva: reservationCode,
          oldHabita: currentRoom,
          newHabita: sourceRoom,
          categoria: categoryCode,
          operador: this.getOperator()
        },
        reservation.id
      );
      this.assertAssignmentSucceeded(response, 'El endpoint no confirmó la desasignación.');
      this.applyCalendarReservationUnassignment(reservation.id);
      this.assignmentPanel?.reload();
      this.loadCalendar();
      await Swal.fire({
        title: 'Habitacion desasignada',
        text: response?.respuesta || response?.mensaje || `La reserva ${reservationCode} regreso a ${sourceRoom}.`,
        icon: 'success',
        customClass: { container: 'next-confirm-container' },
        timer: 1800,
        showConfirmButton: false
      });
      return true;
    } catch (error) {
      console.error('No se pudo desasignar la habitacion.', error);
      await Swal.fire({
        title: 'Error al desasignar habitacion',
        text: this.getAssignmentErrorMessage(error),
        icon: 'error',
        customClass: { container: 'next-confirm-container' },
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#dc3545'
      });
      return false;
    }
  }

  private async confirmAndReassignCalendarReservation(drop: CalendarReservationDropRequest): Promise<void> {
    const sourceReservation = this.workingReservations.find((reservation) => reservation.id === drop.reservationId);
    if (!sourceReservation) {
      console.error('[RoomCalendar][RESERVATION_NOT_FOUND] El drop no coincide con workingReservations.', {
        reservationId: drop.reservationId,
        totalReservations: this.workingReservations.length
      });
      await Swal.fire({
        title: 'Reserva no encontrada',
        text: 'No se encontro la reserva origen en el calendario actual. Recargue el calendario e intente nuevamente.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return;
    }

    const checkedIn = this.isCheckedInReservation(sourceReservation);
    console.info('[RoomCalendar][FLOW_SELECTED] Flujo determinado por estado de reserva.', {
      codReserva: sourceReservation.reservationCode,
      reservationState: sourceReservation.reservationState || '',
      operationalStatus: sourceReservation.status,
      flow: checkedIn ? 'ROOM_CHANGE_CHK' : 'PRECHECKING_ASSIGNMENT'
    });

    if (checkedIn) {
      await this.confirmAndChangeCheckedInRoom(sourceReservation, drop);
      return;
    }

    if (sourceReservation.roomNumber === drop.toRoomNumber && sourceReservation.startDate === drop.targetDate) {
      return;
    }

    const sourceRoom = this.rooms.find((room) => room.roomNumber === sourceReservation.roomNumber);
    const reservation: CalendarAssignableReservation = {
      id                  : sourceReservation.id,
      reservationCode     : sourceReservation.reservationCode || this.extractReservationCode(sourceReservation.id),
      categoryCode        : sourceReservation.categoryCode || sourceRoom?.type || '',
      sourceRoom          : sourceReservation.roomNumber,
      roomNumber          : sourceReservation.roomNumber,
      startDate           : sourceReservation.startDate,
      endDate             : sourceReservation.endDate,
      nights              : this.diffDays(sourceReservation.startDate, sourceReservation.endDate),
      rooms               : 1,
      guestName           : sourceReservation.guestName,
      agency              : sourceReservation.source,
      status              : sourceReservation.status,
      operator            : '',
      pax                 : 0,
      children            : 0
    };

    await this.confirmAndAssignReservation(
      reservation,
      {
        roomNumber: drop.toRoomNumber,
        categoryCode: drop.toCategoryCode,
        targetDate: drop.targetDate,
        valid: true
      },
      { existingReservationId: sourceReservation.id }
    );
  }

  private async confirmAndChangeCheckedInRoom(
    reservation: CalendarReservation,
    drop: CalendarReservationDropRequest
  ): Promise<void> {
    if (this.isAssigningRoom || reservation.roomNumber === drop.toRoomNumber) {
      return;
    }

    const reservationCode = reservation.reservationCode || this.extractReservationCode(reservation.id);
    const sourceCategory = this.normalizeCode(
      reservation.categoryCode || this.rooms.find((room) => room.roomNumber === reservation.roomNumber)?.type
    );
    const targetCategory = this.normalizeCode(
      drop.toCategoryCode || this.rooms.find((room) => room.roomNumber === drop.toRoomNumber)?.type
    );

    if (!sourceCategory || !targetCategory) {
      await Swal.fire({
        title: 'Categoría requerida',
        text: 'No fue posible validar la categoría de la habitación actual o de la habitación destino.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return;
    }

    if (sourceCategory !== targetCategory) {
      await Swal.fire({
        title: 'Categoría diferente',
        text: `La habitación ${drop.toRoomNumber} no pertenece a la categoría ${sourceCategory} de la estancia.`,
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return;
    }

    if (!this.isRoomPlacementValid(drop.toRoomNumber, reservation.startDate, reservation.endDate, reservation.id)) {
      await Swal.fire({
        title: 'Habitación no disponible',
        text: `La habitación ${drop.toRoomNumber} tiene una reserva o bloqueo durante la estancia.`,
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Confirmar cambio de habitación',
      text: `Se trasladará la reserva ${reservationCode} de la habitación ${reservation.roomNumber} a la ${drop.toRoomNumber}. Las fechas no serán modificadas.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, trasladar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d',
      reverseButtons: true
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    try {
      const response = await this.executeCheckedInRoomChange(
        reservation,
        drop.toRoomNumber,
        reservationCode
      );
      this.assertCheckedInRoomChangeSucceeded(response);
      this.applyCalendarReservationMove(reservation.id, drop.toRoomNumber, reservation.startDate);
      this.loadCalendar();
      await Swal.fire({
        title: 'Habitación trasladada',
        text: this.getRoomChangeResponseMessage(response) || `La reserva ${reservationCode} fue trasladada a la habitación ${drop.toRoomNumber}.`,
        icon: 'success',
        timer: 1800,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('No se pudo trasladar la reserva con Check-In.', error);
      await Swal.fire({
        title: 'Error al cambiar habitación',
        text: this.getAssignmentErrorMessage(error),
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#dc3545'
      });
    }
  }

  private async confirmAndAssignReservation(
    reservation: CalendarAssignableReservation,
    target: CalendarAssignmentTarget,
    options: { existingReservationId?: string; exchangeTrayReservationId?: string; skipConfirmation?: boolean } = {}
  ): Promise<boolean> {
    if (this.isAssigningRoom) {
      console.warn('[RoomCalendar][PRECHECKING_ASSIGNMENT][BLOCKED] Ya existe una asignación en proceso.', {
        codReserva: reservation.reservationCode,
        processingReservationIds: [...this.processingReservationIds]
      });
      return false;
    }

    if (!target.valid) {
      console.warn('[RoomCalendar][PRECHECKING_ASSIGNMENT][INVALID_TARGET] El destino fue marcado como no disponible.', {
        codReserva: reservation.reservationCode,
        target
      });
      await Swal.fire({
        title: 'Habitacion no disponible',
        text: `La habitacion ${target.roomNumber} tiene una reserva o bloqueo en el rango seleccionado.`,
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return false;
    }

    if (!reservation.sourceRoom?.trim()) {
      console.error('[RoomCalendar][PRECHECKING_ASSIGNMENT][MISSING_OLD_ROOM] Falta oldHabita.', {
        codReserva: reservation.reservationCode,
        reservation
      });
      await Swal.fire({
        title: 'Habitacion origen requerida',
        text: `La reserva ${reservation.reservationCode} no trae habOrigen. No se puede enviar la asignacion sin oldHabita.`,
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return false;
    }

    const reservationCategory = this.normalizeCode(reservation.categoryCode);
    const targetCategory = this.normalizeCode(target.categoryCode);
    if (!reservationCategory) {
      console.error('[RoomCalendar][PRECHECKING_ASSIGNMENT][MISSING_RESERVATION_CATEGORY] Falta la categoría de la reserva.', {
        codReserva: reservation.reservationCode
      });
      await Swal.fire({
        title: 'Categoria requerida',
        text: `La reserva ${reservation.reservationCode} no tiene categoria de habitacion para validar la asignacion.`,
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return false;
    }

    if (!targetCategory) {
      console.error('[RoomCalendar][PRECHECKING_ASSIGNMENT][MISSING_TARGET_CATEGORY] Falta la categoría del destino.', {
        codReserva: reservation.reservationCode,
        targetRoomNumber: target.roomNumber
      });
      await Swal.fire({
        title: 'Categoria requerida',
        text: `La habitacion ${target.roomNumber} no tiene codigo de categoria para validar la asignacion.`,
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return false;
    }

    const sameCategory = reservationCategory === targetCategory;
    if (!options.skipConfirmation) {
      const result = await Swal.fire({
        title: sameCategory ? 'Asignar habitacion' : 'Categoria diferente',
        html: this.buildAssignmentConfirmationHtml(reservation, target, sameCategory),
        icon: sameCategory ? 'question' : 'warning',
        showCancelButton: true,
        confirmButtonText: sameCategory ? 'Asignar' : 'Asignar de todos modos',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: sameCategory ? '#198754' : '#d97706',
        cancelButtonColor: '#6c757d'
      });

      console.info('[RoomCalendar][PRECHECKING_ASSIGNMENT][CONFIRMATION_RESULT] Resultado del modal.', {
        codReserva: reservation.reservationCode,
        isConfirmed: result.isConfirmed,
        isDenied: result.isDenied,
        isDismissed: result.isDismissed,
        dismiss: result.dismiss || null
      });

      if (!result.isConfirmed) {
        return false;
      }
    }

    const existingReservation = options.existingReservationId
      ? this.workingReservations.find((item) => item.id === options.existingReservationId)
      : null;
    const currentRoomNumber = existingReservation?.roomNumber?.trim() || reservation.sourceRoom.trim();
    const auditId = `${Date.now()}-${reservation.reservationCode}-${currentRoomNumber}-${target.roomNumber}`;

    try {
      const response = await this.executeRoomAssignment(
        {
          codReserva: reservation.reservationCode,
          oldHabita: currentRoomNumber,
          newHabita: target.roomNumber,
          categoria: target.categoryCode,
          operador: this.auth.getCurrentUser()?.usuario?.trim() || reservation.operator || 'admin'
        },
        reservation.id
      );
      this.assertAssignmentSucceeded(response, 'El endpoint no confirmó la asignación.');

      console.info('[RoomCalendar][PRECHECKING_ASSIGNMENT][API_ACCEPTED] El API confirmó la solicitud.', {
        auditId,
        codReserva: reservation.reservationCode,
        oldHabita: currentRoomNumber,
        newHabita: target.roomNumber,
        response
      });

      if (options.exchangeTrayReservationId) {
        const item = this.exchangeTrayReservations.find((candidate) => candidate.reservation.id === options.exchangeTrayReservationId);
        if (item) {
          this.workingReservations = [
            ...this.workingReservations.filter((candidate) => candidate.id !== item.reservation.id),
            { ...item.reservation, roomNumber: target.roomNumber, startDate: item.reservation.startDate, endDate: item.reservation.endDate }
          ];
          this.registerExchangeChange(item.reservation, target.roomNumber, 'assigned', item.backendSourceRoom);
          this.reloadCalendar();
        }
      } else if (options.existingReservationId) {
        if (this.exchangeMode && existingReservation) {
          this.registerExchangeChange(existingReservation, target.roomNumber, 'assigned');
        }
        this.applyCalendarReservationMove(options.existingReservationId, target.roomNumber, target.targetDate);
      } else {
        this.applyPendingReservationDrop(reservation, target.roomNumber, target.targetDate);
        this.selectedPendingReservation = null;
        this.assignmentPanel?.reload();
      }

      if (!this.exchangeMode) {
        this.pendingRoomMoveVerification = {
          auditId,
          flow: 'PRECHECKING_ASSIGNMENT',
          reservationCode: reservation.reservationCode,
          reservationId: reservation.id,
          previousRoomNumber: currentRoomNumber,
          expectedRoomNumber: target.roomNumber,
          apiResponse: response
        };
        this.loadCalendar();
      }
      await Swal.fire({
        title: options.existingReservationId || options.exchangeTrayReservationId ? 'Habitacion reasignada' : 'Habitacion asignada',
        text: response?.respuesta || response?.mensaje || `La reserva ${reservation.reservationCode} fue asignada a la habitacion ${target.roomNumber}.`,
        icon: 'success',
        timer: 1600,
        showConfirmButton: false
      });
      return true;
    } catch (error) {
      console.error('[RoomCalendar][PRECHECKING_ASSIGNMENT][FAILED] No se pudo aplicar la asignación.', {
        codReserva: reservation.reservationCode,
        oldHabita: currentRoomNumber,
        newHabita: target.roomNumber,
        diagnostics: this.getAssignmentErrorDiagnostics(error),
        rawError: error
      });
      await Swal.fire({
        title: 'Error al asignar habitacion',
        text: this.getAssignmentErrorMessage(error),
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#dc3545'
      });
      return false;
    }
  }

  private buildAssignmentConfirmationHtml(reservation: CalendarAssignableReservation, target: CalendarAssignmentTarget, sameCategory: boolean): string {
    const message = sameCategory
      ? 'Se asignara la reserva a la habitacion seleccionada.'
      : 'La categoria de la reserva no coincide con la categoria de la habitacion destino. Revise antes de continuar.';

    return `
      <div style="text-align:left">
        <p style="margin-bottom:12px">${this.escapeHtml(message)}</p>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
          <div style="border:1px solid #dee2e6;border-radius:8px;padding:10px">
            <span style="display:block;color:#6c757d;font-size:12px;font-weight:700">Reserva</span>
            <strong>${this.escapeHtml(reservation.reservationCode)}</strong>
          </div>
          <div style="border:1px solid #dee2e6;border-radius:8px;padding:10px">
            <span style="display:block;color:#6c757d;font-size:12px;font-weight:700">Habitacion destino</span>
            <strong>${this.escapeHtml(target.roomNumber)}</strong>
          </div>
          <div style="border:1px solid #dee2e6;border-radius:8px;padding:10px">
            <span style="display:block;color:#6c757d;font-size:12px;font-weight:700">Categoria reserva</span>
            <strong>${this.escapeHtml(reservation.categoryCode || 'N/D')}</strong>
          </div>
          <div style="border:1px solid #dee2e6;border-radius:8px;padding:10px">
            <span style="display:block;color:#6c757d;font-size:12px;font-weight:700">Categoria habitacion</span>
            <strong>${this.escapeHtml(target.categoryCode || 'N/D')}</strong>
          </div>
        </div>
      </div>
    `;
  }

  private buildUnassignmentConfirmationHtml(reservationCode: string, currentRoom: string, sourceRoom: string, categoryCode: string): string {
    return `
      <div style="text-align:left">
        <p style="margin-bottom:12px">Se quitara la habitacion asignada y la reserva regresara a su habitacion origen.</p>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
          <div style="border:1px solid #dee2e6;border-radius:8px;padding:10px">
            <span style="display:block;color:#6c757d;font-size:12px;font-weight:700">Reserva</span>
            <strong>${this.escapeHtml(reservationCode)}</strong>
          </div>
          <div style="border:1px solid #dee2e6;border-radius:8px;padding:10px">
            <span style="display:block;color:#6c757d;font-size:12px;font-weight:700">Categoria</span>
            <strong>${this.escapeHtml(categoryCode || 'N/D')}</strong>
          </div>
          <div style="border:1px solid #dee2e6;border-radius:8px;padding:10px">
            <span style="display:block;color:#6c757d;font-size:12px;font-weight:700">oldHabita</span>
            <strong>${this.escapeHtml(currentRoom)}</strong>
          </div>
          <div style="border:1px solid #dee2e6;border-radius:8px;padding:10px">
            <span style="display:block;color:#6c757d;font-size:12px;font-weight:700">newHabita</span>
            <strong>${this.escapeHtml(sourceRoom)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  private getAssignmentErrorMessage(error: unknown): string {
    const fallback = 'No se pudo asignar la habitacion. Revise la conexion con el API o la respuesta del servidor.';
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

    return httpError.message ? `${httpError.message}${statusDetail}` : fallback;
  }

  private getAssignmentErrorDiagnostics(error: unknown): Record<string, unknown> {
    if (!error || typeof error !== 'object') {
      return { value: error ?? null };
    }

    const httpError = error as {
      name?: string;
      message?: string;
      status?: number;
      statusText?: string;
      url?: string;
      error?: unknown;
      stack?: string;
    };

    return {
      name: httpError.name || null,
      message: httpError.message || null,
      status: httpError.status ?? null,
      statusText: httpError.statusText || null,
      url: httpError.url || null,
      backend: httpError.error ?? null,
      stack: httpError.stack || null
    };
  }

  private async executeRoomAssignment(request: CalendarRoomAssignmentRequest, reservationId: string): Promise<CalendarRoomAssignmentResponse> {
    this.isAssigningRoom = true;
    this.processingReservationIds.add(reservationId);
    this.cdr.markForCheck();
    try {
      const payload: CalendarRoomAssignmentRequest = {
        codReserva: request.codReserva.trim(),
        oldHabita: request.oldHabita.trim(),
        newHabita: request.newHabita.trim(),
        categoria: request.categoria.trim(),
        operador: request.operador.trim()
      };

      console.log('[RoomCalendar] Solicitud para asignar reserva desde el panel derecho al calendario:', {
        metodo: 'PUT',
        endpoint: this.assignmentEndpoint,
        payload
      });

      console.info('[RoomCalendar][PRECHECKING_ASSIGNMENT] Enviando movimiento no-CHK.', {
        codReserva: request.codReserva,
        oldHabita: request.oldHabita,
        newHabita: request.newHabita,
        categoria: request.categoria
      });
      const response = await firstValueFrom(
        this.calendarService.assignReservationRoom(request).pipe(takeUntilDestroyed(this.destroyRef))
      );
      console.info('[RoomCalendar][PRECHECKING_ASSIGNMENT] Respuesta recibida.', response);
      return response;
    } catch (error) {
      console.error('[RoomCalendar][PRECHECKING_ASSIGNMENT][HTTP_ERROR] Falló el PUT /api/prechecking/asignar-habitacion.', {
        request: {
          codReserva: request.codReserva,
          oldHabita: request.oldHabita,
          newHabita: request.newHabita,
          categoria: request.categoria,
          operador: request.operador
        },
        diagnostics: this.getAssignmentErrorDiagnostics(error),
        rawError: error
      });
      throw error;
    } finally {
      this.processingReservationIds.delete(reservationId);
      this.isAssigningRoom = this.processingReservationIds.size > 0;
      this.cdr.markForCheck();
    }
  }

  private async executeCheckedInRoomChange(
    reservation: CalendarReservation,
    newRoomNumber: string,
    reservationCode: string
  ): Promise<unknown> {
    this.isAssigningRoom = true;
    this.processingReservationIds.add(reservation.id);
    this.cdr.markForCheck();
    try {
      const stay = await firstValueFrom(
        this.roomStayManagementService
          .getRoomStay(reservation.roomNumber, reservationCode)
          .pipe(takeUntilDestroyed(this.destroyRef))
      );
      const stayReservationCode = stay?.codReserva?.trim() || '';
      const folio = stay?.folio?.trim() || '';

      if (!stay || !folio) {
        throw new Error('No fue posible obtener el folio maestro de la estancia hospedada.');
      }

      if (this.normalizeCode(stayReservationCode) !== this.normalizeCode(reservationCode)) {
        throw new Error(`La habitación ${reservation.roomNumber} ya no corresponde a la reserva ${reservationCode}.`);
      }

      const request: RoomChangePayload = {
        codReserva: reservationCode,
        oldHab: reservation.roomNumber,
        newHab: newRoomNumber,
        folio,
        operador: this.getOperator()
      };

      console.info('[RoomCalendar][ROOM_CHANGE] Enviando movimiento CHK.', {
        codReserva: request.codReserva,
        oldHab: request.oldHab,
        newHab: request.newHab
      });
      const response = await firstValueFrom(
        this.roomStayManagementService.changeRoom(request).pipe(takeUntilDestroyed(this.destroyRef))
      );
      console.info('[RoomCalendar][ROOM_CHANGE] Respuesta recibida.', response);
      return response;
    } finally {
      this.processingReservationIds.delete(reservation.id);
      this.isAssigningRoom = this.processingReservationIds.size > 0;
      this.cdr.markForCheck();
    }
  }

  private assertCheckedInRoomChangeSucceeded(response: unknown): void {
    if (!response || typeof response !== 'object') {
      return;
    }

    const apiResponse = response as { ok?: boolean; success?: boolean; respuesta?: string; mensaje?: string; message?: string };
    if (apiResponse.ok === false || apiResponse.success === false) {
      throw new Error(apiResponse.respuesta || apiResponse.mensaje || apiResponse.message || 'El endpoint no confirmó el cambio de habitación.');
    }
  }

  private getRoomChangeResponseMessage(response: unknown): string {
    if (!response || typeof response !== 'object') {
      return '';
    }

    const apiResponse = response as { respuesta?: string; mensaje?: string; message?: string };
    return apiResponse.respuesta || apiResponse.mensaje || apiResponse.message || '';
  }

  private assertAssignmentSucceeded(response: CalendarRoomAssignmentResponse, fallbackMessage: string): void {
    if (!response || response.ok === false || response.success === false) {
      throw new Error(response?.respuesta || response?.mensaje || response?.message || fallbackMessage);
    }

    if (response.ok !== true && response.success !== true) {
      console.error('[RoomCalendar][PRECHECKING_ASSIGNMENT][INVALID_RESPONSE] El API no devolvió una confirmación positiva.', response);
      throw new Error(response.respuesta || response.mensaje || response.message || fallbackMessage);
    }
  }

  private getOperator(): string {
    return this.auth.getCurrentUser()?.usuario?.trim() || 'admin';
  }

  private isCheckedInReservation(reservation: CalendarReservation): boolean {
    return isCheckedInCalendarReservation(reservation);
  }

  private normalizeCode(value: string | null | undefined): string {
    return (value ?? '').trim().toUpperCase();
  }

  private extractReservationCode(reservationId: string): string {
    return reservationId.split('|')[0]?.trim() || reservationId;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private loadCalendar(resetScroll = false): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.calendarService
      .getCalendarApiData(this.startDate, this.endDate, this.operationalDate)
      .pipe(
        catchError((error) => {
          console.error('No se pudo cargar el calendario de habitaciones.', error);
          if (this.pendingRoomMoveVerification) {
            console.error('[RoomCalendar][MOVE_VERIFICATION][REFRESH_FAILED] No fue posible verificar el movimiento.', {
              audit: this.pendingRoomMoveVerification,
              diagnostics: this.getAssignmentErrorDiagnostics(error),
              rawError: error
            });
            this.pendingRoomMoveVerification = null;
          }
          this.errorMessage = 'No se pudo cargar el calendario de habitaciones.';
          return of({ rooms: [] as RoomStatus[], reservations: [] as CalendarReservation[], typeOptions: [] as RoomType[] });
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((data) => {
        this.rooms = data.rooms;
        this.workingReservations = data.reservations;
        this.typeOptions = data.typeOptions;

        this.verifyPendingRoomMove(data.reservations);

        if (this.type && !this.typeOptions.includes(this.type)) {
          this.type = null;
        }

        this.reloadCalendar(resetScroll);
      });
  }

  private verifyPendingRoomMove(reservations: CalendarReservation[]): void {
    const audit = this.pendingRoomMoveVerification;
    if (!audit) {
      return;
    }

    this.pendingRoomMoveVerification = null;
    const matches = reservations.filter(
      (reservation) => this.normalizeCode(reservation.reservationCode || this.extractReservationCode(reservation.id)) === this.normalizeCode(audit.reservationCode)
    );
    const persisted = matches.some((reservation) => reservation.roomNumber.trim() === audit.expectedRoomNumber.trim());

    if (persisted) {
      console.info('[RoomCalendar][MOVE_VERIFICATION][PERSISTED] El calendario confirmó la habitación destino.', {
        ...audit,
        roomsReturned: matches.map((reservation) => reservation.roomNumber)
      });
      return;
    }

    console.error('[RoomCalendar][MOVE_VERIFICATION][NOT_PERSISTED] El API aceptó el movimiento, pero el calendario no devolvió la reserva en la habitación destino.', {
      ...audit,
      roomsReturned: matches.map((reservation) => reservation.roomNumber),
      possibleCauses: [
        'MANRV_PRECHECKING devolvió OK sin ejecutar UPDATE.',
        'oldHabita no coincide con PRV06_NumHabita.',
        'La habitación destino fue considerada ocupada por el procedimiento.',
        'La reserva no fue devuelta por calendario-habitaciones después del cambio.'
      ]
    });
  }

  private bindOperationalDate(): void {
    this.operationalDate$
      .pipe(
        map((date) => toPmsDateInputValue(date)),
        filter((date): date is string => !!date),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((operationalDate) => {
        const range = this.rangeLength;
        this.operationalDate = operationalDate;
        this.startDate = operationalDate;
        this.endDate = this.shiftDate(operationalDate, range - 1);
        this.loadCalendar(true);
      });
  }

  private buildQuery() {
    return {
      startDate: this.startDate,
      endDate: this.endDate,
      search: this.search,
      type: this.type,
      status: this.status
    };
  }

  private get rangeLength(): number {
    return Math.max(1, (differenceInPmsCalendarDays(this.startDate, this.endDate) ?? 0) + 1);
  }

  private shiftDate(baseIsoDate: string, offset: number): string {
    return toPmsDateInputValue(addPmsCalendarDays(baseIsoDate, offset));
  }

  private diffDays(startDate: string, endDate: string): number {
    return Math.max(1, differenceInPmsCalendarDays(startDate, endDate) ?? 1);
  }
}
