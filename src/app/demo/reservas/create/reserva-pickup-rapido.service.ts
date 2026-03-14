import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';

export interface ReservaPickupRapidoPayload {
  nombre: string;
  duracion: string;
}

export interface ReservaPickupRapidoItem {
  id: number;
  nombre: string;
  duracion: string;
  localizacion: string;
  estado: number;
  operador: string;
}

export interface ReservaPickupRapidoResponse {
  mensaje?: string;
  idPickupCreado?: number;
  pickup?: ReservaPickupRapidoItem | null;
}

interface ReservaPickupRapidoApiPayload {
  nombre: string;
  duracion: string;
  localizacion: string;
  estado: number;
  operador: string;
}

@Injectable({ providedIn: 'root' })
export class ReservaPickupRapidoService {
  private readonly apiUrl = `${environment.apiUrl}/pickup-rapido`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  crearPickupRapido(payload: ReservaPickupRapidoPayload): Observable<ReservaPickupRapidoResponse> {
    const body: ReservaPickupRapidoApiPayload = {
      nombre: (payload.nombre ?? '').toString().trim(),
      duracion: (payload.duracion ?? '').toString().trim(),
      localizacion: '',
      estado: 1,
      operador: this.authService.getCurrentUser()?.usuario ?? 'CARGA'
    };

    return this.http.post<ReservaPickupRapidoResponse>(this.apiUrl, body);
  }
}
