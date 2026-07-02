import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface FacturacionFormaPagoRequest {
  frmPago: string;
  tipo: string;
  numTarjeta: string;
  moneda: string;
  monto: number;
  vencimiento: string;
  mtoTotal: number;
  tCambio: number;
  orden: number;
}

export interface FacturacionPuntoVentaRequest {
  proceso: number;
  nomTabla: string;
  nomTabImpu: string;
  nomTabFrmp: string;
  numInterno: string;
  tipDocu: string;
  serieDocu: string;
  numDocu: string;
  tipNdp: string;
  numeroNdp: string;
  tipo: string;
  codReserva: string;
  habita: string;
  master: string;
  fechaDocu: string;
  horaDonp: string;
  codCliente: string;
  rucClie: string;
  nomClie: string;
  direccion: string;
  pntVenta: string;
  codVendedor: string;
  subtotal: number;
  descuento: number;
  neto: number;
  impuesto: number;
  exonera: number;
  totDocumento: number;
  totPago: number;
  totPropina: number;
  fechaPago: string;
  fechaVen: string;
  estado: string;
  moneda: string;
  tCambio: number;
  formaPago: string;
  numCuenta: number;
  usuario: string;
  formasPago: FacturacionFormaPagoRequest[];
  respuesta: string;
}

@Injectable({
  providedIn: 'root'
})
export class RestaurantInvoiceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl || 'http://localhost:5000/api';

  facturarPuntoVenta(request: FacturacionPuntoVentaRequest): Observable<unknown> {
    return this.http.post<unknown>(`${this.baseUrl}/facturacion/venta-pntvta-web`, request);
  }
}
