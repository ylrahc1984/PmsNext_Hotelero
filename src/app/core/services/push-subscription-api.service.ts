import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import {
  PushPublicConfig,
  PushSubscriptionListResponse,
  PushSubscriptionRegistrationRequest,
  PushSubscriptionResolveResponse,
  PushSubscriptionResponse
} from '../models/push-subscription.models';

@Injectable({ providedIn: 'root' })
export class PushSubscriptionApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${String(environment.apiUrl ?? '').replace(/\/+$/, '')}/v1/push`;

  getPublicConfig(): Observable<PushPublicConfig> {
    return this.http.get<PushPublicConfig>(`${this.baseUrl}/config`);
  }

  registerSubscription(payload: PushSubscriptionRegistrationRequest): Observable<PushSubscriptionResponse> {
    return this.http.post<PushSubscriptionResponse>(`${this.baseUrl}/subscriptions`, payload);
  }

  listSubscriptions(): Observable<PushSubscriptionListResponse> {
    return this.http.get<PushSubscriptionListResponse>(`${this.baseUrl}/subscriptions`);
  }

  resolveSubscription(endpoint: string): Observable<PushSubscriptionResolveResponse> {
    return this.http.post<PushSubscriptionResolveResponse>(`${this.baseUrl}/subscriptions/resolve`, { endpoint });
  }

  revokeSubscription(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/subscriptions/${id}`);
  }
}
