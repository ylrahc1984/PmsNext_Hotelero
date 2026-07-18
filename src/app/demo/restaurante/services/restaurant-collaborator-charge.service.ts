import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';

export interface ColaboradorConsumo {
  MPV30_Codigo: string;
  MPV30_Nombre: string;
  MPV30_Telefono: string;
  MPV30_Direccion: string;
  MPV30_Ruc: string;
  MPV30_CentroCosto: string;
  MPV30_Operador: string;
}

export interface ConsumoColaboradorRequest {
  proceso: number;
  tipOpe: string;
  numOpe: string;
  pntVta: string;
  fecha: string;
  hora: string;
  vendedor: string;
  codColabora: string;
  rucColabora: string;
  nomColabora: string;
  direccion: string;
  totDocu: number;
  estado: string;
  moneda: string;
  tCambio: number;
  lPrecio: string;
  tipNP: string;
  serieNP: string;
  numNP: string;
  numCuenta: number;
  operador: string;
}

@Injectable({ providedIn: 'root' })
export class RestaurantCollaboratorChargeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl || 'http://localhost:5000/api';

  listarColaboradores(): Observable<ColaboradorConsumo[]> {
    return this.http.get<ColaboradorConsumo[]>(`${this.baseUrl}/colaboradores/listar`);
  }

  guardarConsumo(payload: ConsumoColaboradorRequest): Observable<unknown> {
    return this.http.post<unknown>(`${this.baseUrl}/Consumo-colaborador/guardar`, payload);
  }
}
