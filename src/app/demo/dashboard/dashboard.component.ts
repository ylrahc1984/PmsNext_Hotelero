import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { Reserva, ReservasService } from '../reservas/services/reservas.service';
import { OrdenesService } from '../ordenes/ordenes.service';
import { DashboardService } from './dashboard.service';
import { Weather } from './models/weather.model';
import { WeatherCardComponent } from './components/weather-card/weather-card.component';
import { TipoCambio, TipoCambioService } from '../administracion/tipo-cambio/tipo-cambio.service';
import { RoomRackRoom } from 'src/app/modules/front-desk/pages/room-rack/models/room-rack-room.model';
import { RoomRackService } from 'src/app/modules/front-desk/pages/room-rack/services/room-rack.service';
import { CheckInArrival } from 'src/app/modules/front-desk/check-in-arrivals/models/check-in-arrival.model';
import { CheckInArrivalsService } from 'src/app/modules/front-desk/check-in-arrivals/services/check-in-arrivals.service';
import { RestaurantPuntoVentaService } from '../restaurante/restaurant-punto-venta/restaurant-punto-venta.service';
import { RestaurantDashboardService } from '../restaurante/restaurant-dashboard/restaurant-dashboard.service';
import { PuntoVentaUsuario, RestauranteMesaOperacion, UbicacionMesa } from '../restaurante/models/restaurant-operacion.models';
import {
  OccupancyForecastCategoryRequest,
  OccupancyForecastResponseRow,
  OccupancyForecastService
} from 'src/app/modules/front-desk/pages/occupancy-forecast/occupancy-forecast.service';
import { RoomCategory } from 'src/app/modules/front-desk/settings/room-categories/models/room-category.model';
import { RoomCategoriesService } from 'src/app/modules/front-desk/settings/room-categories/services/room-categories.service';

interface DashboardAlert {
  icon: string;
  message: string;
}

interface StatusSummary {
  label: string;
  value: number;
  percent: number;
}

interface OccupancyForecastPreviewDay {
  fecha: string;
  label: string;
  ocupacion: number;
  ocupadas: number;
  total: number;
  bloqueadas: number;
  pax: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule, WeatherCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly defaultCity = 'San Jose';
  readonly userName = this.resolveUserName();
  readonly todayIso = this.getTodayIsoDate();
  readonly todayDisplay = this.getTodayDisplayDate();

  reservasDia           = 0;
  reservasPendientes    = 0;
  ordenesActivas        = 0;
  ingresosEstimados     = 0;
  llegadasHoy           = 0;
  salidasHoy            = 0;
  checkInPendientes     = 0;
  checkOutPendientes    = 0;
  ocupacionActual       = 0;
  habitacionesTotal     = 0;
  habitacionesDisponibles = 0;
  habitacionesOcupadas  = 0;
  habitacionesLimpias   = 0;
  habitacionesSucias    = 0;
  habitacionesFueraServicio = 0;
  habitacionesBloqueadas = 0;
  housekeepingEnProceso = 0;
  habitacionesSupervisadas = 0;
  mesasTotal            = 0;
  mesasOcupadas         = 0;
  pedidosActivos        = 0;
  ticketsAbiertos       = 0;
  ventasRestaurante     = 0;
  roomServiceActivo     = 0;
  restaurantePuntoVenta = 'Sin punto de venta';
  dashboardLoading      = false;
  dashboardError        : string | null = null;
  restaurantLoading     = false;
  restaurantError       : string | null = null;
  alertasOperativas     : DashboardAlert[] = [];
  resumenReservas       : StatusSummary[] = [];
  resumenHabitaciones   : StatusSummary[] = [];
  weather               : Weather | null = null;
  loading               = false;
  weatherError          : string | null = null;
  tipoCambio            : TipoCambio | null = null;
  tipoCambioLoading     = false;
  tipoCambioError       : string | null = null;
  occupancyForecastLoading = false;
  occupancyForecastError: string | null = null;
  occupancyForecastDays: OccupancyForecastPreviewDay[] = [];
  occupancyForecastToday: OccupancyForecastPreviewDay | null = null;
  occupancyForecastAverage = 0;
  occupancyForecastPeak: OccupancyForecastPreviewDay | null = null;
  occupancyForecastRoomNights = 0;
  occupancyForecastPax = 0;

