import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigComisionEmpresa } from '../interfaces/config-comision.interface';
import { comisionesApiUrl } from './comisiones-api.util';

@Injectable({ providedIn: 'root' })
export class ConfigComisionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = comisionesApiUrl('config-comision-empresa');

  crear(payload: ConfigComisionEmpresa): Observable<ConfigComisionEmpresa> {
    return this.http.post<ConfigComisionEmpresa>(this.apiUrl, payload);
  }

  actualizar(payload: ConfigComisionEmpresa): Observable<ConfigComisionEmpresa> {
    return this.http.put<ConfigComisionEmpresa>(this.apiUrl, payload);
  }

  desactivar(empresaId: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${empresaId}/desactivar`, {});
  }

  activar(empresaId: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${empresaId}/activar`, {});
  }

  obtener(empresaId: number): Observable<ConfigComisionEmpresa> {
    return this.http.get<ConfigComisionEmpresa>(`${this.apiUrl}/${empresaId}`);
  }

  listar(): Observable<ConfigComisionEmpresa[]> {
    return this.http.get<ConfigComisionEmpresa[]>(this.apiUrl);
  }

  existe(empresaId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/${empresaId}/existe`);
  }
}
