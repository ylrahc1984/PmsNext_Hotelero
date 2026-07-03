import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { MealPlanRequest } from '../models/meal-plan-request.model';
import { MealPlan } from '../models/meal-plan.model';

@Injectable({ providedIn: 'root' })
export class MealPlansService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/planalimenticio`;

  getMealPlans(): Observable<MealPlan[]> {
    return this.http.get<MealPlan[] | MealPlan | null>(this.apiUrl).pipe(
      map((response) => {
        if (!response) {
          return [];
        }

        return Array.isArray(response) ? response : [response];
      })
    );
  }

  createMealPlan(request: MealPlanRequest): Observable<MealPlanRequest> {
    return this.http.post<MealPlanRequest>(this.apiUrl, { ...request, proceso: 1 });
  }

  updateMealPlan(codigo: string, request: MealPlanRequest): Observable<MealPlanRequest> {
    return this.http.put<MealPlanRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`, { ...request, proceso: 2 });
  }

  deleteMealPlan(codigo: string): Observable<MealPlanRequest> {
    return this.http.delete<MealPlanRequest>(`${this.apiUrl}/${encodeURIComponent(codigo)}`);
  }
}
