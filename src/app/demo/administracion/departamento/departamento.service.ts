import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { DepartamentoApi, DepartamentoPayload, DepartamentoResponse, DepartamentoUI } from './departamento.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class DepartamentoService {
  private apiUrl = `${environment.apiUrl}/departamento`;
  private readonly tipoCreate = 1;
  private readonly tipoUpdate = 2;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getAll(): Observable<DepartamentoUI[]> {
    return this.http.get<DepartamentoApi[]>(this.apiUrl).pipe(
      map((response) => (response ?? []).map((item) => this.mapFromApi(item)))
    );
  }

  getById(idDepartamento: number): Observable<DepartamentoUI> {
    return this.http.get<DepartamentoApi | DepartamentoApi[]>(`${this.apiUrl}/por-id/${idDepartamento}`).pipe(
      map((response) => {
        const item = Array.isArray(response) ? response[0] : response;
        if (!item) {
          throw new Error('Departamento no encontrado');
        }
        return this.mapFromApi(item);
      })
    );
  }

  create(depto: DepartamentoUI): Observable<DepartamentoResponse> {
    const payload = this.buildPayload(depto, this.tipoCreate);
    return this.http
      .post(this.apiUrl, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  update(idDepartamento: number, depto: DepartamentoUI): Observable<DepartamentoResponse> {
    const payload = this.buildPayload({ ...depto, idDepartamento }, this.tipoUpdate);
    return this.http
      .put(`${this.apiUrl}/${idDepartamento}`, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  delete(idDepartamento: number): Observable<DepartamentoResponse> {
    return this.http
      .delete(`${this.apiUrl}/${idDepartamento}`, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  private buildPayload(depto: DepartamentoUI, tipo: number): DepartamentoPayload {
    return {
      tipo,
      idDepartamento: depto.idDepartamento ?? 0,
      departamento: depto.departamento,
      operador: this.auth.getCurrentUser()?.usuario ?? '',
      respuesta: ''
    };
  }

  private mapFromApi(apiData: DepartamentoApi): DepartamentoUI {
    return {
      idDepartamento: apiData.MA02_IDDepartamento,
      departamento: apiData.MA02_Departamento,
      operador: apiData.MA02_Operador
    };
  }

  private parseTextResponse(response: string): DepartamentoResponse {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as DepartamentoResponse;
    } catch {
      return { respuesta: trimmed };
    }
  }
}
