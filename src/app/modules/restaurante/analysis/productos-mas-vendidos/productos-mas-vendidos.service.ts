import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface ProductoFacturacionApi {
  CODIGO: string;
  DESCRIPCION: string;
  CANTIDAD: number;
  COSTO: number;
  PRECIO: number;
  TOTAL: number;
  PORCENTAJE: number;
}

export interface ProductoFacturacion {
  codigo: string;
  descripcion: string;
  cantidad: number;
  costo: number;
  precio: number;
  total: number;
  porcentaje: number;
}

export interface ReporteProductosFacturacionFiltros {
  proceso: number;
  fechaInicial: string;
  fechaFinal: string;
  centroCosto: string;
  categoria: string;
  puntoVenta: string;
  codigoVendedor: string;
  tipoCambio: number;
  incluirCargoHabitacion: boolean;
  incluirCargoIncluido: boolean;
  incluirCargoColaborador: boolean;
}

type ReporteProductosResponse = ProductoFacturacionApi[] | { datos?: ProductoFacturacionApi[] };

@Injectable({ providedIn: 'root' })
export class ProductosMasVendidosService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/estadistica-puntoventa/reporte-por-facturacion`;

  obtenerReporte(filtros: ReporteProductosFacturacionFiltros): Observable<ProductoFacturacion[]> {
    const payload = {
      proceso: filtros.proceso,
      fechaIni: this.formatearFecha(filtros.fechaInicial),
      fechaFin: this.formatearFecha(filtros.fechaFinal),
      cCosto: filtros.centroCosto.trim(),
      categoria: filtros.categoria.trim(),
      pntVenta: filtros.puntoVenta.trim(),
      codVendedor: filtros.codigoVendedor.trim(),
      tCambio: filtros.tipoCambio,
      crgHab: filtros.incluirCargoHabitacion ? 1 : 0,
      crgInc: filtros.incluirCargoIncluido ? 1 : 0,
      crgCol: filtros.incluirCargoColaborador ? 1 : 0
    };

    return this.http.post<ReporteProductosResponse>(this.endpoint, payload).pipe(
      map((response) => {
        const datos = Array.isArray(response) ? response : response?.datos ?? [];
        return datos.map((item) => this.mapearProducto(item));
      })
    );
  }

  private formatearFecha(fechaIso: string): string {
    const [anio, mes, dia] = fechaIso.split('-');
    return `${dia}/${mes}/${anio}`;
  }

  private mapearProducto(item: ProductoFacturacionApi): ProductoFacturacion {
    return {
      codigo: String(item.CODIGO ?? '').trim(),
      descripcion: String(item.DESCRIPCION ?? '').trim(),
      cantidad: this.numeroSeguro(item.CANTIDAD),
      costo: this.numeroSeguro(item.COSTO),
      precio: this.numeroSeguro(item.PRECIO),
      total: this.numeroSeguro(item.TOTAL),
      porcentaje: this.numeroSeguro(item.PORCENTAJE)
    };
  }

  private numeroSeguro(valor: unknown): number {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  }
}
