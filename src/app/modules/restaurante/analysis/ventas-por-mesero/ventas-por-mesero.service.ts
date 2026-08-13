import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';

interface DetalleFinancieroApi {
  TipoDocumento: string;
  Serie: string;
  NumeroDocumento: string;
  FechaDocumento: string;
  Cliente: string;
  Mozo: string;
  PuntoVenta: string;
  SubTotal: number;
  IVA: number;
  Servicio: number;
  TotalImpuestos: number;
  Propina: number;
  TotalVenta: number;
  TotalGeneral: number;
  CantLineas: number;
}

export interface DetalleFinanciero {
  tipoDocumento: string;
  serie: string;
  numeroDocumento: string;
  fechaDocumento: string;
  cliente: string;
  mozo: string;
  puntoVenta: string;
  subtotal: number;
  iva: number;
  servicio: number;
  totalImpuestos: number;
  propina: number;
  totalVenta: number;
  totalGeneral: number;
  cantidadLineas: number;
}

export interface DetalleFinancieroFiltros {
  fechaInicial: string;
  fechaFinal: string;
  moneda: string;
  tipoCambio: string;
  codMozo: string;
  puntoVenta: string;
}

type DetalleFinancieroResponse = DetalleFinancieroApi[] | { datos?: DetalleFinancieroApi[] };

@Injectable({ providedIn: 'root' })
export class VentasPorMeseroService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/restaurante/detalle-financiero`;

  obtenerDetalle(filtros: DetalleFinancieroFiltros): Observable<DetalleFinanciero[]> {
    const params = new HttpParams()
      .set('fechaInicial', this.formatearFecha(filtros.fechaInicial))
      .set('fechaFinal', this.formatearFecha(filtros.fechaFinal))
      .set('moneda', filtros.moneda.trim())
      .set('tipoCambio', filtros.tipoCambio.trim())
      .set('codMozo', filtros.codMozo.trim())
      .set('puntoVenta', filtros.puntoVenta.trim());

    return this.http.get<DetalleFinancieroResponse>(this.endpoint, { params }).pipe(
      map((response) => {
        const datos = Array.isArray(response) ? response : response?.datos ?? [];
        return datos.map((item) => this.mapearDetalle(item));
      })
    );
  }

  private formatearFecha(fechaIso: string): string {
    const [anio, mes, dia] = fechaIso.split('-');
    return `${dia}/${mes}/${anio}`;
  }

  private mapearDetalle(item: DetalleFinancieroApi): DetalleFinanciero {
    return {
      tipoDocumento: this.texto(item.TipoDocumento),
      serie: this.texto(item.Serie),
      numeroDocumento: this.texto(item.NumeroDocumento),
      fechaDocumento: this.texto(item.FechaDocumento),
      cliente: this.texto(item.Cliente),
      mozo: this.texto(item.Mozo),
      puntoVenta: this.texto(item.PuntoVenta),
      subtotal: this.numero(item.SubTotal),
      iva: this.numero(item.IVA),
      servicio: this.numero(item.Servicio),
      totalImpuestos: this.numero(item.TotalImpuestos),
      propina: this.numero(item.Propina),
      totalVenta: this.numero(item.TotalVenta),
      totalGeneral: this.numero(item.TotalGeneral),
      cantidadLineas: this.numero(item.CantLineas)
    };
  }

  private texto(valor: unknown): string {
    return String(valor ?? '').trim();
  }

  private numero(valor: unknown): number {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  }
}