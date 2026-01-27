// angular import
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';

// Datos y modelos para listas de precios y reglas tarifarias (mock)
export interface ListaPrecio {
  id: number;
  nombre: string;
  descripcion?: string;
  moneda: 'CRC' | 'USD' | 'EUR';
  vigenciaDesde: Date;
  vigenciaHasta: Date;
  activa: boolean;
  updatedAt: Date;
  observaciones?: string;
}

export interface Servicio {
  id: string;
  nombre: string;
  descripcion?: string;
  categoria: string;
  activa: boolean;
}

export interface ReglaTarifa {
  id: number;
  listaPrecioId: number;
  codLstPrecio: string;
  servicioId: string;
  codServicio: string;
  servicioNombre: string;
  tarifa: 'A' | 'B' | 'C' | 'D';
  horaInicio: string;
  horaFin: string;
  precioBase: number;
  adultosIncluidos: number;
  precioAdultoExtra: number;
  precioNino: number;
  cantMinPax: number;
  cantMaxPax: number;
  moneda: string;
  observaciones?: string;
  activa: boolean;
  operador?: string;
  fechaRegistro?: string;
}

export interface DetalleLstPrecioDto {
  MPV05_ID: number;
  MPV05_CodLstPrecio: string;
  MPV05_CodServicio: string;
  MPV05_TipoTarifa: number;
  MPV05_CantMinPax: number;
  MPV05_CantMaxPax: number;
  MPV05_PrecioAdulto: number;
  MPV05_PrecioNino: number;
  MPV05_PrecioPaxExtra: number;
  MPV05_HoraDesde: string;
  MPV05_HoraHasta: string;
  MPV05_Moneda: string;
  MPV05_Observaciones: string;
  MPV05_Activo: boolean | number | string;
  MPV05_Operador: string;
  MPV05_FechaRegistro: string;
}

export interface DetalleLstPrecioPost {
  tipo: number;
  id: number;
  codLstPrecio: string;
  codServicio: string;
  tipoTarifa: number;
  cantMinPax: number;
  cantMaxPax: number;
  precioAdulto: number;
  precioNino: number;
  precioPaxExtra: number;
  horaDesde: string;
  horaHasta: string;
  moneda: string;
  observaciones: string;
  activo: boolean;
  operador: string;
  respuesta: string;
}

// Servicio para gestionar listas de precios (mock)
@Injectable({
  providedIn: 'root'
})
export class ListasPreciosService {
  private listasPrecios = signal<ListaPrecio[]>([]);

  getListasPrecios() {
    return this.listasPrecios;
  }

  getListaPrecioById(id: number) {
    return this.listasPrecios().find(lp => lp.id === id);
  }

  createListaPrecio(listaPrecio: Omit<ListaPrecio, 'id' | 'updatedAt'>) {
    const current = this.listasPrecios();
    const newId = current.length > 0 ? Math.max(...current.map(lp => lp.id)) + 1 : 1;
    const newLista: ListaPrecio = {
      ...listaPrecio,
      id: newId,
      updatedAt: new Date()
    };
    this.listasPrecios.update(listas => [...listas, newLista]);
    return newLista;
  }

  updateListaPrecio(id: number, updates: Partial<Omit<ListaPrecio, 'id'>>) {
    this.listasPrecios.update(listas =>
      listas.map(lp =>
        lp.id === id
          ? { ...lp, ...updates, updatedAt: new Date() }
          : lp
      )
    );
  }

  toggleActive(id: number) {
    const lista = this.getListaPrecioById(id);
    this.updateListaPrecio(id, { activa: lista ? !lista.activa : false });
  }

  deleteListaPrecio(id: number) {
    this.listasPrecios.update(listas => listas.filter(lp => lp.id !== id));
  }

}

// Servicio para gestionar reglas tarifarias asociadas a listas de precios
@Injectable({
  providedIn: 'root'
})
export class ReglasTarifariasService {
  private apiUrl = `${environment.apiUrl}/detalleLstPrecio`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getDetallesByListaPrecio(codLstPrecio: string): Observable<ReglaTarifa[]> {
    const normalized = codLstPrecio?.trim();
    return this.http.get<DetalleLstPrecioDto[]>(this.apiUrl).pipe(
      map((response) =>
        (response ?? [])
          .map((item) => this.mapFromApi(item))
          .filter((item) => !normalized || item.codLstPrecio === normalized)
      )
    );
  }

  getByListaPrecioAndServicio(codLstPrecio: string, servicioId: string): Observable<ReglaTarifa[]> {
    return this.getDetallesByListaPrecio(codLstPrecio).pipe(
      map((reglas) => reglas.filter((regla) => regla.servicioId === servicioId))
    );
  }

  // Alias para compatibilidad con referencias previas
  getReglasByListaPrecioAndServicio(codLstPrecio: string, servicioId: string) {
    return this.getByListaPrecioAndServicio(codLstPrecio, servicioId);
  }

