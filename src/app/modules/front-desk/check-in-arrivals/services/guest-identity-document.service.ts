import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { GuestIdentityDocument, RoomingListMutationResponse } from '../models/check-in-arrival.model';

type DocumentApiResponse = GuestIdentityDocument | GuestIdentityDocument[] | {
  success?: boolean;
  data?: GuestIdentityDocument | GuestIdentityDocument[] | null;
  datos?: GuestIdentityDocument | GuestIdentityDocument[] | null;
};

@Injectable({ providedIn: 'root' })
export class GuestIdentityDocumentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/frontdesk/documento-huesped`;

  getByRooming(idRooming: string): Observable<GuestIdentityDocument | null> {
    return this.http
      .get<DocumentApiResponse>(`${this.apiUrl}/rooming/${encodeURIComponent(idRooming)}`)
      .pipe(map((response) => this.pickSingleDocument(response)));
  }

  getById(idDocumento: number): Observable<GuestIdentityDocument | null> {
    return this.http
      .get<DocumentApiResponse>(`${this.apiUrl}/${encodeURIComponent(String(idDocumento))}`)
      .pipe(map((response) => this.pickSingleDocument(response)));
  }

  create(payload: GuestIdentityDocumentUploadPayload): Observable<RoomingListMutationResponse> {
    return this.http.post<RoomingListMutationResponse>(this.apiUrl, this.buildFormData(payload));
  }

  replace(idDocumento: number, payload: GuestIdentityDocumentUploadPayload): Observable<RoomingListMutationResponse> {
    return this.http.put<RoomingListMutationResponse>(`${this.apiUrl}/${encodeURIComponent(String(idDocumento))}`, this.buildFormData(payload));
  }

  delete(idDocumento: number): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/${encodeURIComponent(String(idDocumento))}`);
  }

  getContent(idDocumento: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${encodeURIComponent(String(idDocumento))}/contenido`, { responseType: 'blob' });
  }

  private buildFormData(payload: GuestIdentityDocumentUploadPayload): FormData {
    const formData = new FormData();
    formData.append('Archivo', payload.file);
    formData.append('Empresa', payload.empresa);
    formData.append('IdRooming', payload.idRooming);
    formData.append('CodReserva', payload.codReserva);
    formData.append('TipoDocumento', payload.tipoDocumento);
    formData.append('LadoDocumento', 'FRONT');
    return formData;
  }

  private pickSingleDocument(response: DocumentApiResponse): GuestIdentityDocument | null {
    const data = Array.isArray(response)
      ? response
      : Array.isArray((response as { data?: unknown }).data) || this.isDocument((response as { data?: unknown }).data)
        ? (response as { data?: GuestIdentityDocument | GuestIdentityDocument[] }).data
        : (response as { datos?: GuestIdentityDocument | GuestIdentityDocument[] }).datos ?? response;

    const documents = Array.isArray(data) ? data : this.isDocument(data) ? [data] : [];
    return documents.find((item) => item.activo !== false) ?? documents[0] ?? null;
  }

  private isDocument(value: unknown): value is GuestIdentityDocument {
    return !!value && typeof value === 'object' && 'idDocumento' in value;
  }
}

export interface GuestIdentityDocumentUploadPayload {
  file: File;
  empresa: string;
  idRooming: string;
  codReserva: string;
  tipoDocumento: string;
}
