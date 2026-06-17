import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { UbicacionMesa, UbicacionMesasResponse } from '../models/restaurant-operacion.models';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RestaurantDashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ubicacionmesas`;

  obtenerUbicacionesMesas(codPntVenta: string): Observable<UbicacionMesasResponse> {
    const params = new HttpParams().set('codPntVenta', (codPntVenta || '').trim());
    return this.http.get<UbicacionMesasResponse>(this.apiUrl, { params }).pipe(
      map((response) => ({
        datos: [...(response?.datos ?? [])].sort((a, b) => this.sortUbicaciones(a, b))
      }))
    );
  }

  private sortUbicaciones(a: UbicacionMesa, b: UbicacionMesa): number {
    const orderDiff = Number(a.MPV09_Orden ?? 0) - Number(b.MPV09_Orden ?? 0);
    if (orderDiff !== 0) {
      return orderDiff;
    }
    return (a.MPV09_Descripcion || '').localeCompare(b.MPV09_Descripcion || '');
  }
}
