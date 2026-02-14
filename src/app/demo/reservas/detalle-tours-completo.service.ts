import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

import { ReservaDetalle } from './reserva-detalle.service';

export interface DetallePax {
  PRV03_ID: number;
  PRV03_PRV02_ID: number;
  PRV03_TipoPax: string;
  NombreTipoPax: string;
  PRV03_Cantidad: number;
  PRV03_PrecioUnitarioNeto: any;
  PRV03_PrecioUnitarioIVA: any;
  PRV03_PrecioUnitarioTotal: number;
  PRV03_SubtotalNeto: number;
  PRV03_SubtotalIVA: number;
  PRV03_SubtotalTotal: number;
  PRV03_Operador: string;
  PRV03_FechaRegistro: string;
}

export interface DetalleToursCompletoResponse {
  detalle: ReservaDetalle[] | ReservaDetalle;
  detallesPax: DetallePax[] | DetallePax;
}

@Injectable({ providedIn: 'root' })
export class DetalleToursCompletoService {
  private apiUrl = `${environment.apiUrl}/detalle-tours-completo`;

  constructor(private http: HttpClient) {}

  getDetalleByReserva(codReserva: string): Observable<DetalleToursCompletoResponse> {
    return this.http.get<DetalleToursCompletoResponse>(`${this.apiUrl}?codReserva=${encodeURIComponent(codReserva)}`);
  }

  getDetalleById(id: number): Observable<DetalleToursCompletoResponse> {
    return this.http.get<DetalleToursCompletoResponse>(`${this.apiUrl}/${id}`);
  }

  crearDetalle(payload: any): Observable<any> {
    return this.http.post(this.apiUrl, payload, { responseType: 'text' });
  }

  actualizarDetalle(id: number, payload: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, payload, { responseType: 'text' });
  }

  eliminarDetalle(id: number, codReserva: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}?codReserva=${encodeURIComponent(codReserva)}`, { responseType: 'text' });
  }
}
