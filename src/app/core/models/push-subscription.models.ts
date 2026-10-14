export interface PushPublicConfig {
  enabled: boolean;
  vapidPublicKey: string | null;
}

export interface PushSubscriptionRegistrationRequest {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** The API may return additional server-managed fields. */
export interface PushSubscriptionResponse {
  idSuscripcion?: number;
  endpoint?: string;
}

export interface PushSubscriptionResolveData {
  found: boolean;
  idSuscripcion: number | null;
  estado: string | null;
}

export interface PushSubscriptionResolveResponse {
  success: boolean;
  message: string;
  data: PushSubscriptionResolveData | null;
}

export type PushSubscriptionListResponse = PushSubscriptionResponse[] | {
  data?: PushSubscriptionResponse[];
  subscriptions?: PushSubscriptionResponse[];
};

export type PushActivationStatus =
  | 'available'
  | 'restoring'
  | 'activating'
  | 'deactivating'
  | 'remote-revoked'
  | 'activated'
  | 'permission-denied'
  | 'unsupported'
  | 'disabled'
  | 'error';

export interface PushActivationState {
  status: PushActivationStatus;
  message: string;
}

export interface PushSubscriptionContext {
  installation: string;
  user: string;
  endpoint?: string;
  idSuscripcion?: number;
  remoteRevoked?: boolean;
}
