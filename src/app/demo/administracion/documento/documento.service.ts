import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { DocumentoDto, DocumentoPost, DocumentoResponse } from './documento.models';

@Injectable({ providedIn: 'root' })
export class DocumentoService {
  private apiUrl = 'http://localhost:5000/api/documento';

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
    return this.http.post<DocumentoResponse>(this.apiUrl, this.decoratePayload(payload, 1));
  }

  editarDocumento(codigo: string, payload: DocumentoPost): Observable<DocumentoResponse> {
    const encoded = encodeURIComponent(codigo);
    return this.http.put<DocumentoResponse>(`${this.apiUrl}?codigo=${encoded}`, this.decoratePayload(payload, 2));
  }

  eliminarDocumento(codigo: string): Observable<DocumentoResponse> {
    const encoded = encodeURIComponent(codigo);
    return this.http.delete<DocumentoResponse>(`${this.apiUrl}?codigo=${encoded}`);
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
