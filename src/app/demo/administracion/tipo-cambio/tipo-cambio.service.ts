import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

export interface TipoCambio {
  fecha               : string;
  monedaBase          : string;
  monedaReferencia    : string;
  compra              : number;
  venta               : number;
}

interface TipoCambioDto {
  CA01_IDTCambio      : number;
  CA01_Fecha          : string;
  CA01_Moneda         : string;
  CA01_CompraS        : number;
  CA01_VentaS         : number;
  CA01_CompraCB       : number;
  CA01_VentaCB        : number;
  CA01_Operador       : string;
}

@Injectable({
  providedIn: 'root'
})
export class TipoCambioService {
  private readonly apiUrl = `${environment.apiUrl}/tipocambio`;
  private historial = signal<TipoCambio[]>([]);

  constructor(private http: HttpClient) {}

  fetchTipoCambio(fechaDia: string, moneda: string): Observable<TipoCambio[]> {
    const params = new HttpParams().set('fechaDia', fechaDia).set('moneda', moneda);
    return this.http
      .get<TipoCambioDto[]>(this.apiUrl, { params })
      .pipe(
        map((response) => (response ?? []).map((item) => this.mapFromDto(item))),
        tap((items) => this.historial.set(items))
      );
  }

  getActual() {
    return this.historial()[0];
  }

  getHistorial() {
    return this.historial();
  }

  getByRangoFechas(desde?: string, hasta?: string) {
    if (!desde && !hasta) {
      return this.getHistorial();
    }

    const desdeDate = desde ? new Date(desde) : null;
    const hastaDate = hasta ? new Date(hasta) : null;

    return this.historial().filter(item => {
      const current = new Date(item.fecha);
      const afterDesde = !desdeDate || current >= desdeDate;
      const beforeHasta = !hastaDate || current <= hastaDate;
      return afterDesde && beforeHasta;
    }).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  private mapFromDto(dto: TipoCambioDto): TipoCambio {
    const fecha = dto.CA01_Fecha ? dto.CA01_Fecha.split('T')[0] : '';
    return {
      fecha,
      monedaBase: 'COL',
      monedaReferencia: dto.CA01_Moneda,
      compra: this.normalizeNumber(dto.CA01_CompraS),
      venta: this.normalizeNumber(dto.CA01_VentaS)
    };
  }

  private normalizeNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
