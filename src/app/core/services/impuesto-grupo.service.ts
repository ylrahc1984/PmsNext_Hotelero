import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';

import { environment } from 'src/environments/environment';

export interface ImpuestoGrupoApi {
  CA11_CodCCosto: string;
  CA11_CodImpuesto: string;
  CA11_NomImpuesto: string;
  CA11_MtoImpuesto: number;
  CA11_Operador: string;
}

export interface ImpuestoGrupo {
  centroCosto: string;
  codigo: string;
  nombre: string;
  porcentaje: number;
  operador: string;
}

@Injectable({ providedIn: 'root' })
export class ImpuestoGrupoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/impuestogrupo`;

  getByCentroCosto(codCentroCosto: string): Observable<ImpuestoGrupo[]> {
    const codigo = codCentroCosto.trim();
    if (!codigo) {
      return throwError(() => new Error('El código del centro de costo es obligatorio.'));
    }

    return this.http.get<ImpuestoGrupoApi[]>(`${this.apiUrl}/${encodeURIComponent(codigo)}`).pipe(
      map((response) =>
        (response ?? []).map((item) => ({
          centroCosto: item.CA11_CodCCosto,
          codigo: item.CA11_CodImpuesto,
          nombre: item.CA11_NomImpuesto,
          porcentaje: item.CA11_MtoImpuesto,
          operador: item.CA11_Operador
        }))
      )
    );
  }
}
