import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';

interface PuntoVentaApiDto {
  MPV07_CodPntVenta: string;
  MPV07_NomPntVenta: string;
  MPV07_CodComanda: string;
  MPV07_CodDocumento: string;
  MPV07_CodLstPrecio: string;
  MPV07_NumMesas: number;
  MPV07_PntTouch: number;
  MPV07_Orden: number;
  MPV07_Operador: string;
  MPV07_ImpresoraA: unknown;
  MPV07_ImpresoraB: unknown;
}

export interface PuntoVentaRestaurante {
  codPntVenta: string;
  nomPntVenta: string;
  codComanda: string;
  codDocumento: string;
  codLstPrecio: string;
  numMesas: number;
  pntTouch: number;
  orden: number;
  operador: string;
  impresoraA: string;
  impresoraB: string;
}

export interface PuntoVentaPayload {
  proceso: number;
  codPntVenta: string;
  nomPntVenta: string;
  codComanda: string;
  numMesa: number;
  pntTouch: number;
  orden: number;
  operador: string;
  impresoraA: string;
  impresoraB: string;
  respuesta: string;
}

export interface PuntoVentaResponse {
  respuesta?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PuntosVentaRestauranteService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/puntoventa`;

  getPuntosVenta(): Observable<PuntoVentaRestaurante[]> {
    return this.http.get<PuntoVentaApiDto[]>(this.apiUrl).pipe(
      map((response) => (response ?? []).map((item) => this.mapFromApi(item)))
    );
  }

  crearPuntoVenta(payload: PuntoVentaPayload): Observable<PuntoVentaResponse> {
    return this.http
      .post(this.apiUrl, this.decoratePayload(payload), { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  private mapFromApi(api: PuntoVentaApiDto): PuntoVentaRestaurante {
    return {
      codPntVenta: (api.MPV07_CodPntVenta || '').trim(),
      nomPntVenta: (api.MPV07_NomPntVenta || '').trim(),
      codComanda: (api.MPV07_CodComanda || '').trim(),
      codDocumento: (api.MPV07_CodDocumento || '').trim(),
      codLstPrecio: (api.MPV07_CodLstPrecio || '').trim(),
      numMesas: Number(api.MPV07_NumMesas ?? 0),
      pntTouch: Number(api.MPV07_PntTouch ?? 0),
      orden: Number(api.MPV07_Orden ?? 0),
      operador: (api.MPV07_Operador || '').trim(),
      impresoraA: this.normalizePrinter(api.MPV07_ImpresoraA),
      impresoraB: this.normalizePrinter(api.MPV07_ImpresoraB)
    };
  }

  private decoratePayload(payload: PuntoVentaPayload): PuntoVentaPayload {
    return {
      ...payload,
      proceso: Number(payload.proceso ?? 0),
      codPntVenta: (payload.codPntVenta || '').trim(),
      nomPntVenta: (payload.nomPntVenta || '').trim(),
      codComanda: (payload.codComanda || '').trim(),
      numMesa: Number(payload.numMesa ?? 0),
      pntTouch: Number(payload.pntTouch ?? 0),
      orden: Number(payload.orden ?? 0),
      operador: (payload.operador || this.auth.getCurrentUser()?.usuario || '').trim(),
      impresoraA: (payload.impresoraA || '').trim(),
      impresoraB: (payload.impresoraB || '').trim(),
      respuesta: payload.respuesta ?? ''
    };
  }

  private normalizePrinter(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (value && typeof value === 'object' && Object.keys(value as Record<string, unknown>).length > 0) {
      return JSON.stringify(value);
    }
    return '';
  }

  private parseTextResponse(response: string): PuntoVentaResponse {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as PuntoVentaResponse;
    } catch {
      return { respuesta: trimmed };
    }
  }
}
