import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { addPmsCalendarDays } from 'src/app/core/utils/pms-date.util';
import { DashboardOperativoItem } from 'src/app/demo/dashboard/dashboard.models';
import { DashboardService } from 'src/app/demo/dashboard/dashboard.service';
import { InHouseResponse } from 'src/app/modules/front-desk/in-house-guests/models/in-house-guest.model';
import { InHouseGuestsService } from 'src/app/modules/front-desk/in-house-guests/services/in-house-guests.service';
import {
  OccupancyForecastCategoryRequest,
  OccupancyForecastResponseRow,
  OccupancyForecastService
} from 'src/app/modules/front-desk/pages/occupancy-forecast/occupancy-forecast.service';
import { RoomRackRoom } from 'src/app/modules/front-desk/pages/room-rack/models/room-rack-room.model';
import { RoomRackService } from 'src/app/modules/front-desk/pages/room-rack/services/room-rack.service';
import { RoomCategory } from 'src/app/modules/front-desk/settings/room-categories/models/room-category.model';
import { RoomCategoriesService } from 'src/app/modules/front-desk/settings/room-categories/services/room-categories.service';

export interface ReservasReportRequest {
  from: string;
  to: string;
  operator: string;
}

export interface ReservasReportData {
  dashboard: DashboardOperativoItem[];
  previousDashboard: DashboardOperativoItem[];
  rooms: RoomRackRoom[];
  inHouse: InHouseResponse;
  forecast: OccupancyForecastResponseRow[];
  unavailableSources: string[];
}

interface SourceResult<T> {
  data: T;
  source: string;
  available: boolean;
}

@Injectable({ providedIn: 'root' })
export class ReservasReportService {
  private readonly dashboardService = inject(DashboardService);
  private readonly roomRackService = inject(RoomRackService);
  private readonly inHouseService = inject(InHouseGuestsService);
  private readonly roomCategoriesService = inject(RoomCategoriesService);
  private readonly forecastService = inject(OccupancyForecastService);

  load(request: ReservasReportRequest): Observable<ReservasReportData> {
    const previousDate = this.toInputDate(addPmsCalendarDays(request.from, -1)) || request.from;
    const operator = request.operator.trim() || 'carga';

    return forkJoin({
      dashboard: this.safe(this.dashboardService.getDashboard(request.from), 'estado operativo', [] as DashboardOperativoItem[]),
      previousDashboard: this.safe(
        this.dashboardService.getDashboard(previousDate),
        'comparativo del día anterior',
        [] as DashboardOperativoItem[]
      ),
      rooms: this.safe(this.roomRackService.getAllRoomsStatus(request.from), 'estado de habitaciones', [] as RoomRackRoom[]),
      inHouse: this.safe(
        this.inHouseService.getInHouseGuests(request.from, request.to, operator),
        'huéspedes en casa',
        this.emptyInHouse()
      ),
      forecast: this.safe(this.loadForecast(request.from, request.to, operator), 'forecast de ocupación', [] as OccupancyForecastResponseRow[])
    }).pipe(
      map((result) => ({
        dashboard: result.dashboard.data,
        previousDashboard: result.previousDashboard.data,
        rooms: result.rooms.data,
        inHouse: result.inHouse.data,
        forecast: result.forecast.data,
        unavailableSources: Object.values(result)
          .filter((item) => !item.available)
          .map((item) => item.source)
      }))
    );
  }

  private loadForecast(from: string, to: string, operator: string): Observable<OccupancyForecastResponseRow[]> {
    return this.roomCategoriesService.getRoomCategories().pipe(
      map((categories) => this.mapCategories(categories, operator)),
      switchMap((categories) => categories.length
        ? this.forecastService.getForecast({ proceso: 1, fechaInicio: from, fechaFinal: to, categorias: categories })
        : of([]))
    );
  }

  private mapCategories(categories: RoomCategory[], operator: string): OccupancyForecastCategoryRequest[] {
    return categories
      .map((category) => ({
        codigo: this.text(category.CR01_CodCate).toUpperCase(),
        descripcion: this.text(category.CR01_Categoria || category.CR01_CodCate).toUpperCase(),
        operador: this.text(category.CR01_Operador) || operator
      }))
      .filter((category) => !!category.codigo);
  }

  private safe<T>(source$: Observable<T>, source: string, fallback: T): Observable<SourceResult<T>> {
    return source$.pipe(
      map((data) => ({ data, source, available: true })),
      catchError(() => of({ data: fallback, source, available: false }))
    );
  }

  private emptyInHouse(): InHouseResponse {
    return { pax: [], totalHabitaciones: 0, totalAdultos: 0, totalNinos: 0, totalHuespedes: 0, respuesta: '' };
  }

  private text(value: unknown): string {
    return (value ?? '').toString().trim();
  }

  private toInputDate(value: Date | null): string {
    if (!value || Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
}
