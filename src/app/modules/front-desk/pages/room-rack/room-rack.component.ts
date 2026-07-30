import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router, NavigationExtras } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { firstValueFrom, fromEvent, interval, merge, of } from 'rxjs';
import { catchError, distinctUntilChanged, filter, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { OperationalAction } from 'src/app/core/models/operational-context.model';
import { AuthService } from 'src/app/core/services/auth.service';
import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { OperationalPolicyService } from 'src/app/core/services/operational-policy.service';
import {
  differenceInPmsCalendarDays,
  normalizePmsDateDDMMYYYY,
  parsePmsDate,
  toPmsDateInputValue
} from 'src/app/core/utils/pms-date.util';
import { TipoCambio, TipoCambioService } from 'src/app/demo/administracion/tipo-cambio/tipo-cambio.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  getRoomOperationalStateLabel,
  resolveRackOperationalState,
  RoomOperationalVisualState
} from 'src/app/shared/models/room-operational-visual-state';
import { RoomRackNavigationState, RoomRackRoom } from './models/room-rack-room.model';
import { RoomBlockRequest, RoomRackService } from './services/room-rack.service';

type EstadoHabitacion =
  | 'Disponible'
  | 'Ocupada'
  | 'Entrada hoy'
  | 'Salida Hoy'
  | 'Salida Mañana'
  | 'Bloqueada'
  | 'Sucia'
  | 'Limpia'
  | 'Requiere atención';

interface HabitacionRack {
  numero       : string;
  categoria    : string;
  estado       : EstadoHabitacion;
  data          : RoomRackRoom;
}

interface EstadoKpi {
  label       : string;
  estado      : EstadoHabitacion | 'Todas';
  cantidad    : number;
  className   : string;
}

interface AccionOperativa {
  label     : string;
  icon      : string;
  accent    ?: 'primary' | 'muted';
}

interface BloqueoHabitacionForm {
  fechaInicial  : string;
  fechaFin      : string;
  descripcion   : string;
  observaciones : string;
}

