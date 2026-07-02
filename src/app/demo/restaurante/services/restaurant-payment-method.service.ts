import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface FormaPagoPuntoVenta {
  CA05_Codigo: string;
  CA05_Descripcion: string;
  CA05_Tipo: string;
  CA05_TipPago: string;
  CA05_NDias: number;
}

@Injectable({
  providedIn: 'root'
})
export class RestaurantPaymentMethodService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl || 'http://localhost:5000/api';

  obtenerFormasPagoPorPuntoVenta(puntoVenta: string): Observable<FormaPagoPuntoVenta[]> {
    const params = new HttpParams().set('puntoVenta', (puntoVenta || '').trim());
    return this.http.get<FormaPagoPuntoVenta[]>(`${this.baseUrl}/forma-pago-punto-venta`, { params });
  }
}
