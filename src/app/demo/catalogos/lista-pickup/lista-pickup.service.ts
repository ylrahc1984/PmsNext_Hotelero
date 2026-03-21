import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';
import { extractGoogleDisplayText, normalizeTimeInputValue } from '../../reservas/create/reserva-create.utils';
import { PickupListaItem, PickupListaResponse, PickupUpsertRequest } from './lista-pickup.models';

@Injectable({
  providedIn: 'root'
})
export class ListaPickupService {
  private apiUrl = `${environment.apiUrl}/lista-pickup`;

  private readonly ACCION_INSERT = 1;
  private readonly ACCION_UPDATE = 2;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getAll(nombre?: string): Observable<PickupListaItem[]> {
    const term = (nombre ?? '').toString().trim();
    let params = new HttpParams();
    if (term) {
      params = params.set('nombre', term);
    }

    return this.http.get<PickupListaResponse | PickupListaItem[]>(this.apiUrl, { params }).pipe(
      map((response) => {
        const data = Array.isArray(response) ? response : response?.datos ?? [];
        return (data ?? []).map((item) => this.mapFromApi(item));
      }),
      catchError((error) => this.handleError(error, 'No se pudo cargar la lista pickup.'))
    );
  }

  getById(id: number): Observable<PickupListaItem | null> {
    const normalizedId = Number(id);
    if (!normalizedId) {
      return of(null);
    }

    return this.http.get<PickupListaItem | PickupListaResponse>(`${this.apiUrl}/${normalizedId}`).pipe(
      map((response) => {
        if (response && this.isResponseWithDatos(response)) {
          const first = response.datos?.[0];
          return first ? this.mapFromApi(first) : null;
        }
        const item = response as PickupListaItem | null;
        return item ? this.mapFromApi(item) : null;
      }),
      catchError((error) => this.handleError(error, 'No se pudo obtener el pickup seleccionado.'))
    );
  }

  create(payload: PickupUpsertRequest): Observable<{ respuesta?: string }> {
    return this.http
      .post(this.apiUrl, this.decoratePayload(payload, this.ACCION_INSERT), { responseType: 'text' })
      .pipe(
        map((response) => this.parseTextResponse(response)),
        catchError((error) => this.handleError(error, 'No se pudo crear el pickup.'))
      );
  }

  update(payload: PickupUpsertRequest): Observable<{ respuesta?: string }> {
    return this.http
      .put(this.apiUrl, this.decoratePayload(payload, this.ACCION_UPDATE), { responseType: 'text' })
      .pipe(
        map((response) => this.parseTextResponse(response)),
        catchError((error) => this.handleError(error, 'No se pudo actualizar el pickup.'))
      );
  }

  delete(id: number): Observable<{ respuesta?: string }> {
    const normalizedId = Number(id);
    return this.http.delete(`${this.apiUrl}/${normalizedId}`, { responseType: 'text' }).pipe(
      map((response) => this.parseTextResponse(response)),
      catchError((error) => this.handleError(error, 'No se pudo eliminar el pickup.'))
    );
  }

  buildPayload(
    base: Omit<PickupUpsertRequest, 'accion' | 'respuesta' | 'cR11_Operador'> & { cR11_Operador?: string },
    accion: number
  ): PickupUpsertRequest {
    return this.decoratePayload(
      {
        accion,
        cR11_ID: base.cR11_ID,
        cR11_Nombre: base.cR11_Nombre,
        cR11_Duracion: base.cR11_Duracion,
        cR11_Estado: base.cR11_Estado,
        cR11_Localizacion: base.cR11_Localizacion,
        cR11_Operador: base.cR11_Operador ?? '',
        respuesta: ''
      },
      accion
    );
  }

  getAccionInsert(): number {
    return this.ACCION_INSERT;
  }

  getAccionUpdate(): number {
    return this.ACCION_UPDATE;
  }

  private mapFromApi(apiData: Partial<PickupListaItem> & { CR11_Localizacion?: unknown }): PickupListaItem {
    return {
      CR11_ID: Number(apiData?.CR11_ID ?? 0),
      CR11_Nombre: (apiData?.CR11_Nombre ?? '').toString(),
      CR11_Duracion: normalizeTimeInputValue(apiData?.CR11_Duracion),
      CR11_Estado: Number(apiData?.CR11_Estado ?? 0),
      CR11_Localizacion: this.normalizeLocalizacion(apiData?.CR11_Localizacion),
      CR11_Operador: (apiData?.CR11_Operador ?? '').toString()
    };
  }

  private isResponseWithDatos(value: unknown): value is PickupListaResponse {
    return !!value && typeof value === 'object' && Array.isArray((value as PickupListaResponse).datos);
  }

  private normalizeLocalizacion(value: unknown): string {
    if (!value) {
      return '';
    }

    const displayText = extractGoogleDisplayText(value).trim();
    if (displayText) {
      return displayText;
    }

    return String(value);
  }

  private decoratePayload(payload: PickupUpsertRequest, accion: number): PickupUpsertRequest {
    return {
      ...payload,
      accion,
      cR11_ID: Number(payload.cR11_ID ?? 0),
      cR11_Nombre: (payload.cR11_Nombre ?? '').toString(),
      cR11_Duracion: (payload.cR11_Duracion ?? '').toString(),
      cR11_Estado: Number(payload.cR11_Estado ?? 0),
      cR11_Localizacion: (payload.cR11_Localizacion ?? '').toString(),
      cR11_Operador: payload.cR11_Operador || this.getOperador(),
      respuesta: payload.respuesta ?? ''
    };
  }

  private parseTextResponse(response: string): { respuesta?: string } {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as { respuesta?: string };
    } catch {
      return { respuesta: trimmed };
    }
  }

  private handleError(error: any, fallback: string): Observable<never> {
    const message =
      error?.error?.mensaje ||
      error?.error?.respuesta ||
      error?.message ||
      fallback;
    return throwError(() => new Error(message));
  }

  private getOperador(): string {
    return this.auth.getCurrentUser()?.usuario ?? 'CARGA';
  }
}
