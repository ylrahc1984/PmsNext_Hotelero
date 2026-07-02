import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PuntoVentaUsuario } from '../models/restaurant-operacion.models';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RestaurantPuntoVentaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl || 'http://localhost:5000/api'}/puntoventa/mozos`;

  obtenerPuntosVentaPorUsuario(usuario: string): Observable<PuntoVentaUsuario[]> {
    const normalized = (usuario || '').trim() || 'charly';
    const params = new HttpParams().set('Operador', normalized);
    return this.http.get<PuntoVentaUsuario[]>(this.apiUrl, { params });
  }
}
