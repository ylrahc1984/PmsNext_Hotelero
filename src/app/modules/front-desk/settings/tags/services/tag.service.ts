import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Tag, TagRequest } from '../models/tag.model';

type ApiEnvelope<T> = { datos?: T; data?: T };

@Injectable({ providedIn: 'root' })
export class TagService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/reservas/tags/mantenimiento`;
  getAll(): Observable<Tag[]> { return this.http.get<unknown>(this.apiUrl).pipe(map((response) => this.toArray(response))); }
  getActive(): Observable<Tag[]> { return this.http.get<unknown>(`${this.apiUrl}/activas`).pipe(map((response) => this.toArray(response))); }
  getById(id: number): Observable<Tag> { return this.http.get<unknown>(`${this.apiUrl}/${id}`).pipe(map((response) => this.toItem(response))); }
  getByCategory(idCategoria: number): Observable<Tag[]> { return this.http.get<unknown>(`${this.apiUrl}/categoria/${idCategoria}`).pipe(map((response) => this.toArray(response))); }
  create(request: TagRequest): Observable<unknown> { return this.http.post<unknown>(this.apiUrl, request); }
  update(id: number, request: TagRequest): Observable<unknown> { return this.http.put<unknown>(`${this.apiUrl}/${id}`, request); }
  deactivate(id: number): Observable<unknown> { return this.http.delete<unknown>(`${this.apiUrl}/${id}`); }
  private toArray(response: unknown): Tag[] {
    if (Array.isArray(response)) return response as Tag[];
    if (this.isEnvelope(response)) { const value = response.datos ?? response.data; return Array.isArray(value) ? value as Tag[] : value ? [value as Tag] : []; }
    return response ? [response as Tag] : [];
  }
  private toItem(response: unknown): Tag { return this.isEnvelope(response) ? (response.datos ?? response.data) as Tag : response as Tag; }
  private isEnvelope(value: unknown): value is ApiEnvelope<unknown> { return typeof value === 'object' && value !== null && ('datos' in value || 'data' in value); }
}
