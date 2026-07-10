import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router, NavigationExtras } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { AuthService } from 'src/app/core/services/auth.service';
import { TipoCambio, TipoCambioService } from 'src/app/demo/administracion/tipo-cambio/tipo-cambio.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RoomRackNavigationState, RoomRackRoom } from './models/room-rack-room.model';
import { RoomBlockRequest, RoomRackService } from './services/room-rack.service';

type EstadoHabitacion =
  | 'Disponible'
  | 'Ocupada'
  | 'Bloqueada'
  | 'Sucia'
  | 'Reservada'
  | 'Limpia';

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
  private readonly roomRackService      = inject(RoomRackService);
  private readonly tipoCambioService    = inject(TipoCambioService);
  private readonly authService          = inject(AuthService);
  private readonly destroyRef           = inject(DestroyRef);
  private readonly cdr                  = inject(ChangeDetectorRef);

  readonly hotelActual                  = 'Hotel PMSNext Central';
  readonly ultimaActualizacion          = new Date();
  readonly fechaOperacion               = this.getTodayDisplayDate();

  readonly estados: EstadoHabitacion[]  = [
    'Disponible',
    'Ocupada',
    'Bloqueada',
    'Sucia',
    'Limpia'
  ];

  habitaciones          : HabitacionRack[] = [];
  kpis                  : EstadoKpi[] = this.generarKpis();
  resumen               = this.generarResumen();
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

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.cargarHabitaciones();
    this.cargarTipoCambio();
  }

  seleccionarHabitacion(habitacion: HabitacionRack): void {
    const navigationState: RoomRackNavigationState = {
      ...habitacion.data
    };
    const extras: NavigationExtras = { state: { roomRackRoom: navigationState } };

    if (habitacion.estado === 'Disponible') {
      this.router.navigate(['/front-desk/walk-in'], extras);
      return;
    }

    this.router.navigate(['/front-desk/habitaciones/room-stay-management', habitacion.numero], extras);
  }

  onRoomCardKeydown(event: KeyboardEvent, habitacion: HabitacionRack): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.seleccionarHabitacion(habitacion);
  }

  onLimpiarHabitacion(room: HabitacionRack): void {
    this.actualizarLimpiezaHabitacion(room, 'L');
  }

  onRepasarHabitacion(room: HabitacionRack): void {
    this.actualizarLimpiezaHabitacion(room, 'S');
  }

  onBloquearHabitacion(room: HabitacionRack): void {
    this.abrirModalBloqueo(room);
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

  confirmarBloqueoHabitacion(): void {
    const room = this.bloqueoModalRoom;

    if (!room || this.bloqueandoHabitacion) {
      return;
    }

    const validationMessage = this.validarBloqueoForm();
    if (validationMessage) {
      this.bloqueoErrorMessage = validationMessage;
      return;
    }

    const payload = this.buildBloqueoPayload(room);

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
          room.data.CR05_EstHab = 'B';
          room.estado = 'Bloqueada';
          this.kpis = this.generarKpis();
          this.resumen = this.generarResumen();
          this.cleanActionMessage = 'Habitacion bloqueada correctamente.';
          this.bloqueoModalRoom = null;
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
    const date = this.parseDisplayDate(value);

    if (!date) {
      return '';
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  actualizarVentana(): void {
    this.cargarHabitaciones();
    this.cargarTipoCambio();
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

  getEstadoClass(estado: EstadoHabitacion | 'Todas'): string {
    return `estado-${this.slugEstado(estado)}`;
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

  private cargarHabitaciones(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.roomRackService
      .getAllRoomsStatus(this.fechaOperacion)
      .pipe(
        catchError((error) => {
          console.error('No se pudo cargar el Room Rack.', error);
          this.errorMessage = 'No se pudo cargar el estado de habitaciones.';
          return of([] as RoomRackRoom[]);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((rooms) => {
        this.habitaciones = rooms.map((room) => this.mapRoomRackRoom(room));
        this.kpis = this.generarKpis();
        this.resumen = this.generarResumen();
      });
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
    const today = this.getTodayDisplayDate();

    return {
      fechaInicial: today,
      fechaFin: today,
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

    return '';
  }

  private buildBloqueoPayload(room: HabitacionRack): RoomBlockRequest {
    return {
      proceso: 0,
      numeroHabitacion: Number(room.data.CR05_NumHab || room.numero || 0),
      categoriaHabitacion: this.normalizeText(room.data.CR05_CateHab || room.categoria),
      descripcionHabitacion: this.normalizeText(room.data.CR05_Descripcion || room.data.CR05_TipoHab || room.categoria),
      fechaInicial: this.normalizeText(this.bloqueoForm.fechaInicial),
      fechaFin: this.normalizeText(this.bloqueoForm.fechaFin),
      descripcion: this.normalizeText(this.bloqueoForm.descripcion),
      observaciones: this.normalizeText(this.bloqueoForm.observaciones),
      operador: this.getOperador(),
      respuesta: 'string'
    };
  }

  private getOperador(): string {
    const user = this.authService.getCurrentUser();
    return this.normalizeText(user?.usuario ?? user?.nombre ?? user?.nombreUsu ?? 'Admin') || 'Admin';
  }

  private isDisplayDate(value: string): boolean {
    return /^\d{2}\/\d{2}\/\d{4}$/.test(value) && !!this.parseDisplayDate(value);
  }

  private parseDisplayDate(value: string): Date | null {
    const [dayRaw, monthRaw, yearRaw] = value.split('/');
    const day = Number(dayRaw);
    const month = Number(monthRaw);
    const year = Number(yearRaw);
    const date = new Date(year, month - 1, day);

    if (
      !Number.isInteger(day) ||
      !Number.isInteger(month) ||
      !Number.isInteger(year) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  private isoToDisplayDate(value: string): string {
    if (!value) {
      return '';
    }

    const [year, month, day] = value.split('-');

    if (!year || !month || !day) {
      return '';
    }

    return `${day}/${month}/${year}`;
  }

  private cargarTipoCambio(): void {
    this.tipoCambioLoading = true;
    this.tipoCambioError = '';

    this.tipoCambioService
      .fetchTipoCambio(this.fechaOperacion, 'usd')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.tipoCambio = items[0] ?? this.tipoCambioService.getActual() ?? null;
          this.tipoCambioLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.tipoCambio = this.tipoCambioService.getActual() ?? null;
          this.tipoCambioLoading = false;
          this.tipoCambioError = 'Referencia no actualizada';
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
      {
        label: 'Entradas hoy',
        estado: 'Reservada',
        cantidad: this.contarPorEstado('Reservada'),
        className: this.getEstadoClass('Reservada')
      },
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
    const estados: Record<string, EstadoHabitacion> = {
      B: 'Bloqueada',
      D: 'Disponible',
      O: 'Ocupada',
      R: 'Reservada'
    };

    return estados[this.normalizeText(room.CR05_EstHab).toUpperCase()] ?? 'Disponible';
  }

  private slugEstado(estado: EstadoHabitacion | 'Todas'): string {
    return estado
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '-');
  }

  private getTodayDisplayDate(): string {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${now.getFullYear()}`;
  }

  private normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }
}
