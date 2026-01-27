import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

/**
 * Interfaz para el modelo interno de la UI
 */
export interface MonedaUI {
  codMoneda: string;
  moneda: string;
  simbolo: string;
  activo: number;
  primario: number;
  secundario: number;
  orden: number;
  idISO?: string;
  operador?: string;
}

/**
 * Interfaz para la respuesta de la API
 */
export interface MonedaAPI {
  CA02_CodMoneda: string;
  CA02_DesMoneda: string;
  CA02_SimMoneda: string;
  CA02_Activo: number;
  CA02_Primaria: number;
  CA02_Secundario: number;
  CA02_Orden: number;
  CA02_IDMoneda?: string;
  CA02_Operador?: string;
  respuesta?: string;
}

/**
 * Interfaz para el payload de entrada a la API
 */
export interface MonedaPayload {
  proceso: number;
  codMoneda: string;
  moneda: string;
  simbolo: string;
  activo: number;
  primario: number;
  secundario: number;
  orden: number;
  operador: string;
  respuesta: string;
}

@Injectable({
  providedIn: 'root'
})
export class MonedaService {
  private apiUrl = `${environment.apiUrl}/moneda`;

  // Códigos de proceso
  private readonly PROCESO_INSERT = 1;
  private readonly PROCESO_UPDATE = 2;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene todas las monedas
   */
  getAll(): Observable<MonedaUI[]> {
    return this.http.get<MonedaAPI[]>(this.apiUrl).pipe(
      map((response: MonedaAPI[]) => response.map(item => this.mapFromAPI(item)))
    );
  }

  /**
   * Crea una nueva moneda
   */
  create(moneda: MonedaUI, operador: string): Observable<{ respuesta: string }> {
    const payload: MonedaPayload = {
      proceso: this.PROCESO_INSERT,
      codMoneda: moneda.codMoneda,
      moneda: moneda.moneda,
      simbolo: moneda.simbolo,
      activo: moneda.activo,
      primario: moneda.primario,
      secundario: moneda.secundario,
      orden: moneda.orden,
      operador: operador,
      respuesta: ''
    };

    return this.http.post<{ respuesta: string }>(this.apiUrl, payload);
  }

  /**
   * Actualiza una moneda existente
   */
  update(moneda: MonedaUI, operador: string): Observable<{ respuesta: string }> {
    const payload: MonedaPayload = {
      proceso: this.PROCESO_UPDATE,
      codMoneda: moneda.codMoneda,
      moneda: moneda.moneda,
      simbolo: moneda.simbolo,
      activo: moneda.activo,
      primario: moneda.primario,
      secundario: moneda.secundario,
      orden: moneda.orden,
      operador: operador,
      respuesta: ''
    };

    const url = `${this.apiUrl}/${moneda.codMoneda}`;
    return this.http.put<{ respuesta: string }>(url, payload);
  }

  /**
   * Elimina una moneda
   */
  delete(codMoneda: string): Observable<{ respuesta: string }> {
    const url = `${this.apiUrl}/${codMoneda}`;
    return this.http.delete<{ respuesta: string }>(url);
  }

  /**
   * Mapea datos de la API al modelo interno de UI
   */
  private mapFromAPI(apiData: MonedaAPI): MonedaUI {
    return {
      codMoneda: apiData.CA02_CodMoneda,
      moneda: apiData.CA02_DesMoneda,
      simbolo: apiData.CA02_SimMoneda,
      activo: apiData.CA02_Activo,
      primario: apiData.CA02_Primaria,
      secundario: apiData.CA02_Secundario,
      orden: apiData.CA02_Orden,
      idISO: apiData.CA02_IDMoneda,
      operador: apiData.CA02_Operador
    };
  }
}
