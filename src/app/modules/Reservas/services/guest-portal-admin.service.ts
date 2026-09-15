import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import { GuestPortalEnableResponse, GuestPortalRegenerateResponse, GuestPortalStatusResponse } from '../models/guest-portal-admin.model';

@Injectable({ providedIn: 'root' })
export class GuestPortalAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '')}/guest-portal/reservas`;

  getStatus(codReserva: string): Observable<GuestPortalStatusResponse> {
    return this.http.get<GuestPortalStatusResponse>(`${this.reservaUrl(codReserva)}`);
  }

  enable(codReserva: string): Observable<GuestPortalEnableResponse> {
    return this.http.post<GuestPortalEnableResponse>(`${this.reservaUrl(codReserva)}/enable`, undefined);
  }

  regenerate(codReserva: string): Observable<GuestPortalRegenerateResponse> {
    return this.http.post<GuestPortalRegenerateResponse>(`${this.reservaUrl(codReserva)}/regenerate`, undefined);
  }

  cancel(codReserva: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.reservaUrl(codReserva)}/cancel`, undefined);
  }

  private reservaUrl(codReserva: string): string {
    return `${this.apiUrl}/${encodeURIComponent(codReserva.trim())}`;
  }
}
