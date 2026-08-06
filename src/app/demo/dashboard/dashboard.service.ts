import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import { DashboardOperativoItem } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/dashboard-operativo`;

  getDashboard(fechaOperativa: string): Observable<DashboardOperativoItem[]> {
    const params = new HttpParams().set('fechaOperativa', fechaOperativa.trim());
    return this.http.get<DashboardOperativoItem[]>(this.apiUrl, { params });
  }
}
