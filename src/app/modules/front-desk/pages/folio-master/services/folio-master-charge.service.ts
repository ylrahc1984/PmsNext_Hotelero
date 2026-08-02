import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { environment } from 'src/environments/environment';
import {
  FolioMasterChargeDetail,
  FolioMasterChargeHeader,
  FolioMasterChargeLine
} from '../models/folio-master-charge.model';

interface ChargeHeadersApiResponse {
  success?: boolean;
  data?: Array<Record<string, unknown>> | null;
}

interface ChargeDetailApiResponse {
  mensaje?: string;
  encabezado?: Array<Record<string, unknown>> | null;
  detalle?: Array<Record<string, unknown>> | null;
}

@Injectable({ providedIn: 'root' })
export class FolioMasterChargeService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/cargo-habitacion`;

  getHeaders(codRsv: string, numFolio: string): Observable<FolioMasterChargeHeader[]> {
    const params = new HttpParams()
      .set('codRsv', this.clean(codRsv))
      .set('numHab', this.clean(numFolio));

    return this.http.get<ChargeHeadersApiResponse>(`${this.apiUrl}/encabezados`, { params }).pipe(
      map((response) => (Array.isArray(response?.data) ? response.data.map((item) => this.mapHeader(item)) : []))
    );
  }

  getDetail(tipCrgHab: string, numCrgHab: string): Observable<FolioMasterChargeDetail> {
    const params = new HttpParams()
      .set('tipCrgHab', this.clean(tipCrgHab))
      .set('numCrgHab', this.clean(numCrgHab));

    return this.http.get<ChargeDetailApiResponse>(`${this.apiUrl}/consultar-detalle`, { params }).pipe(
      map((response) => ({
        mensaje: this.clean(response?.mensaje),
        encabezado: Array.isArray(response?.encabezado) && response.encabezado.length
          ? this.mapHeader(response.encabezado[0])
          : null,
        detalles: Array.isArray(response?.detalle) ? response.detalle.map((item) => this.mapLine(item)) : []
      }))
    );
  }

  private mapHeader(item: Record<string, unknown>): FolioMasterChargeHeader {
    return {
      tipCrgHab: this.text(item, 'tipCrgHab', 'PFD01_TipCrgHab'),
      numCrgHab: this.text(item, 'numCrgHab', 'PFD01_NumCrgHab'),
      codReserva: this.text(item, 'codReserva', 'PFD01_CodReserva'),
      numHab: this.text(item, 'numHab', 'PFD01_NumHab'),
      pntVenta: this.text(item, 'pntVenta', 'PFD01_PntVenta'),
      fecha: normalizePmsDateDDMMYYYY(this.value(item, 'fecha', 'PFD01_Fecha')),
      hora: this.text(item, 'hora', 'PFD01_Hora'),
      numDocu: this.text(item, 'numDocu', 'PFD01_NumDocu'),
      nombrePax: this.text(item, 'nombrePax', 'PFD01_NombrePax'),
      mtoTot: this.number(item, 'mtoTot', 'PFD01_MtoTot'),
      moneda: this.text(item, 'moneda', 'PFD01_Moneda'),
      cierre: this.scalar(item, 'cierre', 'PFD01_Cierre'),
      numCierre: this.scalar(item, 'numCierre', 'PFD01_NumCierre'),
      estado: this.scalar(item, 'estado', 'PFD01_Estado'),
      operador: this.text(item, 'operador', 'PFD01_Operador'),
      folio: this.text(item, 'folio', 'PFD01_Folio') || this.text(item, 'numHab', 'PFD01_NumHab')
    };
  }

  private mapLine(item: Record<string, unknown>): FolioMasterChargeLine {
    return {
      tipCrgHab: this.text(item, 'PFD02_TipCrgHab'),
      numCrgHab: this.text(item, 'PFD02_NumCrgHab'),
      codRsv: this.text(item, 'PFD02_CodRsv'),
      numHab: this.text(item, 'PFD02_NumHab'),
      pntVenta: this.text(item, 'PFD02_PntVenta'),
      fecha: normalizePmsDateDDMMYYYY(this.value(item, 'PFD02_Fecha')),
      hora: this.text(item, 'PFD02_Hora'),
      grupo: this.text(item, 'PFD02_Grupo'),
      categoria: this.text(item, 'PFD02_Categoria'),
      codConsumo: this.text(item, 'PFD02_CodConsumo'),
      nomConsumo: this.text(item, 'PFD02_NomConsumo'),
      cantidad: this.number(item, 'PFD02_Cantidad'),
      subTotal: this.number(item, 'PFD02_SubTotal'),
      porDescuento: this.number(item, 'PFD02_PorDescuento'),
      descuento: this.number(item, 'PFD02_Descuento'),
      precioSinImpNeto: this.number(item, 'PFD02_PrecioSinImpNeto'),
      impuestos: this.number(item, 'PPV08_Impuestos'),
      precio: this.number(item, 'PFD02_Precio'),
      total: this.number(item, 'PFD02_Total'),
      moneda: this.text(item, 'PFD02_Moneda'),
      tipNPedido: this.text(item, 'PFD02_TipNPedido'),
      numNPedido: this.text(item, 'PFD02_NumNPedido'),
      codMozo: this.text(item, 'PFD02_CodMozo'),
      incluido: this.scalar(item, 'PFD02_Incluido'),
      exonerado: this.scalar(item, 'PFD02_Exonerado'),
      orden: this.number(item, 'PFD02_Orden'),
      estado: this.scalar(item, 'PFD02_Estado'),
      comentario: this.text(item, 'PFD02_Comentario'),
      precioLista: this.number(item, 'PFD02_PrecioLista'),
      operador: this.text(item, 'PFD02_Operador')
    };
  }

  private value(item: Record<string, unknown>, ...keys: string[]): unknown {
    return keys.map((key) => item[key]).find((value) => value !== undefined && value !== null);
  }

  private text(item: Record<string, unknown>, ...keys: string[]): string {
    return this.clean(this.value(item, ...keys));
  }

  private number(item: Record<string, unknown>, ...keys: string[]): number {
    const value = Number(this.value(item, ...keys));
    return Number.isFinite(value) ? value : 0;
  }

  private scalar(item: Record<string, unknown>, ...keys: string[]): number | string {
    const value = this.value(item, ...keys);
    return typeof value === 'number' ? value : this.clean(value);
  }

  private clean(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }

    return '';
  }
}
