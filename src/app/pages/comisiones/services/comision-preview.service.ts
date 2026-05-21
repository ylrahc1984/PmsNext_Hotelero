import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  ComisionPreviewParams,
  ComisionPreviewResponse,
  ComisionPreviewRow,
  ComisionPreviewResumen
} from '../interfaces/comision-preview.interface';
import { QueryParams, comisionesApiUrl, toHttpParams } from './comisiones-api.util';

type PreviewApiResponse =
  | ComisionPreviewResponse
  | {
      data?: ComisionPreviewRow[];
      items?: ComisionPreviewRow[];
      resumen?: Partial<ComisionPreviewResumen>;
    };

const EMPTY_RESUMEN: ComisionPreviewResumen = {
  totalRegistros: 0,
  totalMontoBase: 0,
  totalMontoComision: 0
};

@Injectable({ providedIn: 'root' })
export class ComisionPreviewService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = comisionesApiUrl('comision-preview');

  obtenerPreview(params: ComisionPreviewParams): Observable<ComisionPreviewResponse> {
    return this.http
      .get<PreviewApiResponse>(this.apiUrl, { params: toHttpParams(params as unknown as QueryParams) })
      .pipe(map((response) => this.normalizeResponse(response)));
  }

  private normalizeResponse(response: PreviewApiResponse): ComisionPreviewResponse {
    const payload = response as ComisionPreviewResponse & { data?: ComisionPreviewRow[]; items?: ComisionPreviewRow[] };
    const datos = this.asArray<ComisionPreviewRow>(payload.datos ?? payload.data ?? payload.items);
    const resumen = response.resumen ?? EMPTY_RESUMEN;

    return {
      datos,
      resumen: {
        totalRegistros: Number(resumen.totalRegistros ?? datos.length ?? 0),
        totalMontoBase: Number(resumen.totalMontoBase ?? 0),
        totalMontoComision: Number(resumen.totalMontoComision ?? 0)
      }
    };
  }

  private asArray<T>(value: T[] | null | undefined): T[] {
    return Array.isArray(value) ? value : [];
  }
}
