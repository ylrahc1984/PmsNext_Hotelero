import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';
import { ClienteContactoUI } from '../../../catalogos/agencias-comisionistas/cliente.models';

export interface ReservaContactoRapidoPayload {
  codAgencia: string;
  nomContacto: string;
  marcarPrincipal?: boolean;
}

export interface ReservaContactoRapidoResponse {
  mensaje?: string;
  idContactoCreado?: number;
  contacto?: Partial<ClienteContactoUI> | null;
}

interface ReservaContactoRapidoApiPayload {
  codAgencia: string;
  nomContacto: string;
  cargo: string;
  email: string;
  telefono1: string;
  telefono2: string;
  movil: string;
  ext: string;
  marcarPrincipal: boolean;
  operador: string;
}

@Injectable({ providedIn: 'root' })
export class ReservaContactoRapidoService {
  private readonly apiUrl = `${environment.apiUrl}/contacto-rapido`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  crearContactoRapido(payload: ReservaContactoRapidoPayload): Observable<ReservaContactoRapidoResponse> {
    const body: ReservaContactoRapidoApiPayload = {
      codAgencia: (payload.codAgencia ?? '').toString().trim(),
      nomContacto: (payload.nomContacto ?? '').toString().trim(),
      cargo: '',
      email: '',
      telefono1: '',
      telefono2: '',
      movil: '',
      ext: '',
      marcarPrincipal: !!payload.marcarPrincipal,
      operador: this.authService.getCurrentUser()?.usuario ?? ''
    };

    return this.http.post<ReservaContactoRapidoResponse>(this.apiUrl, body);
  }
}
