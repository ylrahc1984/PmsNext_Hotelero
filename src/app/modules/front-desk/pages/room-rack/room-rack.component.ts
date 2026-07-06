import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router, NavigationExtras } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { TipoCambio, TipoCambioService } from 'src/app/demo/administracion/tipo-cambio/tipo-cambio.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RoomRackNavigationState, RoomRackRoom } from './models/room-rack-room.model';
import { RoomRackService } from './services/room-rack.service';

type EstadoHabitacion =
  | 'Disponible'
  | 'Ocupada'
  | 'Bloqueada'
  | 'Sucia'
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
  private readonly destroyRef           = inject(DestroyRef);
  private readonly cdr                  = inject(ChangeDetectorRef);

  readonly hotelActual                  = 'Hotel PMSNext Central';
  readonly ultimaActualizacion          = new Date();
  readonly fechaOperacion               = '01/07/2026';

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
  tipoCambio            : TipoCambio | null = null;
  tipoCambioLoading     = false;
  tipoCambioError       = '';

  readonly acciones: AccionOperativa[] = [
    { label: 'Asignar Habitacion', icon: 'home', accent: 'primary' },
    { label: 'Ingresar Arribos', icon: 'flight_land' },
    { label: 'Lista Pax In House', icon: 'groups' },
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

  actualizarVentana(): void {
    this.cargarHabitaciones();
    this.cargarTipoCambio();
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
    return habitacion.data.CR05_Clean === 'S' ? 'Habitación sucia' : 'Habitación limpia';
  }

  getCleanIndicatorStyle(habitacion: HabitacionRack): Record<string, string> {
    const isDirty = habitacion.data.CR05_Clean === 'S';

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
      return this.habitaciones.filter((habitacion) => habitacion.data.CR05_Clean === 'S').length;
    }

    if (estado === 'Limpia') {
      return this.habitaciones.filter((habitacion) => habitacion.data.CR05_Clean === 'L').length;
    }

    return this.habitaciones.filter((habitacion) => habitacion.estado === estado).length;
  }

  private mapEstadoHabitacion(room: RoomRackRoom): EstadoHabitacion {
    const estados: Record<string, EstadoHabitacion> = {
      B: 'Bloqueada',
      D: 'Disponible',
      O: 'Ocupada'
    };

    return estados[room.CR05_EstHab] ?? 'Disponible';
  }

  private slugEstado(estado: EstadoHabitacion | 'Todas'): string {
    return estado
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '-');
  }
}
