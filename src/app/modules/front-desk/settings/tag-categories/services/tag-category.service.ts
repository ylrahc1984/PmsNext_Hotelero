import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { TagCategory, TagCategoryRequest } from '../models/tag-category.model';

type ApiEnvelope<T> = { datos?: T; data?: T };

@Injectable({ providedIn: 'root' })
export class TagCategoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/reservas/categorias-tags`;
  getAll(): Observable<TagCategory[]> { return this.http.get<unknown>(this.apiUrl).pipe(map((response) => this.toArray(response))); }
  getActive(): Observable<TagCategory[]> { return this.http.get<unknown>(`${this.apiUrl}/activas`).pipe(map((response) => this.toArray(response))); }
  getById(id: number): Observable<TagCategory> { return this.http.get<unknown>(`${this.apiUrl}/${id}`).pipe(map((response) => this.toItem(response))); }
  create(request: TagCategoryRequest): Observable<unknown> { return this.http.post<unknown>(this.apiUrl, request); }
  update(id: number, request: TagCategoryRequest): Observable<unknown> { return this.http.put<unknown>(`${this.apiUrl}/${id}`, request); }
  deactivate(id: number): Observable<unknown> { return this.http.delete<unknown>(`${this.apiUrl}/${id}`); }
  private toArray(response: unknown): TagCategory[] {
    if (Array.isArray(response)) return response as TagCategory[];
    if (this.isEnvelope(response)) { const value = response.datos ?? response.data; return Array.isArray(value) ? value as TagCategory[] : value ? [value as TagCategory] : []; }
    return response ? [response as TagCategory] : [];
  }
  private toItem(response: unknown): TagCategory { return this.isEnvelope(response) ? (response.datos ?? response.data) as TagCategory : response as TagCategory; }
  private isEnvelope(value: unknown): value is ApiEnvelope<unknown> { return typeof value === 'object' && value !== null && ('datos' in value || 'data' in value); }
}
