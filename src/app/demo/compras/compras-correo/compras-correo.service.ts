import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';

export interface CompraCorreo {
  PAC40_TipDocu             : string;
  PAC40_NumDocu             : string;
  PAC40_TipEntra            : string;
  PAC40_Fecha               : string;
  PAC40_Moneda              : string;
  PAC40_TCambio             : number;
  PAC40_RucProve            : string;
  PAC40_NomProve            : string;
  PAC40_Correo              : string;
  PAC40_Telefono            : string;
  PAC40_TipDocPrv           : string;
  PAC40_Serie               : string;
  PAC40_NumFacturaFmt       : string;
  PAC40_FecFactu            : string;
  PAC40_FecVen              : string;
  PAC40_SubTotal            : number;
  PAC40_Descuento           : number;
  PAC40_Neto                : number;
  PAC40_Impuesto            : number;
  PAC40_Exoneracion         : number;
  PAC40_TotalDocu           : number;
  PAC40_TotPagado           : number;
  PAC40_Estado              : string;
  PAC40_FrmPagoDesc         : string;
  PAC40_Concepto            : string;
  PAC40_Asiento             : string;
  PAC40_NumOrden            : string;
  PAC40_Operador            : string;
  PAC40_Clave               : string; 
}

export interface CompraCorreoDetalle {
  PAC41_TipDocu             : string;
  PAC41_NumDocu             : string;
  PAC41_CodProdu            : string;
  PAC41_Producto            : string;
  PAC41_Almacen             : string;
  PAC41_Cantidad            : number;
  PAC41_UndMedida           : string;
  PAC41_MtoIndiSInp         : number;
  PAC41_SubTotal            : number;
  PAC41_PorDesc             : number;
  PAC41_MtoDesc             : number;
  PAC41_Neto                : number;
  PAC41_PorImpto            : number;
  PAC41_MtoImpto            : number;
  PAC41_PorExo              : number;
  PAC41_MtoExo              : number;
  PAC41_MtoIndiCInp         : number;
  PAC41_Total               : number;
  PAC41_Moneda              : string;
  PAC41_Tcambio             : number;
  PAC41_Orden               : number;
  PAC41_Inventario          : number;
  PAC41_FrmPago             : string;
  PAC41_Cabys               : string;
}

export interface ComprasCorreoPaginacion {
  totalRegistros            : number;
  paginaActual              : number;
  pageSize                  : number;
}

export interface ComprasCorreoResponse {
  datos                     : CompraCorreo[];
  paginacion                : ComprasCorreoPaginacion;
}

export interface ComprasCorreoFilters {
  fechaInicio                : string;
  fechaFin                   : string;
  pageNumber                 : number;
  pageSize                   : number;
}

@Injectable({
  providedIn: 'root'
})
export class ComprasCorreoService {
  private readonly apiUrl = `${environment.apiUrl}/compra-productos-correo`;

  constructor(private readonly http: HttpClient) {}

  getCompras(filters: ComprasCorreoFilters): Observable<ComprasCorreoResponse> {
    const params = new HttpParams()
      .set('fechaInicio', filters.fechaInicio)
      .set('fechaFin', filters.fechaFin)
      .set('pageNumber', filters.pageNumber.toString())
      .set('pageSize', filters.pageSize.toString());

    return this.http.get<ComprasCorreoResponse>(this.apiUrl, { params });
  }

  getDetalle(tipDocu: string, numDocu: string): Observable<CompraCorreoDetalle[]> {
    const url = `${this.apiUrl}/${encodeURIComponent(tipDocu)}/${encodeURIComponent(numDocu)}/detalle`;
    return this.http.get<CompraCorreoDetalle[]>(url);
  }
}
