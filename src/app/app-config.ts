import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { apiInterceptor } from './core/interceptors/api.interceptor';

export const appConfig = {
  providers: [
    provideHttpClient(
      withInterceptors([apiInterceptor])
    )
  ]
};