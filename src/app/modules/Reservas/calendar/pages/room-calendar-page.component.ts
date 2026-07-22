import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { CanDeactivateReservaCreate } from 'src/app/core/guards/can-deactivate-reserva-create.guard';
import { RoomStatus, RoomType } from '../../interfaces/room-status.interface';
import { CalendarGridComponent } from '../components/calendar-grid/calendar-grid.component';
import { CalendarHeaderComponent } from '../components/calendar-header/calendar-header.component';
import { CalendarToolbarComponent } from '../components/calendar-toolbar/calendar-toolbar.component';
import { ReservationAssignmentPanelComponent } from '../components/reservation-assignment-panel/reservation-assignment-panel.component';
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

@Component({
  selector: 'app-room-calendar-page',
  standalone: true,
  imports: [CommonModule, CalendarToolbarComponent, RoomSidebarComponent, CalendarHeaderComponent, CalendarGridComponent, ReservationAssignmentPanelComponent],
  templateUrl: './room-calendar-page.component.html',
  styleUrls: ['./room-calendar-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomCalendarPageComponent implements OnInit, CanDeactivateReservaCreate {
  private readonly calendarService = inject(CalendarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly auth = inject(AuthService);

  @ViewChild(RoomSidebarComponent) roomSidebar?: RoomSidebarComponent;
  @ViewChild(CalendarGridComponent) calendarGrid?: CalendarGridComponent;
  @ViewChild(ReservationAssignmentPanelComponent) assignmentPanel?: ReservationAssignmentPanelComponent;

  typeOptions: RoomType[] = [];
  readonly statusOptions: Array<{ label: string; value: CalendarFilterStatus }> = [
    { label: 'Todos', value: null },
    { label: 'Disponible', value: 'DISPONIBLE' },
    { label: 'Ocupado', value: 'OCUPADA' },
    { label: 'Reservado', value: 'RESERVADA' },
    { label: 'Bloqueado', value: 'BLOQUEADA' }
  ];

  startDate                           = this.toIsoDate(new Date());
  endDate                             = this.shiftDate(this.startDate, 29);
  search                              = '';
  type                                : RoomType | null = null;
  status                              : CalendarFilterStatus = null;
  headerScrollLeft                    = 0;
  isLoading                           = false;
  errorMessage                        = '';
  assignmentPanelCollapsed            = false;
  isAssigningRoom                     = false;
  selectedPendingReservation          : CalendarAssignableReservation | null = null;
  reservationActionMenu               : { block: CalendarReservationBlockView; x: number; y: number } | null = null;
  exchangeMode                        = false;
  exchangeTrayReservations            : ExchangeTrayReservation[] = [];
  exchangeSessionChanges              : RoomExchangeChange[] = [];
  selectedExchangeTrayReservationId   : string | null = null;
  readonly processingReservationIds   = new Set<string>();
  private rooms                       : RoomStatus[] = [];
  private workingReservations         : CalendarReservation[] = [];
  calendarData                        : CalendarData = this.calendarService.getCalendarData(this.buildQuery(), this.rooms, this.workingReservations);

  ngOnInit(): void {
    this.loadCalendar(true);
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
    this.startDate = this.toIsoDate(new Date());
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

  onSidebarScrollTop(scrollTop: number): void {
    this.calendarGrid?.setScrollTop(scrollTop);
  }

  openReservationActionMenu(payload: CalendarReservationBlockSelect): void {
    if (payload.block.reservation.isOperationalBlock) {
      return;
    }

    payload.event.preventDefault();
    payload.event.stopPropagation();
    if (this.isCheckedInReservation(payload.block.reservation)) {
      this.onCheckedInReservationMoveBlocked(payload.block.reservation);
      return;
    }
    this.reservationActionMenu = {
      block: payload.block,
      x: Math.min(payload.event.clientX, window.innerWidth - 220),
      y: Math.min(payload.event.clientY + 8, window.innerHeight - 72)
    };
  }

  onReservationDrop(drop: CalendarReservationDropRequest): void {
    if (drop.pendingReservation) {
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
      title: 'Movimiento no permitido',
      text: `La reserva ${reservation.reservationCode || reservation.id} ya tiene Check-In realizado y no puede moverse de habitación.`,
      icon: 'warning',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#2f5f8d'
    });
  }

  onPendingReservationDragStart(payload: { reservation: CalendarAssignableReservation; event: PointerEvent }): void {
    this.calendarGrid?.startPendingReservationDrag(payload);
  }

  onPendingReservationSelect(reservation: CalendarAssignableReservation): void {
    this.selectedPendingReservation = this.selectedPendingReservation?.id === reservation.id ? null : reservation;
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

  closeReservationActionMenu(): void {
    this.reservationActionMenu = null;
  }

  onUnassignReservationFromMenu(block: CalendarReservationBlockView): void {
    this.closeReservationActionMenu();
    if (this.isCheckedInReservation(block.reservation)) {
      this.onCheckedInReservationMoveBlocked(block.reservation);
      return;
    }
    void this.confirmAndUnassignCalendarReservation(block);
  }

  onMoveReservationToTrayFromMenu(block: CalendarReservationBlockView): void {
    this.closeReservationActionMenu();
    void this.moveReservationToExchangeTray(block.reservation.id);
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
        block: this.calendarService.getReservationBlockView(change.reservation, this.startDate, this.calendarData.dates.length)
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
      id: reservation.id,
      reservationCode: reservation.reservationCode || this.extractReservationCode(reservation.id),
      categoryCode: reservation.categoryCode || this.rooms.find((room) => room.roomNumber === reservation.roomNumber)?.type || '',
      sourceRoom,
      roomNumber: reservation.roomNumber,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      nights: this.diffDays(reservation.startDate, reservation.endDate),
      rooms: 1,
      guestName: reservation.guestName,
      agency: reservation.source,
      status: reservation.status,
      operator: '',
      pax: 0,
      children: 0
    };
  }

  private formatDisplayDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return year && month && day ? `${day}/${month}/${year}` : isoDate;
  }

  private reloadCalendar(resetScroll = false): void {
    this.calendarData = this.calendarService.getCalendarData(this.buildQuery(), this.rooms, this.workingReservations);
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
      id: `pending-${reservation.id}-${roomNumber}-${targetDate}`,
      reservationCode: reservation.reservationCode,
      roomNumber,
      categoryCode: reservation.categoryCode,
      startDate: targetDate,
      endDate,
      status: 'RESERVADA',
      guestName: reservation.guestName,
      source: reservation.agency || reservation.reservationCode
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

  private async confirmAndUnassignCalendarReservation(block: CalendarReservationBlockView): Promise<void> {
    if (this.isAssigningRoom) {
      return;
    }

    const reservation = block.reservation;
    const reservationCode = reservation.reservationCode || this.extractReservationCode(reservation.id);
    const sourceRoom = reservation.sourceRoom?.trim();

    if (!sourceRoom) {
      await Swal.fire({
        title: 'Habitacion origen requerida',
        text: `La reserva ${reservationCode} no trae habOrigen. No se puede desasignar sin saber a que habitacion origen debe regresar.`,
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return;
    }

    const currentRoom = reservation.roomNumber;
    const categoryCode = reservation.categoryCode || this.rooms.find((room) => room.roomNumber === currentRoom)?.type || '';

    if (!categoryCode.trim()) {
      await Swal.fire({
        title: 'Categoria requerida',
        text: `La reserva ${reservationCode} no tiene categoria para enviar la desasignacion.`,
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Desasignar habitacion',
      html: this.buildUnassignmentConfirmationHtml(reservationCode, currentRoom, sourceRoom, categoryCode),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Desasignar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#6c757d'
    });

    if (!result.isConfirmed) {
      return;
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
        timer: 1800,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('No se pudo desasignar la habitacion.', error);
      await Swal.fire({
        title: 'Error al desasignar habitacion',
        text: this.getAssignmentErrorMessage(error),
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#dc3545'
      });
    }
  }

  private async confirmAndReassignCalendarReservation(drop: CalendarReservationDropRequest): Promise<void> {
    const sourceReservation = this.workingReservations.find((reservation) => reservation.id === drop.reservationId);
    if (!sourceReservation) {
      await Swal.fire({
        title: 'Reserva no encontrada',
        text: 'No se encontro la reserva origen en el calendario actual. Recargue el calendario e intente nuevamente.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#2f5f8d'
      });
      return;
    }

    if (this.isCheckedInReservation(sourceReservation)) {
      this.onCheckedInReservationMoveBlocked(sourceReservation);
      return;
    }

    if (sourceReservation.roomNumber === drop.toRoomNumber && sourceReservation.startDate === drop.targetDate) {
      return;
    }

    const sourceRoom = this.rooms.find((room) => room.roomNumber === sourceReservation.roomNumber);
    const reservation: CalendarAssignableReservation = {
      id: sourceReservation.id,
      reservationCode: sourceReservation.reservationCode || this.extractReservationCode(sourceReservation.id),
      categoryCode: sourceReservation.categoryCode || sourceRoom?.type || '',
      sourceRoom: sourceReservation.roomNumber,
      roomNumber: sourceReservation.roomNumber,
      startDate: sourceReservation.startDate,
      endDate: sourceReservation.endDate,
      nights: this.diffDays(sourceReservation.startDate, sourceReservation.endDate),
      rooms: 1,
      guestName: sourceReservation.guestName,
      agency: sourceReservation.source,
      status: sourceReservation.status,
      operator: '',
      pax: 0,
      children: 0
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

  private async confirmAndAssignReservation(
    reservation: CalendarAssignableReservation,
    target: CalendarAssignmentTarget,
    options: { existingReservationId?: string; exchangeTrayReservationId?: string; skipConfirmation?: boolean } = {}
  ): Promise<boolean> {
    if (this.isAssigningRoom) {
      return false;
    }

    if (!target.valid) {
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

      if (!result.isConfirmed) {
        return false;
      }
    }

    const existingReservation = options.existingReservationId
      ? this.workingReservations.find((item) => item.id === options.existingReservationId)
      : null;
    try {
      const response = await this.executeRoomAssignment(
        {
        codReserva: reservation.reservationCode,
        oldHabita: reservation.sourceRoom,
        newHabita: target.roomNumber,
        categoria: target.categoryCode,
        operador: this.auth.getCurrentUser()?.usuario?.trim() || reservation.operator || 'admin'
        },
        reservation.id
      );
      this.assertAssignmentSucceeded(response, 'El endpoint no confirmó la asignación.');

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
      console.error('No se pudo asignar la habitacion.', error);
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

  private async executeRoomAssignment(request: CalendarRoomAssignmentRequest, reservationId: string): Promise<CalendarRoomAssignmentResponse> {
    this.isAssigningRoom = true;
    this.processingReservationIds.add(reservationId);
    this.cdr.markForCheck();
    try {
      return await firstValueFrom(this.calendarService.assignReservationRoom(request).pipe(takeUntilDestroyed(this.destroyRef)));
    } finally {
      this.processingReservationIds.delete(reservationId);
      this.isAssigningRoom = this.processingReservationIds.size > 0;
      this.cdr.markForCheck();
    }
  }

  private assertAssignmentSucceeded(response: CalendarRoomAssignmentResponse, fallbackMessage: string): void {
    if (response?.ok === false || response?.success === false) {
      throw new Error(response.respuesta || response.mensaje || fallbackMessage);
    }
  }

  private getOperator(): string {
    return this.auth.getCurrentUser()?.usuario?.trim() || 'admin';
  }

  private isCheckedInReservation(reservation: CalendarReservation): boolean {
    return reservation.reservationState?.trim().toUpperCase() === 'CHK';
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
      .getCalendarApiData(this.startDate, this.endDate)
      .pipe(
        catchError((error) => {
          console.error('No se pudo cargar el calendario de habitaciones.', error);
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

        if (this.type && !this.typeOptions.includes(this.type)) {
          this.type = null;
        }

        this.reloadCalendar(resetScroll);
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
    const start = new Date(`${this.startDate}T00:00:00`).getTime();
    const end = new Date(`${this.endDate}T00:00:00`).getTime();
    return Math.max(1, Math.floor((end - start) / 86400000) + 1);
  }

  private shiftDate(baseIsoDate: string, offset: number): string {
    const date = new Date(`${baseIsoDate}T00:00:00`);
    date.setDate(date.getDate() + offset);
    return this.toIsoDate(date);
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private diffDays(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T00:00:00`).getTime();
    return Math.max(1, Math.floor((end - start) / 86400000));
  }
}
