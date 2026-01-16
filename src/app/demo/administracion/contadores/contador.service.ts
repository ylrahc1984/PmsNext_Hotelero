import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { ContadorApi, ContadorPayload, ContadorResponse, ContadorUI } from './contador.models';

@Injectable({ providedIn: 'root' })
export class ContadorService {
  private apiUrl = 'http://localhost:5000/api/contadorvarios';
  private readonly tipoCreate = 1;
  private readonly tipoUpdate = 2;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getAll(): Observable<ContadorUI[]> {
    return this.http.get<ContadorApi[]>(this.apiUrl).pipe(
      map((response) => (response ?? []).map((item) => this.mapFromApi(item)))
    );
  }

  getByCodigo(codigo: string): Observable<ContadorUI> {
    return this.http.get<ContadorApi | ContadorApi[]>(`${this.apiUrl}/${codigo}`).pipe(
      map((response) => {
        const item = Array.isArray(response) ? response[0] : response;
        if (!item) {
          throw new Error('Contador no encontrado');
        }
        return this.mapFromApi(item);
      })
    );
  }

  create(cont: ContadorUI): Observable<ContadorResponse> {
    const payload = this.buildPayload(cont, this.tipoCreate);
    return this.http
      .post(this.apiUrl, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  update(codigo: string, cont: ContadorUI): Observable<ContadorResponse> {
    const payload = this.buildPayload({ ...cont, codigo }, this.tipoUpdate);
    return this.http
      .put(`${this.apiUrl}/${codigo}`, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  delete(codigo: string): Observable<ContadorResponse> {
    return this.http
      .delete(`${this.apiUrl}/${codigo}`, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  private buildPayload(cont: ContadorUI, tipo: number): ContadorPayload {
    return {
      tipo,
      codigo: cont.codigo,
      descripcion: cont.descripcion,
      serie: cont.serie,
      contador: cont.contador,
      largo: cont.largo,
      auto: cont.auto,
      frmCod: cont.frmCod,
      operador: this.auth.getCurrentUser()?.usuario ?? '',
      respuesta: ''
    };
  }

  private mapFromApi(apiData: ContadorApi): ContadorUI {
    return {
      codigo: apiData.CA09_CodContador,
      descripcion: apiData.CA09_Descripcion,
      serie: apiData.CA09_Serie,
      contador: apiData.CA09_Numero,
      largo: apiData.CA09_Largo,
      auto: apiData.CA09_Auto,
      frmCod: apiData.CA09_AntCod,
      operador: apiData.CA09_Operador
    };
  }

  private parseTextResponse(response: string): ContadorResponse {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as ContadorResponse;
    } catch {
      return { respuesta: trimmed };
    }
  }
}
