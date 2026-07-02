import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  MozoPuntoVenta,
  RestauranteMesaOperacion,
  RestauranteMesaOperacionResponse,
  UbicacionMesa,
  UbicacionMesasResponse
} from '../models/restaurant-operacion.models';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RestaurantDashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl || 'http://localhost:5000/api';
  private readonly apiUrl = `${this.baseUrl}/ubicacionmesas`;

  obtenerUbicacionesMesas(codPntVenta: string): Observable<UbicacionMesasResponse> {
    const params = new HttpParams().set('codPntVenta', (codPntVenta || '').trim());
    return this.http.get<UbicacionMesasResponse>(this.apiUrl, { params }).pipe(
      map((response) => ({
        datos: [...(response?.datos ?? [])].sort((a, b) => this.sortUbicaciones(a, b))
      }))
    );
  }

  obtenerMesasPorUbicacion(codPntVenta: string, codUbicacion: string): Observable<RestauranteMesaOperacion[]> {
    const params = new HttpParams()
      .set('codPntVenta', (codPntVenta || '').trim())
      .set('codUbicacion', (codUbicacion || '').trim());

    return this.http.get<RestauranteMesaOperacionResponse>(`${this.baseUrl}/restaurante/mesas`, { params }).pipe(
      map((response) =>
        [...(response?.mesas ?? [])].sort((a, b) => Number(a.cpV05_NumMesa || 0) - Number(b.cpV05_NumMesa || 0))
      )
    );
  }

  obtenerMozosPorPuntoVenta(codPntVenta: string): Observable<MozoPuntoVenta[]> {
    const normalized = (codPntVenta || '').trim();
    return this.http.get<MozoPuntoVenta[]>(`${this.baseUrl}/mozoporpuntoventa/puntoventa/${encodeURIComponent(normalized)}`).pipe(
      map((items) =>
        (items ?? [])
          .map((item) => ({
            ...item,
            MPV11_CodUsuario: this.normalizeText(item.MPV11_CodUsuario),
            MPV11_NomMozo: this.normalizeText(item.MPV11_NomMozo),
            MPV12_PntVenta: this.normalizeText(item.MPV12_PntVenta)
          }))
          .sort((a, b) => a.MPV11_NomMozo.localeCompare(b.MPV11_NomMozo))
      )
    );
  }

  private sortUbicaciones(a: UbicacionMesa, b: UbicacionMesa): number {
    const orderDiff = Number(a.MPV09_Orden ?? 0) - Number(b.MPV09_Orden ?? 0);
    if (orderDiff !== 0) {
      return orderDiff;
    }
    return (a.MPV09_Descripcion || '').localeCompare(b.MPV09_Descripcion || '');
  }

  private normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }
}
