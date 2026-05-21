import { HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export function comisionesApiUrl(path: string): string {
  const baseUrl = (environment.apiUrl ?? '').toString().replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  return `${baseUrl}/${normalizedPath}`;
}

export function toHttpParams(params?: QueryParams): HttpParams {
  let httpParams = new HttpParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      httpParams = httpParams.set(key, String(value));
    }
  });

  return httpParams;
}
