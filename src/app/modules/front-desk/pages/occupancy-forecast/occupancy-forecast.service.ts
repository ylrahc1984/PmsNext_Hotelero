import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';

export interface OccupancyForecastCategoryRequest {
  codigo: string;
  descripcion: string;
  operador: string;
}

export interface OccupancyForecastRequest {
  proceso: number;
  fechaInicio: string;
  fechaFinal: string;
  categorias: OccupancyForecastCategoryRequest[];
}

export interface OccupancyForecastCategoryResult {
  codigo: string;
  cantidad: number;
  total: number;
}

export interface OccupancyForecastResponseRow {
  fecha: string;
  totHabi: number;
  blk: number;
  totOcupa: number;
  totPax: number;
  totChl: number;
  porOcu: number;
  categorias: Record<string, OccupancyForecastCategoryResult>;
}

@Injectable({ providedIn: 'root' })
export class OccupancyForecastService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/pronostico-ocupacion`;

  getForecast(request: OccupancyForecastRequest): Observable<OccupancyForecastResponseRow[]> {
    return this.http
      .post<OccupancyForecastResponseRow[]>(this.apiUrl, {
        ...request,
        fechaInicio: normalizePmsDateDDMMYYYY(request.fechaInicio),
        fechaFinal: normalizePmsDateDDMMYYYY(request.fechaFinal)
      })
      .pipe(
        map((rows) => (Array.isArray(rows) ? rows : []).map((row) => ({ ...row, fecha: normalizePmsDateDDMMYYYY(row.fecha) })))
      );
  }
}
