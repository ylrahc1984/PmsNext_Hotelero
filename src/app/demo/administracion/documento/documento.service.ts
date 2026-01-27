import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { DocumentoDto, DocumentoPost, DocumentoResponse } from './documento.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class DocumentoService {
  private apiUrl = `${environment.apiUrl}/documento`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getDocumentos(): Observable<DocumentoDto[]> {
    return this.http.get<DocumentoDto[] | DocumentoDto>(this.apiUrl).pipe(
      map((response) => {
        if (!response) {
          return [];
        }
        return Array.isArray(response) ? response : [response];
      })
    );
  }

  getDocumentoByCodigo(codigo: string): Observable<DocumentoDto | null> {
    const encoded = encodeURIComponent(codigo);
    return this.http.get<DocumentoDto | DocumentoDto[]>(`${this.apiUrl}?codigo=${encoded}`).pipe(
      map((response) => {
        const item = Array.isArray(response) ? response[0] : response;
        return item ?? null;
      })
    );
  }

  crearDocumento(payload: DocumentoPost): Observable<DocumentoResponse> {
    return this.http
      .post(this.apiUrl, this.decoratePayload(payload, 1), { responseType: 'text' })
      .pipe(
        map((response) => {
          const trimmed = response?.trim();
          if (!trimmed) {
            return { respuesta: '' };
          }
          try {
            const parsed = JSON.parse(trimmed) as DocumentoResponse;
            return parsed ?? { respuesta: trimmed };
          } catch {
            return { respuesta: trimmed };
          }
        })
      );
  }

  editarDocumento(codigo: string, payload: DocumentoPost): Observable<DocumentoResponse> {
    return this.http
      .put(`${this.apiUrl}/${codigo}`, this.decoratePayload(payload, 2), { responseType: 'text' })
      .pipe(
        map((response) => {
          const trimmed = response?.trim();
          if (!trimmed) {
            return { respuesta: '' };
          }
          try {
            const parsed = JSON.parse(trimmed) as DocumentoResponse;
            return parsed ?? { respuesta: trimmed };
          } catch {
            return { respuesta: trimmed };
          }
        })
      );
  }

  eliminarDocumento(codigo: string): Observable<DocumentoResponse> {
    return this.http
      .delete(`${this.apiUrl}/${encodeURIComponent(codigo)}`, { responseType: 'text' })
      .pipe(
        map((response) => {
          const trimmed = response?.trim();
          if (!trimmed) {
            return { respuesta: '' };
          }
          try {
            const parsed = JSON.parse(trimmed) as DocumentoResponse;
            return parsed ?? { respuesta: trimmed };
          } catch {
            return { respuesta: trimmed };
          }
        })
      );
  }

  buildPayload(formValue: Partial<DocumentoPost>, proceso: number): DocumentoPost {
    return this.decoratePayload(
      {
        proceso,
        codigo: formValue.codigo ?? '',
        descripcion: formValue.descripcion ?? '',
        serie: Number(formValue.serie ?? 0),
        numero: Number(formValue.numero ?? 0),
        visible: Number(formValue.visible ?? 0),
        auto: Number(formValue.auto ?? 0),
        compra: Number(formValue.compra ?? 0),
        venta: Number(formValue.venta ?? 0),
        docu: Number(formValue.docu ?? 0),
        notaC: Number(formValue.notaC ?? 0),
        notaD: Number(formValue.notaD ?? 0),
        guia: Number(formValue.guia ?? 0),
        observaciones1: formValue.observaciones1 ?? '',
        observaciones2: formValue.observaciones2 ?? '',
        nFactElectronica: Number(formValue.nFactElectronica ?? 0),
        tDocFE: formValue.tDocFE ?? '',
        operador: formValue.operador ?? '',
        respuesta: formValue.respuesta ?? ''
      },
      proceso
    );
  }

  private decoratePayload(payload: DocumentoPost, proceso: number): DocumentoPost {
    return {
      ...payload,
      proceso,
      operador: payload.operador || this.auth.getCurrentUser()?.usuario || '',
      respuesta: payload.respuesta ?? ''
    };
  }
}
