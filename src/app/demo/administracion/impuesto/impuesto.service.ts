import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { ImpuestoApi, ImpuestoPayload, ImpuestoResponse, ImpuestoUI } from './impuesto.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class ImpuestoService {
  private apiUrl = `${environment.apiUrl}/impuesto`;
  private readonly defaultTipo = 1;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getAll(): Observable<ImpuestoUI[]> {
    return this.http.get<ImpuestoApi[]>(this.apiUrl).pipe(
      map((response) => (response ?? []).map((item) => this.mapFromApi(item)))
    );
  }

  getByCodigo(codigo: string): Observable<ImpuestoUI> {
    return this.http.get<ImpuestoApi | ImpuestoApi[]>(`${this.apiUrl}/${codigo}`).pipe(
      map((response) => {
        const item = Array.isArray(response) ? response[0] : response;
        if (!item) {
          throw new Error('Impuesto no encontrado');
        }
        return this.mapFromApi(item);
      })
    );
  }

  create(impuesto: ImpuestoUI): Observable<ImpuestoResponse> {
    const payload = this.buildPayload(impuesto);
    return this.http.post<ImpuestoResponse>(this.apiUrl, payload);
  }

  update(codigo: string, impuesto: ImpuestoUI): Observable<ImpuestoResponse> {
    const payload = this.buildPayload(impuesto);
    return this.http.put<ImpuestoResponse>(`${this.apiUrl}/${codigo}`, payload);
  }

  delete(codigo: string): Observable<ImpuestoResponse> {
    return this.http.delete<ImpuestoResponse>(`${this.apiUrl}/${codigo}`);
  }

  private buildPayload(impuesto: ImpuestoUI): ImpuestoPayload {
    return {
      tipo: this.defaultTipo,
      codigo: impuesto.codigo,
      nombre: impuesto.nombre,
      porcentaje: impuesto.porcentaje,
      ctaContav: impuesto.ctaContav,
      ctaContac: impuesto.ctaContac,
      tipoImpu: impuesto.tipoImpu,
      grabado: impuesto.grabado,
      orden: impuesto.orden,
      idTributacion: impuesto.idTributacion,
      ctaRifa: impuesto.ctaRifa,
      operador: this.auth.getCurrentUser()?.usuario ?? '',
      respuesta: ''
    };
  }

  private mapFromApi(apiData: ImpuestoApi): ImpuestoUI {
    return {
      codigo: apiData.CA03_CodImpu,
      nombre: apiData.CA03_NomImpu,
      porcentaje: apiData.CA03_MtoImpu,
      tipoImpu: apiData.CA03_TipoImp,
      grabado: apiData.CA03_Grabado,
      orden: apiData.CA03_Orden,
      ctaContav: apiData.CA03_CtaContaV,
      ctaContac: apiData.CA03_CtaContaC,
      idTributacion: apiData.CA03_IdTributacion,
      ctaRifa: apiData.CA03_CTarifa,
      operador: apiData.CA03_Operador
    };
  }
}
