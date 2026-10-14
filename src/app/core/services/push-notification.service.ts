import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';
import { PushSubscriptionApiService } from './push-subscription-api.service';
import {
  PushActivationState,
  PushSubscriptionContext,
  PushSubscriptionResponse,
  PushSubscriptionRegistrationRequest
} from '../models/push-subscription.models';
import { arrayBufferToBase64Url } from './push-web.utils';
import { environment } from 'src/environments/environment';

const PUSH_CONTEXT_STORAGE_KEY = 'pmsnext.push.subscription-context.v1';
export const PUSH_DIAG_VERSION = 'B2.3B-2-DIAG-01';

function pushDiag(message: string): void {
  console.info(`[PUSH-DIAG] ${message}`);
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly authService = inject(AuthService);
  private readonly pushApi = inject(PushSubscriptionApiService);
  private readonly swPush = inject(SwPush);
  private readonly stateSignal = signal<PushActivationState>({
    status: 'available',
    message: 'Notificaciones disponibles para este dispositivo.'
  });
  private recoveryInFlight: Promise<boolean> | null = null;
  private recoveryInFlightKey: string | null = null;
  private operationGeneration = 0;

  readonly state = this.stateSignal.asReadonly();

  refreshAvailability(): void {
    const unavailable = this.getAvailabilityFailure();
    if (unavailable) {
      this.stateSignal.set(unavailable);
      return;
    }

    if (Notification.permission === 'denied') {
      this.stateSignal.set({
        status: 'permission-denied',
        message: 'El navegador bloqueó las notificaciones para PMSNext.'
      });
      return;
    }

    const generation = ++this.operationGeneration;
    this.stateSignal.set({ status: 'restoring', message: 'Verificando el estado de las notificaciones…' });
    void this.restoreActivatedState(generation);
  }

  async activate(): Promise<void> {
    const generation = ++this.operationGeneration;
    pushDiag('ACTIVATE_START');
    const availabilityFailure = this.getAvailabilityFailure();
    if (availabilityFailure) {
      this.stateSignal.set(availabilityFailure);
      return;
    }

    if (!this.hasValidSession()) {
      this.stateSignal.set({ status: 'error', message: 'Debe iniciar sesión para activar las notificaciones.' });
      return;
    }

    const context = this.getCurrentContext();
    if (!context) {
      this.stateSignal.set({ status: 'error', message: 'No se pudo validar el contexto de usuario e instalación.' });
      return;
    }

    this.stateSignal.set({ status: 'activating', message: 'Activando notificaciones…' });

    try {
      const config = await firstValueFrom(this.pushApi.getPublicConfig());
      if (!config?.enabled) {
        this.stateSignal.set({ status: 'disabled', message: 'Las notificaciones están deshabilitadas en esta instalación.' });
        return;
      }

      const vapidPublicKey = config.vapidPublicKey?.trim();
      if (!vapidPublicKey) {
        this.stateSignal.set({ status: 'error', message: 'La instalación no entregó una clave pública de notificaciones válida.' });
        return;
      }

      const registration = await this.getActiveServiceWorkerRegistration();
      let subscription = await registration.pushManager.getSubscription();
      const storedContext = this.readStoredContext();

      if (subscription && !this.contextMatches(storedContext, context)) {
        this.stateSignal.set({
          status: 'error',
          message: 'Existe una suscripción de contexto desconocido. No se reutilizó para proteger el aislamiento entre instalaciones y usuarios.'
        });
        return;
      }

      if (subscription && storedContext && !this.isCompleteAssociation(storedContext)) {
        const recovered = await this.recoverExistingSubscription(context, storedContext, subscription);
        if (recovered) {
          if (this.isCurrentOperation(generation)) {
            this.stateSignal.set({ status: 'activated', message: 'Notificaciones activadas para este dispositivo.' });
          }
        } else {
          if (this.isCurrentOperation(generation)) {
            this.stateSignal.set({
              status: 'error',
              message: 'No se pudo recuperar la asociación existente. No se creó una nueva suscripción.'
            });
          }
        }
        return;
      }

      if (!subscription) {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          this.stateSignal.set({
            status: 'permission-denied',
            message: 'No se concedió permiso para mostrar notificaciones.'
          });
          return;
        }

        subscription = await this.swPush.requestSubscription({ serverPublicKey: vapidPublicKey });
        this.storeContext(context);
      }

      const payload = this.toRegistrationRequest(subscription);
      let registered = await this.findRegisteredSubscription(payload.endpoint);
      if (!registered) {
        pushDiag('POST_REQUEST_START');
        const created = await firstValueFrom(this.pushApi.registerSubscription(payload));
        registered = this.hasValidSubscriptionId(created) ? { ...created, endpoint: payload.endpoint } :
          await this.findRegisteredSubscription(payload.endpoint);
      }

      if (!registered || !this.hasValidSubscriptionId(registered)) {
        this.stateSignal.set({
          status: 'error',
          message: 'La suscripción se creó, pero no se pudo confirmar su asociación en PMSNext.'
        });
        return;
      }

      this.storeContext({ ...context, endpoint: payload.endpoint, idSuscripcion: registered.idSuscripcion });
      if (this.isCurrentOperation(generation)) {
        this.stateSignal.set({ status: 'activated', message: 'Notificaciones activadas para este dispositivo.' });
      }
    } catch (error) {
      if (this.isCurrentOperation(generation)) {
        this.stateSignal.set({ status: 'error', message: this.describeError(error) });
      }
    }
  }

  async deactivate(): Promise<void> {
    pushDiag('DEACTIVATE_START');
    if (this.stateSignal().status === 'deactivating') {
      pushDiag('BLOCKED: ALREADY_DEACTIVATING');
      return;
    }
    const generation = ++this.operationGeneration;

    const availabilityFailure = this.getAvailabilityFailure();
    if (availabilityFailure) {
      pushDiag('BLOCKED: AVAILABILITY');
      this.stateSignal.set(availabilityFailure);
      return;
    }

    if (!this.hasValidSession()) {
      pushDiag('BLOCKED: SESSION_INVALID');
      this.stateSignal.set({ status: 'error', message: 'Debe iniciar sesión para desactivar las notificaciones.' });
      return;
    }

    const context = this.getCurrentContext();
    const storedContext = this.readStoredContext();
    if (!context || !this.contextMatches(storedContext, context) || !storedContext?.endpoint || !this.hasValidSubscriptionId(storedContext)) {
      pushDiag('BLOCKED: LOCAL_ASSOCIATION_INVALID');
      this.stateSignal.set({
        status: 'error',
        message: 'No se encontró una asociación local confiable para este dispositivo. No se revocó ninguna suscripción.'
      });
      return;
    }
    pushDiag('CONTEXT_VALID');
    pushDiag('LOCAL_ASSOCIATION_FOUND');

    this.stateSignal.set({ status: 'deactivating', message: 'Desactivando notificaciones…' });

    try {
      const registration = await this.getActiveServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription || subscription.endpoint !== storedContext.endpoint) {
        pushDiag(!subscription ? 'BLOCKED: LOCAL_SUBSCRIPTION_MISSING' : 'BLOCKED: ENDPOINT_MISMATCH');
        this.stateSignal.set({
          status: 'error',
          message: 'La suscripción local no coincide con la asociación registrada. No se revocó ninguna suscripción.'
        });
        return;
      }
      pushDiag('LOCAL_SUBSCRIPTION_FOUND');
      pushDiag('ENDPOINT_MATCH');

      if (!storedContext.remoteRevoked) {
        const response = await firstValueFrom(this.pushApi.resolveSubscription(subscription.endpoint));
        const data = response?.data;
        if (!this.isValidResolveResponse(response) || data.idSuscripcion !== storedContext.idSuscripcion) {
          pushDiag('BLOCKED: API_SUBSCRIPTION_MISMATCH');
          this.stateSignal.set({
            status: 'error',
            message: 'No se pudo confirmar la asociación actual con PMSNext. No se revocó ninguna suscripción.'
          });
          return;
        }
        pushDiag('API_SUBSCRIPTION_MATCH');

        const currentContext = this.getCurrentContext();
        const currentStoredContext = this.readStoredContext();
        const currentRegistration = await this.getActiveServiceWorkerRegistration();
        const currentSubscription = await currentRegistration.pushManager.getSubscription();
        if (!this.isCurrentOperation(generation) || !currentContext || !currentStoredContext ||
          !this.contextMatches(currentStoredContext, currentContext) ||
          currentStoredContext.endpoint !== subscription.endpoint ||
          currentStoredContext.idSuscripcion !== data.idSuscripcion ||
          !currentSubscription || currentSubscription.endpoint !== subscription.endpoint) {
          this.stateSignal.set({
            status: 'activated',
            message: 'No se pudo confirmar la asociación actual con PMSNext. No se revocó ninguna suscripción.'
          });
          return;
        }

        pushDiag('DELETE_REQUEST_START');
        await firstValueFrom(this.pushApi.revokeSubscription(data.idSuscripcion));
        pushDiag('DELETE_REQUEST_SUCCESS');
      }

      try {
        pushDiag('LOCAL_UNSUBSCRIBE_START');
        const unsubscribed = await subscription.unsubscribe();
        if (!unsubscribed) throw new Error('El navegador no confirmó la cancelación local.');
        pushDiag('LOCAL_UNSUBSCRIBE_SUCCESS');
      } catch {
        this.storeContext({ ...storedContext, remoteRevoked: true });
        this.stateSignal.set({
          status: 'remote-revoked',
          message: 'El registro remoto fue revocado, pero la suscripción local sigue presente. Intente nuevamente.'
        });
        return;
      }

      this.removeStoredContext();
      if (this.isCurrentOperation(generation)) {
        this.stateSignal.set({ status: 'available', message: 'Notificaciones disponibles para este dispositivo.' });
      }
      pushDiag('DEACTIVATE_COMPLETED');
    } catch (error) {
      pushDiag('BLOCKED: DEACTIVATE_ERROR');
      if (this.isCurrentOperation(generation)) {
        this.stateSignal.set({ status: 'activated', message: this.describeDeactivationError(error) });
      }
    }
  }

  private getAvailabilityFailure(): PushActivationState | null {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return { status: 'unsupported', message: 'Las notificaciones no están disponibles en este entorno.' };
    }

    const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
    if (!window.isSecureContext && !isLocalhost) {
      return { status: 'unsupported', message: 'Las notificaciones requieren una conexión HTTPS.' };
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { status: 'unsupported', message: 'Este navegador no admite notificaciones Web Push.' };
    }

    return null;
  }

  private hasValidSession(): boolean {
    const token = this.authService.getToken();
    return !!token && !this.authService.isTokenExpired(token);
  }

  private getCurrentContext(): PushSubscriptionContext | null {
    const user = String(this.authService.getCurrentUser()?.usuario ?? '').trim();
    if (!user) return null;

    try {
      const configuredApiUrl = String(environment.apiUrl ?? '').trim();
      if (!configuredApiUrl) return null;
      const url = new URL(configuredApiUrl, window.location.origin);
      const path = url.pathname.replace(/\/+$/, '');
      return { installation: `${url.origin}${path}`, user };
    } catch {
      return null;
    }
  }

  private async getActiveServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
    const registered = await navigator.serviceWorker.getRegistration();
    if (!registered) {
      throw new Error('El Service Worker de PMSNext todavía no está disponible. Intente nuevamente en unos segundos.');
    }

    const ready = await navigator.serviceWorker.ready;
    if (!ready.active) {
      throw new Error('El Service Worker de PMSNext no está activo.');
    }

    return ready;
  }

  private toRegistrationRequest(subscription: PushSubscription): PushSubscriptionRegistrationRequest {
    return {
      endpoint: subscription.endpoint,
      p256dh: arrayBufferToBase64Url(subscription.getKey('p256dh')),
      auth: arrayBufferToBase64Url(subscription.getKey('auth'))
    };
  }

  private async findRegisteredSubscription(endpoint: string): Promise<PushSubscriptionResponse | null> {
    const response = await firstValueFrom(this.pushApi.listSubscriptions());
    const subscriptions = Array.isArray(response)
      ? response
      : response.data ?? response.subscriptions ?? [];

    return subscriptions.find((subscription) => subscription.endpoint === endpoint) ?? null;
  }

  private async restoreActivatedState(generation: number): Promise<void> {
    const context = this.getCurrentContext();
    const storedContext = this.readStoredContext();
    if (!context || !storedContext || !this.contextMatches(storedContext, context)) {
      this.setAvailableIfCurrent(generation);
      return;
    }

    try {
      const registration = await this.getActiveServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        this.setAvailableIfCurrent(generation);
        return;
      }

      if (!this.isCompleteAssociation(storedContext)) {
        const recovered = await this.recoverExistingSubscription(context, storedContext, subscription);
        if (recovered && this.isCurrentOperation(generation)) {
          this.stateSignal.set({ status: 'activated', message: 'Notificaciones activadas para este dispositivo.' });
        } else if (this.isCurrentOperation(generation)) {
          this.stateSignal.set({ status: 'available', message: 'Notificaciones disponibles para este dispositivo.' });
        }
        return;
      }

      if (subscription.endpoint !== storedContext.endpoint) {
        this.setAvailableIfCurrent(generation);
        return;
      }

      if (storedContext.remoteRevoked) {
        this.stateSignal.set({
          status: 'remote-revoked',
          message: 'El registro remoto fue revocado, pero la suscripción local sigue presente. Intente nuevamente.'
        });
        return;
      }

      const response = await firstValueFrom(this.pushApi.resolveSubscription(subscription.endpoint));
      const currentContext = this.getCurrentContext();
      const currentStoredContext = this.readStoredContext();
      if (this.isCurrentOperation(generation) && currentContext && currentStoredContext &&
        this.contextMatches(currentStoredContext, currentContext) &&
        currentStoredContext.endpoint === subscription.endpoint &&
        currentStoredContext.idSuscripcion === storedContext.idSuscripcion &&
        this.isValidResolveResponse(response) && response.data.idSuscripcion === storedContext.idSuscripcion) {
        this.stateSignal.set({ status: 'activated', message: 'Notificaciones activadas para este dispositivo.' });
      } else if (this.isCurrentOperation(generation)) {
        this.stateSignal.set({ status: 'available', message: 'Notificaciones disponibles para este dispositivo.' });
      }
    } catch {
      if (this.isCurrentOperation(generation)) {
        this.stateSignal.set({ status: 'available', message: 'Notificaciones disponibles para este dispositivo.' });
      }
    }
  }

  private recoverExistingSubscription(
    context: PushSubscriptionContext,
    storedContext: PushSubscriptionContext,
    subscription: PushSubscription
  ): Promise<boolean> {
    if (this.isCompleteAssociation(storedContext)) return Promise.resolve(false);
    if (!storedContext.installation || !storedContext.user || !this.contextMatches(storedContext, context)) {
      return Promise.resolve(false);
    }

    const recoveryKey = `${context.installation}\u0000${context.user}`;
    if (this.recoveryInFlight && this.recoveryInFlightKey === recoveryKey) {
      return this.recoveryInFlight;
    }

    const recovery = (async (): Promise<boolean> => {
      try {
        const response = await firstValueFrom(this.pushApi.resolveSubscription(subscription.endpoint));
        const data = response?.data;
        if (response?.success !== true || data?.found !== true ||
          !this.hasValidSubscriptionId({ idSuscripcion: data.idSuscripcion }) || data.estado !== 'ACTIVA') {
          return false;
        }

        const currentContext = this.getCurrentContext();
        if (!currentContext || !this.contextMatches(context, currentContext)) return false;

        const registration = await this.getActiveServiceWorkerRegistration();
        const currentSubscription = await registration.pushManager.getSubscription();
        if (!currentSubscription || currentSubscription.endpoint !== subscription.endpoint) return false;

        this.storeContext({
          installation: context.installation,
          user: context.user,
          endpoint: subscription.endpoint,
          idSuscripcion: data.idSuscripcion
        });
        return true;
      } catch {
        return false;
      }
    })();

    this.recoveryInFlight = recovery;
    this.recoveryInFlightKey = recoveryKey;
    void recovery.finally(() => {
      if (this.recoveryInFlight === recovery) {
        this.recoveryInFlight = null;
        this.recoveryInFlightKey = null;
      }
    });
    return recovery;
  }

  private readStoredContext(): PushSubscriptionContext | null {
    try {
      const stored = localStorage.getItem(PUSH_CONTEXT_STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as Partial<PushSubscriptionContext>;
      if (!parsed.installation || !parsed.user) return null;
      return {
        installation: parsed.installation,
        user: parsed.user,
        endpoint: parsed.endpoint,
        idSuscripcion: parsed.idSuscripcion,
        remoteRevoked: parsed.remoteRevoked
      };
    } catch {
      return null;
    }
  }

  private storeContext(context: PushSubscriptionContext): void {
    localStorage.setItem(PUSH_CONTEXT_STORAGE_KEY, JSON.stringify(context));
  }

  private removeStoredContext(): void {
    localStorage.removeItem(PUSH_CONTEXT_STORAGE_KEY);
  }

  private hasValidSubscriptionId(value: { idSuscripcion?: number } | null | undefined): value is { idSuscripcion: number } {
    return Number.isSafeInteger(value?.idSuscripcion) && (value?.idSuscripcion ?? 0) > 0;
  }

  private isValidResolveResponse(response: import('../models/push-subscription.models').PushSubscriptionResolveResponse | null | undefined): response is import('../models/push-subscription.models').PushSubscriptionResolveResponse & { data: { found: true; idSuscripcion: number; estado: 'ACTIVA' } } {
    const data = response?.data;
    return response?.success === true && data?.found === true &&
      this.hasValidSubscriptionId({ idSuscripcion: data.idSuscripcion }) &&
      data.estado === 'ACTIVA';
  }

  private isCurrentOperation(generation: number): boolean {
    return generation === this.operationGeneration;
  }

  private setAvailableIfCurrent(generation: number): void {
    if (this.isCurrentOperation(generation)) {
      this.stateSignal.set({ status: 'available', message: 'Notificaciones disponibles para este dispositivo.' });
    }
  }

  private isCompleteAssociation(context: PushSubscriptionContext): boolean {
    return !!context.endpoint && this.hasValidSubscriptionId(context);
  }

  private contextMatches(stored: PushSubscriptionContext | null, current: PushSubscriptionContext): boolean {
    return !!stored && stored.installation === current.installation && stored.user === current.user;
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401 || error.status === 403) return 'La sesión no permite activar las notificaciones.';
      if (error.status === 0) return 'No se pudo conectar con la instalación para registrar las notificaciones.';
      return 'No fue posible registrar las notificaciones en PMSNext.';
    }

    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return 'El navegador no permitió activar las notificaciones.';
    }

    return error instanceof Error && error.message
      ? error.message
      : 'No fue posible activar las notificaciones.';
  }

  private describeDeactivationError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401 || error.status === 403) return 'La sesión no permite desactivar las notificaciones.';
      if (error.status === 404) return 'La suscripción ya no está disponible en PMSNext. Intente actualizar el estado.';
      if (error.status === 0) return 'No se pudo conectar con la instalación para desactivar las notificaciones.';
      return 'No fue posible revocar las notificaciones en PMSNext. Puede intentar nuevamente.';
    }

    return error instanceof Error && error.message
      ? error.message
      : 'No fue posible desactivar las notificaciones. Puede intentar nuevamente.';
  }
}
