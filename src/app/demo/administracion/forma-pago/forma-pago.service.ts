import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { FormaPago, FormaPagoApi, FormaPagoPayload, FormaPagoResponse } from './forma-pago.models';

@Injectable({ providedIn: 'root' })
export class FormaPagoService {
  private apiUrl = 'http://localhost:5000/api/formapago';

  constructor(private http: HttpClient, private auth: AuthService) {}

  getAll(): Observable<FormaPago[]> {
    return this.http.get<FormaPagoApi[]>(this.apiUrl).pipe(
      map((response) => (response ?? []).map((item) => this.mapFromApi(item)))
    );
  }

  getByCodigo(codigo: string): Observable<FormaPago> {
    return this.http.get<FormaPagoApi | FormaPagoApi[]>(`${this.apiUrl}/${codigo}`).pipe(
      map((response) => {
        const item = Array.isArray(response) ? response[0] : response;
        if (!item) {
          throw new Error('Forma de pago no encontrada');
        }
        return this.mapFromApi(item);
      })
    );
  }

  create(fp: FormaPago): Observable<FormaPagoResponse> {
    const payload: FormaPagoPayload = {
      proceso: 1,
      codigo: fp.codigo,
      descripcion: fp.descripcion,
      tipoFrm: fp.tipoFrm,
      tipoPago: fp.tipoPago,
      nDias: fp.nDias,
      orden: fp.orden,
      operador: this.auth.getCurrentUser()?.usuario ?? '',
      respuesta: ''
    };
    return this.http.post<FormaPagoResponse>(this.apiUrl, payload);
  }

  update(fp: FormaPago): Observable<FormaPagoResponse> {
    const payload: FormaPagoPayload = {
      proceso: 2,
      codigo: fp.codigo,
      descripcion: fp.descripcion,
      tipoFrm: fp.tipoFrm,
      tipoPago: fp.tipoPago,
      nDias: fp.nDias,
      orden: fp.orden,
      operador: this.auth.getCurrentUser()?.usuario ?? '',
      respuesta: ''
    };
    const url = `${this.apiUrl}/${fp.codigo}`;
    return this.http.put<FormaPagoResponse>(url, payload);
  }

  delete(codigo: string): Observable<FormaPagoResponse> {
    return this.http.delete<FormaPagoResponse>(`${this.apiUrl}/${codigo}`);
  }

  private mapFromApi(apiData: FormaPagoApi): FormaPago {
    return {
      codigo: apiData.CA05_Codigo,
      descripcion: apiData.CA05_Descripcion,
      tipoFrm: apiData.CA05_Tipo,
      tipoPago: apiData.CA05_TipPago,
      nDias: apiData.CA05_NDias,
      orden: apiData.CA05_Orden
    };
  }
}
