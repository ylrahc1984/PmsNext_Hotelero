import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap, throwError } from 'rxjs';

import { addPmsCalendarDays, normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import {
  OccupancyForecastCategoryRequest,
  OccupancyForecastResponseRow,
  OccupancyForecastService
} from 'src/app/modules/front-desk/pages/occupancy-forecast/occupancy-forecast.service';
import { RoomCategory } from 'src/app/modules/front-desk/settings/room-categories/models/room-category.model';
import { RoomCategoriesService } from 'src/app/modules/front-desk/settings/room-categories/services/room-categories.service';
import { DashboardForecastBarView, DashboardForecastView } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardForecastService {
  private readonly roomCategoriesService = inject(RoomCategoriesService);
  private readonly occupancyForecastService = inject(OccupancyForecastService);

  getSevenDayForecast(operationalDate: string): Observable<DashboardForecastView> {
    const startDate = normalizePmsDateDDMMYYYY(operationalDate);
    const endDate = normalizePmsDateDDMMYYYY(addPmsCalendarDays(startDate, 6));

    if (!startDate || !endDate) {
      return throwError(() => new Error('La fecha operativa no es válida para consultar el forecast.'));
    }

    return this.roomCategoriesService.getRoomCategories().pipe(
      map((categories) => this.mapCategories(categories)),
      switchMap((categories) => {
        if (!categories.length) {
          return throwError(() => new Error('No existen categorías de habitación para consultar el forecast.'));
        }

        return this.occupancyForecastService.getForecast({
          proceso: 1,
          fechaInicio: startDate,
          fechaFinal: endDate,
          categorias: categories
        });
      }),
      map((rows) => this.mapForecast(rows))
    );
  }

  private mapCategories(categories: RoomCategory[]): OccupancyForecastCategoryRequest[] {
    return categories
      .map((category) => ({
        codigo: this.text(category.CR01_CodCate).toUpperCase(),
        descripcion: this.text(category.CR01_Categoria || category.CR01_CodCate).toUpperCase(),
        operador: this.text(category.CR01_Operador) || 'carga'
      }))
      .filter((category) => !!category.codigo);
  }

  private mapForecast(rows: OccupancyForecastResponseRow[]): DashboardForecastView {
    const dailyRows = (Array.isArray(rows) ? rows : []).slice(0, 7);
    const percentages = dailyRows.map((row) => this.percentage(row.porOcu));
    const average = percentages.length
      ? percentages.reduce((total, percentage) => total + percentage, 0) / percentages.length
      : null;
    const peak = percentages.length ? Math.max(...percentages) : null;

    const bars: DashboardForecastBarView[] = dailyRows.map((row, index) => {
      const percentage = percentages[index];
      const date = normalizePmsDateDDMMYYYY(row.fecha) || this.text(row.fecha);
      return {
        id: `forecast-${date || index}`,
        label: date.slice(0, 5) || '—',
        value: `${this.formatPercentage(percentage)}%`,
        height: Math.max(5, Math.min(100, percentage))
      };
    });

    return { bars, average, peak };
  }

  private percentage(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  private formatPercentage(value: number): string {
    return new Intl.NumberFormat('es-CR', { maximumFractionDigits: 1 }).format(value);
  }

  private text(value: unknown): string {
    return (value ?? '').toString().trim();
  }
}