@Component({
  selector: 'app-room-rack',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './room-rack.component.html',
  styleUrls: ['./room-rack.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomRackComponent implements OnInit {
  private static readonly automaticRefreshIntervalMs = 30_000;
  private readonly router               = inject(Router);
  private readonly roomRackService      = inject(RoomRackService);
  private readonly tipoCambioService    = inject(TipoCambioService);
  private readonly authService          = inject(AuthService);
  private readonly operationalDateService = inject(OperationalDateService);
  private readonly operationalPolicy    = inject(OperationalPolicyService);
  private readonly destroyRef           = inject(DestroyRef);
  private readonly cdr                  = inject(ChangeDetectorRef);
  private readonly operationalDate$     = toObservable(this.operationalDateService.operationalDate);
  private isRackRefreshInProgress        = false;
  private pendingRackRefresh             = false;
  private isOperationalRefreshInProgress = false;

  readonly hotelActual                  = 'Hotel PMSNext Central';
  readonly ultimaActualizacion          = new Date();
  fechaOperacion                        = '';

  readonly estados: EstadoHabitacion[]  = [
    'Disponible',
    'Entrada hoy',
    'Ocupada',
    'Salida Hoy',
    'Salida Mañana',
    'Bloqueada',
    'Sucia',
    'Limpia',
    'Requiere atención'
  ];

  habitaciones          : HabitacionRack[] = [];
  kpis                  : EstadoKpi[] = this.generarKpis();
  resumen               = this.generarResumen();
  estadoKpiSeleccionado : EstadoHabitacion | 'Todas' = 'Todas';
  isLoading             = false;
  errorMessage          = '';
  cleanActionMessage    = '';
  tipoCambio            : TipoCambio | null = null;
  tipoCambioLoading     = false;
  tipoCambioError       = '';
  updatingCleanRooms    = new Set<string>();
  bloqueandoHabitacion  = false;
  bloqueoModalRoom      : HabitacionRack | null = null;
  bloqueoErrorMessage   = '';
  bloqueoForm           : BloqueoHabitacionForm = this.createDefaultBloqueoForm();

  readonly acciones: AccionOperativa[] = [
    { label: 'Asignar Habitacion', icon: 'home', accent: 'primary' },
    { label: 'Ingresar Arribos', icon: 'flight_land' },
    { label: 'Lista de Pax In House', icon: 'groups' },
    { label: 'Imprimir Hoja Registro', icon: 'print' } 
  ];

  ngOnInit(): void {
    const navigationState = history.state as { checkoutCompleted?: boolean; checkedOutRoom?: string };
    if (navigationState.checkoutCompleted) {
      this.cleanActionMessage = navigationState.checkedOutRoom
        ? `Check Out de la habitación ${navigationState.checkedOutRoom} completado. Inventario actualizado.`
        : 'Check Out completado. Inventario actualizado.';
    }

    this.bindOperationalDate();
    this.bindAutomaticRefresh();
  }

  async seleccionarHabitacion(habitacion: HabitacionRack): Promise<void> {
    if (habitacion.estado === 'Entrada hoy') {
      const result = await Swal.fire({
        title: 'Habitación reservada',
        html: `La habitación <strong>${this.escapeHtml(habitacion.numero)}</strong> está pendiente de ingreso o de realizar el Check In.`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Ir a Ingresar Arribos',
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#0d6efd',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
        focusCancel: true
      });

      if (result.isConfirmed) {
        await this.router.navigate(['/front-desk/arribos-dia']);
      }
      return;
    }

    if (habitacion.estado === 'Disponible') {
      const allowed = await this.operationalPolicy.require(OperationalAction.CreateOperation);
      if (!allowed) return;

      const refreshedRoom = await this.revalidateAvailableRoom(habitacion, 'iniciar el Walk In');
      if (!refreshedRoom) return;

      const extras: NavigationExtras = {
        state: { roomRackRoom: { ...refreshedRoom.data } satisfies RoomRackNavigationState }
      };
      await this.router.navigate(['/front-desk/walk-in'], extras);
      return;
    }

    const navigationState: RoomRackNavigationState = { ...habitacion.data };
    const extras: NavigationExtras = { state: { roomRackRoom: navigationState } };
    await this.router.navigate(['/front-desk/habitaciones/room-stay-management', habitacion.numero], extras);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  onRoomCardKeydown(event: KeyboardEvent, habitacion: HabitacionRack): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    void this.seleccionarHabitacion(habitacion);
  }

  onLimpiarHabitacion(room: HabitacionRack): void {
    this.actualizarLimpiezaHabitacion(room, 'L');
  }

  onRepasarHabitacion(room: HabitacionRack): void {
    this.actualizarLimpiezaHabitacion(room, 'S');
  }

  async onBloquearHabitacion(room: HabitacionRack): Promise<void> {
    const allowed = await this.operationalPolicy.require(OperationalAction.CreateOperation);
    if (!allowed) return;

    const refreshedRoom = await this.revalidateAvailableRoom(room, 'bloquear la habitación');
    if (!refreshedRoom) return;

    this.abrirModalBloqueo(refreshedRoom);
  }

  abrirModalBloqueo(room: HabitacionRack): void {
    this.bloqueoModalRoom = room;
    this.bloqueoErrorMessage = '';
    this.bloqueoForm = this.createDefaultBloqueoForm();
  }

  cerrarModalBloqueo(): void {
    if (this.bloqueandoHabitacion) {
      return;
    }

    this.bloqueoModalRoom = null;
    this.bloqueoErrorMessage = '';
  }

  async confirmarBloqueoHabitacion(): Promise<void> {
    const room = this.bloqueoModalRoom;

    if (!room || this.bloqueandoHabitacion) {
      return;
    }

    const allowed = await this.operationalPolicy.require(
      OperationalAction.CreateOperation,
      { refresh: true }
    );
    if (!allowed) return;

    this.fechaOperacion = normalizePmsDateDDMMYYYY(this.operationalDateService.operationalDate());
    const validationMessage = this.validarBloqueoForm();
    if (validationMessage) {
      this.bloqueoErrorMessage = validationMessage;
      return;
    }

    const refreshedRoom = await this.revalidateAvailableRoom(room, 'confirmar el bloqueo');
    if (!refreshedRoom) {
      this.bloqueoModalRoom = null;
      return;
    }

    const payload = this.buildBloqueoPayload(refreshedRoom);

    this.bloqueandoHabitacion = true;
    this.bloqueoErrorMessage = '';
    this.cdr.markForCheck();

    this.roomRackService
      .blockRoom(payload)
      .pipe(
        finalize(() => {
          this.bloqueandoHabitacion = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.cleanActionMessage = 'Habitacion bloqueada correctamente.';
          this.bloqueoModalRoom = null;
          this.cargarHabitaciones(true);
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('No se pudo bloquear la habitacion.', error);
          this.bloqueoErrorMessage = 'No se pudo bloquear la habitacion. Revise los datos e intente nuevamente.';
          this.cdr.markForCheck();
        }
      });
  }

  openDatePicker(input: HTMLInputElement): void {
    if (this.bloqueandoHabitacion) {
      return;
    }

    const picker = input as HTMLInputElement & { showPicker?: () => void };

    if (picker.showPicker) {
      picker.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  onBloqueoDateSelected(field: 'fechaInicial' | 'fechaFin', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const formatted = this.isoToDisplayDate(value);

    if (!formatted) {
      return;
    }

    this.bloqueoForm[field] = formatted;
    this.bloqueoErrorMessage = '';
  }

  toIsoDate(value: string): string {
    return toPmsDateInputValue(value);
  }

  actualizarVentana(silent = false): void {
    if (this.isOperationalRefreshInProgress) {
      return;
    }

    this.isOperationalRefreshInProgress = true;
    const previousOperationalDate = this.fechaOperacion;

    this.operationalDateService
      .refresh()
      .pipe(
        finalize(() => {
          this.isOperationalRefreshInProgress = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (operationalDate) => {
          const normalizedDate = normalizePmsDateDDMMYYYY(operationalDate);
          if (normalizedDate && normalizedDate === previousOperationalDate) {
            this.cargarHabitaciones(silent);
            this.cargarTipoCambio();
          }
        },
        error: () => {
          if (!silent) {
            this.handleOperationalDateError();
          }
        }
      });
  }

  ejecutarAccion(accion: AccionOperativa): void {
    if (accion.label === 'Asignar Habitacion') {
      this.router.navigate(['/reservas/calendario']);
      return;
    }

    if (accion.label === 'Ingresar Arribos') {
      this.router.navigate(['/front-desk/arribos-dia']);
      return;
    }

    if (accion.label === 'Lista de Pax In House') {
      this.router.navigate(['/front-desk/huespedes-in-house']);
    }
  }

  get compra(): number {
    return this.tipoCambio?.compra ?? 0;
  }

  get venta(): number {
    return this.tipoCambio?.venta ?? 0;
  }

  get habitacionesFiltradas(): HabitacionRack[] {
    if (this.estadoKpiSeleccionado === 'Todas') {
      return this.habitaciones;
    }

    if (this.estadoKpiSeleccionado === 'Sucia') {
      return this.habitaciones.filter(
        (habitacion) => this.normalizeText(habitacion.data.CR05_Clean).toUpperCase() === 'S'
      );
    }

    if (this.estadoKpiSeleccionado === 'Limpia') {
      return this.habitaciones.filter(
        (habitacion) => this.normalizeText(habitacion.data.CR05_Clean).toUpperCase() === 'L'
      );
    }

    return this.habitaciones.filter(
      (habitacion) => habitacion.estado === this.estadoKpiSeleccionado
    );
  }

  seleccionarKpi(kpi: EstadoKpi): void {
    this.estadoKpiSeleccionado =
      this.estadoKpiSeleccionado === kpi.estado && kpi.estado !== 'Todas'
        ? 'Todas'
        : kpi.estado;
  }

  getMensajeFiltroVacio(): string {
    if (this.estadoKpiSeleccionado === 'Todas') {
      return 'No existen habitaciones para la fecha seleccionada.';
    }

    return `No existen habitaciones en el filtro "${this.estadoKpiSeleccionado}".`;
  }

  getEstadoClass(estado: EstadoHabitacion | 'Todas'): string {
    const stateByLabel: Record<EstadoHabitacion | 'Todas', string> = {
      Todas: 'all',
      Disponible: 'available',
      'Entrada hoy': 'arrival-today',
      Ocupada: 'occupied',
      'Salida Hoy': 'checkout-today',
      'Salida Mañana': 'checkout-tomorrow',
      Bloqueada: 'blocked',
      Sucia: 'dirty',
      Limpia: 'clean',
      'Requiere atención': 'attention'
    };

    return `state-${stateByLabel[estado]}`;
  }

  getCleanLabel(habitacion: HabitacionRack): string {
    return this.normalizeText(habitacion.data.CR05_Clean).toUpperCase() === 'S' ? 'Habitación sucia' : 'Habitación limpia';
  }

  getCleanIndicatorStyle(habitacion: HabitacionRack): Record<string, string> {
    const isDirty = this.normalizeText(habitacion.data.CR05_Clean).toUpperCase() === 'S';

    return {
      position        : 'absolute',
      top             : '7px',
      right           : '8px',
      width           : '12px',
      height          : '12px',
      border          : '1.5px solid #0f172a',
      borderRadius    : '3px',
      background      : isDirty ? 'linear-gradient(135deg, #6f4428, #b7794b)' : '#ffffff',
      boxShadow       : '0 2px 5px rgba(15, 23, 42, 0.18)',
      pointerEvents   : 'none',
      transform       : 'rotate(45deg)'
    };
  }

  trackByHabitacion(_: number, habitacion: HabitacionRack): string {
    return habitacion.numero;
  }

  trackByEstado(_: number, kpi: EstadoKpi): string {
    return kpi.label;
  }

  trackByAccion(_: number, accion: AccionOperativa): string {
    return accion.label;
  }

  isActualizandoLimpieza(habitacion: HabitacionRack): boolean {
    return this.updatingCleanRooms.has(habitacion.numero);
  }

  private async revalidateAvailableRoom(
    requestedRoom: HabitacionRack,
    operationLabel: string
  ): Promise<HabitacionRack | null> {
    try {
      const operationalDate = normalizePmsDateDDMMYYYY(
        await firstValueFrom(this.operationalDateService.refresh())
      );
      if (!operationalDate) {
        throw new Error('No se obtuvo una fecha operativa válida.');
      }

      this.fechaOperacion = operationalDate;
      const rooms = await firstValueFrom(
        this.roomRackService.getAllRoomsStatus(operationalDate)
      );
      this.applyRackRooms(rooms);

      const room = this.habitaciones.find(
        (item) => item.numero === requestedRoom.numero
      );
      if (!room) {
        await Swal.fire({
          title: 'Habitación no disponible',
          text: `La habitación ${requestedRoom.numero} ya no forma parte del inventario operativo.`,
          icon: 'warning',
          confirmButtonText: 'Aceptar'
        });
        return null;
      }

      if (room.estado !== 'Disponible') {
        await Swal.fire({
          title: 'Estado actualizado',
          text: `No se puede ${operationLabel}: la habitación ${room.numero} ahora figura como ${room.estado}.`,
          icon: 'warning',
          confirmButtonText: 'Aceptar'
        });
        return null;
      }

      return room;
    } catch (error) {
      console.error(`No se pudo revalidar la habitación antes de ${operationLabel}.`, error);
      await Swal.fire({
        title: 'No se pudo validar la habitación',
        text: 'La operación fue cancelada para evitar trabajar con información desactualizada.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
      return null;
    }
  }

  private cargarHabitaciones(silent = false): void {
    if (!this.fechaOperacion) {
      if (!silent) {
        this.handleOperationalDateError();
      }
      return;
    }

    if (this.isRackRefreshInProgress) {
      this.pendingRackRefresh = true;
      return;
    }

    this.isRackRefreshInProgress = true;
    if (!silent) {
      this.isLoading = true;
      this.errorMessage = '';
    }
    this.roomRackService
      .getAllRoomsStatus(this.fechaOperacion)
      .pipe(
        catchError((error) => {
          console.error('No se pudo cargar el Room Rack.', error);
          if (!silent) {
            this.errorMessage = 'No se pudo cargar el estado de habitaciones.';
          }
          return of(null);
        }),
        finalize(() => {
          this.isRackRefreshInProgress = false;
          if (!silent) {
            this.isLoading = false;
          }
          this.cdr.markForCheck();
          if (this.pendingRackRefresh) {
            this.pendingRackRefresh = false;
            this.cargarHabitaciones(true);
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((rooms) => {
        if (rooms) {
          this.applyRackRooms(rooms);
        }
      });
  }

  private applyRackRooms(rooms: RoomRackRoom[]): void {
    this.habitaciones = rooms
      .filter((room) => this.normalizeText(room.CR05_Activo).toUpperCase() !== 'N')
      .map((room) => this.mapRoomRackRoom(room));
    this.kpis = this.generarKpis();
    this.resumen = this.generarResumen();
    this.cdr.markForCheck();
  }

  private actualizarLimpiezaHabitacion(room: HabitacionRack, clean: 'L' | 'S'): void {
    const roomNumber = room.data.CR05_NumHab || room.numero;
    const roomKey = room.numero;

    if (this.updatingCleanRooms.has(roomKey)) {
      return;
    }

    this.cleanActionMessage = '';
    this.updatingCleanRooms.add(roomKey);
    this.cdr.markForCheck();

    this.roomRackService
      .updateRoomCleanStatus(roomNumber, clean)
      .pipe(
        finalize(() => {
          this.updatingCleanRooms.delete(roomKey);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          room.data.CR05_Clean = clean;
          this.kpis = this.generarKpis();
          this.resumen = this.generarResumen();
          this.cleanActionMessage = clean === 'L' ? 'Habitacion marcada como limpia.' : 'Habitacion marcada para repaso.';
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('No se pudo actualizar la limpieza de la habitacion.', error);
          this.cleanActionMessage = 'No se pudo actualizar el estado de limpieza.';
          this.cdr.markForCheck();
        }
      });
  }

  private createDefaultBloqueoForm(): BloqueoHabitacionForm {
    const operationalDate = this.fechaOperacion;

    return {
      fechaInicial: operationalDate,
      fechaFin: operationalDate,
      descripcion: 'Bloqueo operativo',
      observaciones: ''
    };
  }

  private validarBloqueoForm(): string {
    const fechaInicial = this.normalizeText(this.bloqueoForm.fechaInicial);
    const fechaFin = this.normalizeText(this.bloqueoForm.fechaFin);
    const descripcion = this.normalizeText(this.bloqueoForm.descripcion);

    if (!this.isDisplayDate(fechaInicial) || !this.isDisplayDate(fechaFin)) {
      return 'Seleccione fechas validas en formato dd/MM/yyyy.';
    }

    if (!descripcion) {
      return 'Indique el motivo del bloqueo.';
    }

    const start = this.parseDisplayDate(fechaInicial);
    const end = this.parseDisplayDate(fechaFin);

    if (!start || !end || end.getTime() < start.getTime()) {
      return 'La fecha final no puede ser menor que la fecha inicial.';
    }

    const operationalDate = normalizePmsDateDDMMYYYY(this.fechaOperacion);
    const daysFromOperationalDate = differenceInPmsCalendarDays(operationalDate, fechaInicial);
    if (!operationalDate || daysFromOperationalDate === null) {
      return 'No se pudo validar el bloqueo contra la fecha operativa.';
    }

    if (daysFromOperationalDate < 0) {
      return `La fecha inicial no puede ser anterior a la fecha operativa ${operationalDate}.`;
    }

    return '';
  }

  private buildBloqueoPayload(room: HabitacionRack): RoomBlockRequest {
    return {
      proceso: 1,
      numeroHabitacion: Number(room.data.CR05_NumHab || room.numero || 0),
      categoriaHabitacion: this.normalizeText(room.data.CR05_CateHab || room.categoria),
      descripcionHabitacion: this.normalizeText(room.data.CR05_Descripcion || room.data.CR05_TipoHab || room.categoria),
      fechaInicial: this.normalizeText(this.bloqueoForm.fechaInicial),
      fechaFin: this.normalizeText(this.bloqueoForm.fechaFin),
      descripcion: this.normalizeText(this.bloqueoForm.descripcion),
      observaciones: this.normalizeText(this.bloqueoForm.observaciones),
      operador: this.getOperador(),
      respuesta: ''
    };
  }

  private getOperador(): string {
    const user = this.authService.getCurrentUser();
    return this.normalizeText(user?.usuario ?? user?.nombre ?? user?.nombreUsu ?? 'SISTEMA') || 'SISTEMA';
  }

  private isDisplayDate(value: string): boolean {
    return /^\d{2}\/\d{2}\/\d{4}$/.test(value) && !!this.parseDisplayDate(value);
  }

  private parseDisplayDate(value: string): Date | null {
    return parsePmsDate(value);
  }

  private isoToDisplayDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value);
  }

  private cargarTipoCambio(): void {
    if (!this.fechaOperacion) {
      this.tipoCambio = null;
      this.tipoCambioLoading = false;
      this.tipoCambioError = 'Fecha operativa no disponible';
      return;
    }

    this.tipoCambioLoading = true;
    this.tipoCambioError = '';

    this.tipoCambioService
      .fetchTipoCambio(this.fechaOperacion, 'usd')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.tipoCambio = items[0] ?? null;
          this.tipoCambioLoading = false;
          this.tipoCambioError = this.tipoCambio ? '' : 'Tipo de cambio no disponible para la fecha operativa';
          this.cdr.markForCheck();
        },
        error: () => {
          this.tipoCambio = null;
          this.tipoCambioLoading = false;
          this.tipoCambioError = 'No se pudo consultar el tipo de cambio';
          this.cdr.markForCheck();
        }
      });
  }

  private mapRoomRackRoom(room: RoomRackRoom): HabitacionRack {
    return {
      numero: String(room.CR05_NumHab),
      categoria: room.CR05_Descripcion || room.CR05_TipoHab || room.CR05_CateHab,
      estado: this.mapEstadoHabitacion(room),
      data: room
    };
  }

  private generarKpis(): EstadoKpi[] {
    const todos: EstadoKpi = {
      label       : 'Todas',
      estado      : 'Todas',
      cantidad    : this.habitaciones.length,
      className   : this.getEstadoClass('Todas')
    };

    return [
      todos,
      ...this.estados.map((estado) => ({
        label: estado,
        estado,
        cantidad: this.contarPorEstado(estado),
        className: this.getEstadoClass(estado)
      }))
    ];
  }

  private generarResumen(): EstadoKpi[] {
    return [
      { label: 'Total habitaciones', estado: 'Todas', cantidad: this.habitaciones.length, className: this.getEstadoClass('Todas') },
      ...this.estados.map((estado) => ({
        label: estado === 'Disponible' ? 'Disponibles' : estado === 'Ocupada' ? 'Ocupadas' : estado,
        estado,
        cantidad: this.contarPorEstado(estado),
        className: this.getEstadoClass(estado)
      }))
    ];
  }

  private contarPorEstado(estado: EstadoHabitacion): number {
    if (estado === 'Sucia') {
      return this.habitaciones.filter((habitacion) => this.normalizeText(habitacion.data.CR05_Clean).toUpperCase() === 'S').length;
    }

    if (estado === 'Limpia') {
      return this.habitaciones.filter((habitacion) => this.normalizeText(habitacion.data.CR05_Clean).toUpperCase() === 'L').length;
    }

    return this.habitaciones.filter((habitacion) => habitacion.estado === estado).length;
  }

  private mapEstadoHabitacion(room: RoomRackRoom): EstadoHabitacion {
    const visualState: RoomOperationalVisualState = resolveRackOperationalState(room.CR05_EstHab);
    const label = getRoomOperationalStateLabel(visualState);
    const rackLabels: Record<RoomOperationalVisualState, EstadoHabitacion> = {
      available: 'Disponible',
      'arrival-today': 'Entrada hoy',
      occupied: 'Ocupada',
      'checkout-tomorrow': 'Salida Mañana',
      'checkout-today': 'Salida Hoy',
      blocked: 'Bloqueada',
      'future-reservation': 'Requiere atención',
      attention: 'Requiere atención'
    };

    return rackLabels[visualState] ?? (label as EstadoHabitacion);
  }

  private bindOperationalDate(): void {
    this.isLoading = true;

    this.operationalDate$
      .pipe(
        filter((date): date is string => !!normalizePmsDateDDMMYYYY(date)),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((operationalDate) => {
        this.fechaOperacion = normalizePmsDateDDMMYYYY(operationalDate);
        this.bloqueoForm = this.createDefaultBloqueoForm();
        this.cargarHabitaciones();
        this.cargarTipoCambio();
        this.cdr.markForCheck();
      });

    this.operationalDateService
      .ensureLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.handleOperationalDateError()
      });
  }

  private bindAutomaticRefresh(): void {
    merge(
      interval(RoomRackComponent.automaticRefreshIntervalMs),
      fromEvent(window, 'focus')
    )
      .pipe(
        filter(() => Boolean(this.fechaOperacion)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.actualizarVentana(true));
  }

  private handleOperationalDateError(): void {
    this.fechaOperacion = '';
    this.habitaciones = [];
    this.kpis = this.generarKpis();
    this.resumen = this.generarResumen();
    this.isLoading = false;
    this.errorMessage = 'No se pudo obtener la fecha operativa para cargar el estado de habitaciones.';
    this.tipoCambio = null;
    this.tipoCambioLoading = false;
    this.tipoCambioError = 'Fecha operativa no disponible';
    this.cdr.markForCheck();
  }

  private normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }
}