  createDetalle(payload: DetalleLstPrecioPost): Observable<{ respuesta?: string }> {
    return this.http
      .post(this.apiUrl, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  updateDetalle(id: number, payload: DetalleLstPrecioPost): Observable<{ respuesta?: string }> {
    return this.http
      .put(`${this.apiUrl}/${id}`, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  createDetalleWithResult(payload: DetalleLstPrecioPost): Observable<ReglaTarifa | null> {
    return this.http.post(this.apiUrl, payload, { responseType: 'text' }).pipe(
      map((response) => {
        const parsed = this.tryParseUnknown(response);
        return this.mapFromAny(parsed);
      })
    );
  }

  updateDetalleWithResult(id: number, payload: DetalleLstPrecioPost): Observable<ReglaTarifa | null> {
    return this.http.put(`${this.apiUrl}/${id}`, payload, { responseType: 'text' }).pipe(
      map((response) => {
        const parsed = this.tryParseUnknown(response);
        return this.mapFromAny(parsed);
      })
    );
  }

  deleteDetalle(id: number): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/${id}`, { responseType: 'text' });
  }

  buildPayload(base: Omit<DetalleLstPrecioPost, 'tipo' | 'id' | 'operador' | 'respuesta'>, tipo: number, id: number): DetalleLstPrecioPost {
    return {
      ...base,
      tipo,
      id,
      operador: this.getOperador(),
      respuesta: ''
    };
  }

  getTipoTarifaFromCodigo(codigo: ReglaTarifa['tarifa'] | string | undefined | null): number {
    switch ((codigo || '').toString().toUpperCase()) {
      case 'B':
        return 2;
      case 'C':
        return 3;
      case 'D':
        return 4;
      default:
        return 1;
    }
  }

  private mapFromApi(apiData: DetalleLstPrecioDto): ReglaTarifa {
    const tipoTarifa = Number(apiData.MPV05_TipoTarifa) || 0;
    const cantMinPax = Number(apiData.MPV05_CantMinPax) || 0;
    const cantMaxPax = Number(apiData.MPV05_CantMaxPax) || 0;
    const servicioId = String(apiData.MPV05_CodServicio) || '';
    return {
      id: Number(apiData.MPV05_ID) || 0,
      listaPrecioId: Number(apiData.MPV05_CodLstPrecio) || 0,
      codLstPrecio: (apiData.MPV05_CodLstPrecio || '').trim(),
      servicioId,
      codServicio: (apiData.MPV05_CodServicio || '').trim(),
      servicioNombre: '',
      tarifa: this.mapTipoTarifaToCodigo(tipoTarifa),
      horaInicio: (apiData.MPV05_HoraDesde || '').trim(),
      horaFin: (apiData.MPV05_HoraHasta || '').trim(),
      precioBase: Number(apiData.MPV05_PrecioAdulto) || 0,
      adultosIncluidos: cantMinPax,
      precioAdultoExtra: Number(apiData.MPV05_PrecioPaxExtra) || 0,
      precioNino: Number(apiData.MPV05_PrecioNino) || 0,
      cantMinPax,
      cantMaxPax,
      moneda: (apiData.MPV05_Moneda || '').trim(),
      observaciones: apiData.MPV05_Observaciones || '',
      activa: this.normalizeActivo(apiData.MPV05_Activo),
      operador: apiData.MPV05_Operador,
      fechaRegistro: apiData.MPV05_FechaRegistro
    };
  }

  private mapTipoTarifaToCodigo(tipoTarifa: number): ReglaTarifa['tarifa'] {
    switch (tipoTarifa) {
      case 2:
        return 'B';
      case 3:
        return 'C';
      case 4:
        return 'D';
      default:
        return 'A';
    }
  }

  private normalizeActivo(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase();
      return normalized === 'S' || normalized === '1' || normalized === 'TRUE';
    }
    return false;
  }

  private parseTextResponse(response: string): { respuesta?: string } {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as { respuesta?: string };
    } catch {
      return { respuesta: trimmed };
    }
  }

  private tryParseUnknown(response: string): unknown {
    if (!response) {
      return null;
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      const asNumber = Number(trimmed);
      if (Number.isFinite(asNumber)) {
        return asNumber;
      }
      return trimmed;
    }
  }

  private mapFromAny(value: unknown): ReglaTarifa | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const asRecord = value as Record<string, unknown>;
    if ('MPV05_ID' in asRecord) {
      return this.mapFromApi(value as DetalleLstPrecioDto);
    }

    if ('id' in asRecord || 'codLstPrecio' in asRecord || 'codServicio' in asRecord) {
      return this.mapFromReglaPayload(asRecord);
    }

    return null;
  }

  private mapFromReglaPayload(apiData: Record<string, unknown>): ReglaTarifa {
    const tipoTarifa = Number(apiData['tipoTarifa'] ?? 0) || 0;
    const cantMinPax = Number(apiData['cantMinPax'] ?? 0) || 0;
    const cantMaxPax = Number(apiData['cantMaxPax'] ?? 0) || 0;
    const codLstPrecio = String(apiData['codLstPrecio'] ?? '').trim();
    const codServicio = String(apiData['codServicio'] ?? '').trim();

    return {
      id: Number(apiData['id'] ?? 0) || 0,
      listaPrecioId: Number(codLstPrecio) || 0,
      codLstPrecio,
      servicioId: codServicio,
      codServicio,
      servicioNombre: '',
      tarifa: this.mapTipoTarifaToCodigo(tipoTarifa),
      horaInicio: String(apiData['horaDesde'] ?? '').trim(),
      horaFin: String(apiData['horaHasta'] ?? '').trim(),
      precioBase: Number(apiData['precioAdulto'] ?? 0) || 0,
      adultosIncluidos: cantMinPax,
      precioAdultoExtra: Number(apiData['precioPaxExtra'] ?? 0) || 0,
      precioNino: Number(apiData['precioNino'] ?? 0) || 0,
      cantMinPax,
      cantMaxPax,
      moneda: String(apiData['moneda'] ?? '').trim(),
      observaciones: String(apiData['observaciones'] ?? ''),
      activa: this.normalizeActivo(apiData['activo']),
      operador: String(apiData['operador'] ?? ''),
      fechaRegistro: String(apiData['fechaRegistro'] ?? '')
    };
  }

  private getOperador(): string {
    return this.auth.getCurrentUser()?.usuario ?? '';
  }
}