  sales = [
    {
      title         : 'Reservas del Dia',
      amount        : '0',
      percentage    : '+0%',
      progress      : 0,
      progress_bg   : 'bg-c-blue',
      icon          : 'icon-calendar',
      design        : 'col-xl-3 col-md-6'
    },
    {
      title         : 'Reservas Pendientes',
      amount        : '0',
      percentage    : '0%',
      progress      : 0,
      progress_bg   : 'bg-c-green',
      icon          : 'icon-clock',
      design        : 'col-xl-3 col-md-6'
    },
    {
      title         : 'Ordenes Activas',
      amount        : '0',
      percentage    : '0%',
      progress      : 0,
      progress_bg   : 'bg-c-yellow',
      icon          : 'icon-clipboard',
      design        : 'col-xl-3 col-md-6'
    },
    {
      title         : 'Ingresos Estimados',
      amount        : 'CRC 0',
      percentage    : '+0%',
      progress      : 0,
      progress_bg   : 'bg-c-red',
      icon          : 'icon-dollar-sign',
      design        : 'col-xl-3 col-md-6'
    }
  ];

  private reservasService = inject(ReservasService);
  private ordenesService = inject(OrdenesService);
  private dashboardService = inject(DashboardService);
  private tipoCambioService = inject(TipoCambioService);
  private roomRackService = inject(RoomRackService);
  private checkInArrivalsService = inject(CheckInArrivalsService);
  private restaurantPuntoVentaService = inject(RestaurantPuntoVentaService);
  private restaurantDashboardService = inject(RestaurantDashboardService);
  private occupancyForecastService = inject(OccupancyForecastService);
  private roomCategoriesService = inject(RoomCategoriesService);

  ngOnInit() {
    this.calculateMetrics();
    this.loadRestaurantMetrics();
    this.loadOccupancyForecast();
    this.bindWeatherState();
    this.loadTipoCambio();
    this.dashboardService.loadWeather(this.defaultCity);
  }

  calculateMetrics() {
    this.dashboardLoading = true;
    this.dashboardError = null;

    forkJoin({
      reservas: this.reservasService.getReservas(1, 500).pipe(
        map((response) => response.data ?? []),
        catchError(() => of([] as Reserva[]))
      ),
      habitaciones: this.roomRackService.getAllRoomsStatus(this.todayDisplay).pipe(catchError(() => of([] as RoomRackRoom[]))),
      llegadas: this.checkInArrivalsService.getPendientes(this.todayIso, false).pipe(catchError(() => of([] as CheckInArrival[]))),
      llegadasPendientes: this.checkInArrivalsService.getPendientes(this.todayIso, true).pipe(
        catchError(() => of([] as CheckInArrival[]))
      )
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: ({ reservas, habitaciones, llegadas, llegadasPendientes }) => {
        this.applyReservationMetrics(reservas, llegadas, llegadasPendientes);
        this.applyRoomMetrics(habitaciones);
        this.rebuildAlerts();
        this.dashboardLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.resetOperationalMetrics();
        this.dashboardLoading = false;
        this.dashboardError = 'No se pudo actualizar la operacion del dia.';
        this.cdr.markForCheck();
      }
    });

    const ordenes = this.ordenesService.getOrdenes();
    this.ordenesActivas = ordenes.filter(o => o.estado !== 'COM' && o.estado !== 'CAN').length;
    this.sales[2].amount = this.ordenesActivas.toString();
  }

  getRoomPercent(value: number): string {
    return `${this.percent(value, this.habitacionesTotal)}%`;
  }

  getRestaurantPercent(value: number): string {
    return `${this.percent(value, this.mesasTotal)}%`;
  }

  trackByAlert(_: number, alert: DashboardAlert): string {
    return alert.message;
  }

  trackBySummary(_: number, item: StatusSummary): string {
    return item.label;
  }

  trackByForecastDay(_: number, item: OccupancyForecastPreviewDay): string {
    return item.fecha;
  }

