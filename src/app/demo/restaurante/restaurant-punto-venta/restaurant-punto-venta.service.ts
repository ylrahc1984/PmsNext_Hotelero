import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { PuntoVentaUsuario } from '../models/restaurant-operacion.models';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RestaurantPuntoVentaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/mozoporpuntoventa`;

  obtenerPuntosVentaPorUsuario(usuario: string): Observable<PuntoVentaUsuario[]> {
    const normalized = (usuario || '').trim() || 'CHARLY';
    return this.http
      .get<PuntoVentaUsuario[]>(`${this.apiUrl}/usuario/${encodeURIComponent(normalized)}`)
      .pipe(map((items) => (items ?? []).filter((item) => Number(item.MPV12_Activo ?? 0) === 1)));
  }
}
