import { HttpContextToken } from '@angular/common/http';

/** Suppresses global connectivity toasts for background requests with inline error handling. */
export const SUPPRESS_CONNECTIVITY_TOAST = new HttpContextToken<boolean>(() => false);