  private bindWeatherState(): void {
    this.dashboardService.weather$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((weather) => {
      this.weather = weather;
      this.cdr.markForCheck();
    });

    this.dashboardService.loading$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((loading) => {
      this.loading = loading;
      this.cdr.markForCheck();
    });

    this.dashboardService.error$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((error) => {
      this.weatherError = error;
      this.cdr.markForCheck();
    });
  }

  private loadTipoCambio(): void {
    this.tipoCambioLoading = true;
    this.tipoCambioError = null;

    this.tipoCambioService
      .fetchTipoCambio(this.todayDisplay, 'usd')
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
          this.tipoCambioError = 'No se pudo actualizar';
          this.cdr.markForCheck();
        }
      });
  }

  private loadRestaurantMetrics(): void {
    this.restaurantLoading = true;
    this.restaurantError = null;

    this.restaurantPuntoVentaService
      .obtenerPuntosVentaPorUsuario(this.resolveUserCode())
      .pipe(
        switchMap((puntosVenta) => {
          const puntoVenta = this.selectRestaurantPointOfSale(puntosVenta);
          if (!puntoVenta) {
            return of({ puntoVenta: null, ubicaciones: [] as UbicacionMesa[], mesas: [] as RestauranteMesaOperacion[] });
          }

          return this.restaurantDashboardService.obtenerUbicacionesMesas(puntoVenta.MPV07_CodPntVenta).pipe(
            switchMap((response) => {
              const ubicaciones = response.datos ?? [];
              const calls = ubicaciones
                .filter((ubicacion) => this.isActiveRestaurantArea(ubicacion))
                .map((ubicacion) =>
                  this.restaurantDashboardService
                    .obtenerMesasPorUbicacion(puntoVenta.MPV07_CodPntVenta, ubicacion.MPV09_CodUbicacion)
                    .pipe(catchError(() => of([] as RestauranteMesaOperacion[])))
                );

              if (!calls.length) {
                return of({ puntoVenta, ubicaciones, mesas: [] as RestauranteMesaOperacion[] });
              }

              return forkJoin(calls).pipe(map((groups) => ({ puntoVenta, ubicaciones, mesas: groups.flat() })));
            })
          );
        }),
        catchError(() => {
          this.restaurantError = 'No se pudo cargar restaurante.';
          return of({ puntoVenta: null, ubicaciones: [] as UbicacionMesa[], mesas: [] as RestauranteMesaOperacion[] });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ puntoVenta, ubicaciones, mesas }) => {
        this.applyRestaurantMetrics(puntoVenta, ubicaciones, mesas);
        this.restaurantLoading = false;
        this.cdr.markForCheck();
      });
  }

  private loadOccupancyForecast(): void {
    this.occupancyForecastLoading = true;
    this.occupancyForecastError = null;

    this.roomCategoriesService
      .getRoomCategories()
      .pipe(
        map((categories) => this.mapForecastCategories(categories)),
        switchMap((categorias) => {
          if (!categorias.length) {
            return of([] as OccupancyForecastResponseRow[]);
          }

          return this.occupancyForecastService
            .getForecast({
              proceso: 1,
              fechaInicio: this.todayDisplay,
              fechaFinal: this.getDisplayDateDaysFromToday(6),
              categorias
            })
            .pipe(catchError(() => of([] as OccupancyForecastResponseRow[])));
        }),
        catchError(() => {
          this.occupancyForecastError = 'No se pudo cargar el forecast de ocupacion.';
          return of([] as OccupancyForecastResponseRow[]);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((rows) => {
        this.applyOccupancyForecast(rows);
        this.occupancyForecastLoading = false;
        this.rebuildAlerts();
        this.cdr.markForCheck();
      });
  }

  private applyReservationMetrics(reservas: Reserva[], llegadas: CheckInArrival[], llegadasPendientes: CheckInArrival[]): void {
    const reservasActivas = reservas.filter((reserva) => !this.isCancelledStatus(reserva.PRV01_Estado));
    const reservasCreadasHoy = reservasActivas.filter((reserva) => this.toDateKey(reserva.PRV01_FecCreacion) === this.todayIso);
    const reservasIngresoHoy = reservasActivas.filter((reserva) => this.toDateKey(reserva.PRV01_FecIngresa) === this.todayIso);
    const reservasSalidaHoy = reservasActivas.filter((reserva) => this.toDateKey(reserva.PRV01_FecSalida) === this.todayIso);

    this.reservasDia = reservasCreadasHoy.length;
    this.reservasPendientes = reservasActivas.filter((reserva) => this.isPendingReservationStatus(reserva.PRV01_Estado)).length;
    this.llegadasHoy = llegadas.length || reservasIngresoHoy.length;
    this.checkInPendientes = llegadasPendientes.length || llegadas.filter((item) => Number(item.procesado || 0) === 0).length;
    this.salidasHoy = reservasSalidaHoy.length;
    this.checkOutPendientes = reservasSalidaHoy.filter((reserva) => !this.isCheckedOutReservation(reserva)).length;
    this.ingresosEstimados = reservasCreadasHoy.reduce((sum, reserva) => sum + Number(reserva.PRV01_TotalRsv || 0), 0);
    this.resumenReservas = this.buildStatusSummary(reservasActivas.map((reserva) => reserva.PRV01_Estado));

    this.sales[0].amount = this.reservasDia.toString();
    this.sales[1].amount = this.reservasPendientes.toString();
    this.sales[3].amount = `CRC ${this.ingresosEstimados.toLocaleString()}`;
  }

  private applyRoomMetrics(rooms: RoomRackRoom[]): void {
    const activeRooms = rooms.filter((room) => this.normalizeText(room.CR05_Activo).toUpperCase() !== 'N');
    const roomsForOccupancy = activeRooms.length ? activeRooms : rooms;

    this.habitacionesTotal = roomsForOccupancy.length;
    this.habitacionesOcupadas = roomsForOccupancy.filter((room) => this.normalizeText(room.CR05_EstHab).toUpperCase() === 'O').length;
    this.habitacionesDisponibles = roomsForOccupancy.filter((room) => this.normalizeText(room.CR05_EstHab).toUpperCase() === 'D').length;
    this.habitacionesBloqueadas = roomsForOccupancy.filter((room) => this.normalizeText(room.CR05_EstHab).toUpperCase() === 'B').length;
    this.habitacionesLimpias = roomsForOccupancy.filter((room) => this.normalizeText(room.CR05_Clean).toUpperCase() === 'L').length;
    this.habitacionesSucias = roomsForOccupancy.filter((room) => this.normalizeText(room.CR05_Clean).toUpperCase() === 'S').length;
    this.habitacionesFueraServicio = rooms.filter((room) => this.normalizeText(room.CR05_Activo).toUpperCase() === 'N').length;
    this.housekeepingEnProceso = roomsForOccupancy.filter((room) => {
      const clean = this.normalizeText(room.CR05_Clean).toUpperCase();
      return clean && clean !== 'L' && clean !== 'S';
    }).length;
    this.habitacionesSupervisadas = this.habitacionesLimpias;
    this.ocupacionActual = this.percent(this.habitacionesOcupadas, this.habitacionesTotal);
    this.resumenHabitaciones = [
      { label: 'Ocupadas', value: this.habitacionesOcupadas, percent: this.percent(this.habitacionesOcupadas, this.habitacionesTotal) },
      { label: 'Disponibles', value: this.habitacionesDisponibles, percent: this.percent(this.habitacionesDisponibles, this.habitacionesTotal) },
      { label: 'Bloqueadas', value: this.habitacionesBloqueadas, percent: this.percent(this.habitacionesBloqueadas, this.habitacionesTotal) }
    ];
  }

  private applyRestaurantMetrics(
    puntoVenta: PuntoVentaUsuario | null,
    ubicaciones: UbicacionMesa[],
    mesas: RestauranteMesaOperacion[]
  ): void {
    this.restaurantePuntoVenta = puntoVenta?.MPV07_NomPntVenta || puntoVenta?.MPV07_CodPntVenta || 'Sin punto de venta';
    this.mesasTotal = mesas.length || ubicaciones.reduce((sum, ubicacion) => sum + Number(ubicacion.MPV09_TotMesas || 0), 0);
    this.mesasOcupadas = mesas.filter((mesa) => this.isOccupiedRestaurantTable(mesa)).length;
    this.pedidosActivos = mesas.filter((mesa) => this.hasOpenRestaurantOrder(mesa)).length;
    this.ticketsAbiertos = mesas.filter((mesa) => this.hasOpenRestaurantOrder(mesa) && this.isOccupiedRestaurantTable(mesa)).length;
    this.ventasRestaurante = mesas.reduce((sum, mesa) => sum + Number(mesa.ppV07_TotalDocu || 0), 0);
    this.roomServiceActivo = mesas.filter((mesa) => {
      const area = ubicaciones.find((ubicacion) => ubicacion.MPV09_CodUbicacion === mesa.cpV05_CodUbicacion);
      return this.isRoomServiceArea(area) && this.hasOpenRestaurantOrder(mesa);
    }).length;
  }

  private applyOccupancyForecast(rows: OccupancyForecastResponseRow[]): void {
    const forecastDays = rows
      .map((row) => this.mapForecastDay(row))
      .filter((row) => row.fecha)
      .sort((left, right) => left.fecha.localeCompare(right.fecha))
      .slice(0, 7);

    this.occupancyForecastDays = forecastDays;
    this.occupancyForecastToday = forecastDays.find((row) => row.fecha === this.todayIso) ?? forecastDays[0] ?? null;
    this.occupancyForecastAverage = forecastDays.length
      ? Math.round((forecastDays.reduce((sum, row) => sum + row.ocupacion, 0) / forecastDays.length) * 10) / 10
      : 0;
    this.occupancyForecastPeak = forecastDays.reduce<OccupancyForecastPreviewDay | null>(
      (peak, row) => (!peak || row.ocupacion > peak.ocupacion ? row : peak),
      null
    );
    this.occupancyForecastRoomNights = forecastDays.reduce((sum, row) => sum + row.ocupadas, 0);
    this.occupancyForecastPax = forecastDays.reduce((sum, row) => sum + row.pax, 0);

    if (!forecastDays.length && !this.occupancyForecastError) {
      this.occupancyForecastError = 'Sin forecast disponible para los proximos 7 dias.';
    }
  }

  private rebuildAlerts(): void {
    const alerts: DashboardAlert[] = [];

    if (this.habitacionesSucias > 0) {
      alerts.push({ icon: 'icon-alert-circle', message: `${this.habitacionesSucias} habitaciones pendientes de limpieza.` });
    }

    if (this.checkInPendientes > 0) {
      alerts.push({ icon: 'icon-clock', message: `${this.checkInPendientes} llegadas pendientes de check-in.` });
    }

    if (this.checkOutPendientes > 0) {
      alerts.push({ icon: 'icon-log-out', message: `${this.checkOutPendientes} salidas pendientes de confirmar.` });
    }

    if (this.habitacionesFueraServicio > 0) {
      alerts.push({ icon: 'icon-home', message: `${this.habitacionesFueraServicio} habitaciones fuera de servicio.` });
    }

    if (this.reservasPendientes > 0) {
      alerts.push({ icon: 'icon-calendar', message: `${this.reservasPendientes} reservas pendientes o confirmadas en seguimiento.` });
    }

    if ((this.occupancyForecastToday?.ocupacion ?? 0) >= 85) {
      alerts.push({ icon: 'icon-trending-up', message: `Forecast de ocupacion alto para hoy: ${this.occupancyForecastToday?.ocupacion}%.` });
    }

    if (alerts.length === 0) {
      alerts.push({ icon: 'icon-check-circle', message: 'Operacion sin alertas criticas para hoy.' });
    }

    this.alertasOperativas = alerts;
  }

  private buildStatusSummary(statuses: string[]): StatusSummary[] {
    const counter = statuses.reduce((acc, status) => {
      const label = this.normalizeText(status) || 'Sin estado';
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const total = statuses.length;

    return Object.entries(counter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, value]) => ({ label, value, percent: this.percent(value, total) }));
  }

  private resetOperationalMetrics(): void {
    this.reservasDia = 0;
    this.reservasPendientes = 0;
    this.ingresosEstimados = 0;
    this.llegadasHoy = 0;
    this.salidasHoy = 0;
    this.checkInPendientes = 0;
    this.checkOutPendientes = 0;
    this.applyRoomMetrics([]);
    this.rebuildAlerts();
  }

  private mapForecastCategories(categories: RoomCategory[]): OccupancyForecastCategoryRequest[] {
    return categories
      .map((category) => ({
        codigo: this.normalizeText(category.CR01_CodCate).toUpperCase(),
        descripcion: this.normalizeText(category.CR01_Categoria || category.CR01_CodCate).toUpperCase(),
        operador: this.normalizeText(category.CR01_Operador) || 'carga'
      }))
      .filter((category) => category.codigo.length > 0);
  }

  private mapForecastDay(row: OccupancyForecastResponseRow): OccupancyForecastPreviewDay {
    const fecha = this.toDateKey(row.fecha);
    const total = Number(row.totHabi) || 0;
    const ocupadas = Number(row.totOcupa) || 0;

    return {
      fecha,
      label: this.formatForecastLabel(fecha),
      ocupacion: Math.max(0, Math.min(Number(row.porOcu) || 0, 100)),
      ocupadas,
      total,
      bloqueadas: Number(row.blk) || 0,
      pax: (Number(row.totPax) || 0) + (Number(row.totChl) || 0)
    };
  }

  private selectRestaurantPointOfSale(items: PuntoVentaUsuario[]): PuntoVentaUsuario | null {
    return (
      items.find((item) => {
        const value = `${item.MPV07_NomPntVenta || ''} ${item.MPV07_CodPntVenta || ''}`.toUpperCase();
        return value.includes('RESTAURANT') || value.includes('RESTAURANTE');
      }) ??
      items[0] ??
      null
    );
  }

  private isActiveRestaurantArea(ubicacion: UbicacionMesa): boolean {
    return this.normalizeText(ubicacion.MPV09_Activo).toUpperCase() !== 'N';
  }

  private isRoomServiceArea(ubicacion: UbicacionMesa | undefined): boolean {
    return this.normalizeText(ubicacion?.MPV09_Descripcion).toUpperCase().includes('ROOM SERVICE');
  }

  private isOccupiedRestaurantTable(mesa: RestauranteMesaOperacion): boolean {
    const estado = this.normalizeText(mesa.estadoMesa).toUpperCase();
    return mesa.ocupada || estado === 'OCUPADA' || estado === 'CUENTA';
  }

  private hasOpenRestaurantOrder(mesa: RestauranteMesaOperacion): boolean {
    return Boolean(this.normalizeText(mesa.ppV07_NumNDP) || Number(mesa.ppV07_TotalDocu || 0) > 0);
  }

  private isPendingReservationStatus(status: string): boolean {
    const normalized = this.normalizeText(status).toUpperCase();
    return normalized.includes('PEND') || normalized.includes('CONFIRM');
  }

  private isCancelledStatus(status: string): boolean {
    const normalized = this.normalizeText(status).toUpperCase();
    return normalized.includes('CANCEL') || normalized.includes('ANUL');
  }

  private isCheckedOutReservation(reserva: Reserva): boolean {
    const estado = this.normalizeText(reserva.PRV01_Estado).toUpperCase();
    return estado.includes('CHECK OUT') || estado.includes('SALIDA') || estado.includes('CERR');
  }

  private percent(value: number, total: number): number {
    if (!total) {
      return 0;
    }

    return Math.min(Math.round((value / total) * 100), 100);
  }

  private resolveUserName(): string {
    const user = this.authService.getCurrentUser();
    const name = String(user?.nombreUsu ?? user?.usuario ?? 'Usuario').trim() || 'Usuario';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }

  private resolveUserCode(): string {
    const user = this.authService.getCurrentUser();
    return String(user?.usuario ?? user?.Usuario ?? user?.Operador ?? user?.nombreUsu ?? 'charly').trim() || 'charly';
  }

  private normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }

  private toDateKey(value: unknown): string {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return '';
    }

    const iso = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    }

    const slash = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slash) {
      return `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
    }

    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  private getTodayIsoDate(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  private getTodayDisplayDate(): string {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${now.getFullYear()}`;
  }

  private getDisplayDateDaysFromToday(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  private formatForecastLabel(fecha: string): string {
    const [, , month, day] = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
    return day && month ? `${day}/${month}` : fecha;
  }
}
