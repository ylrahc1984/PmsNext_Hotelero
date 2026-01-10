import { enableProdMode, importProvidersFrom } from '@angular/core';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';

import { environment } from './environments/environment';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app/app-routing.module';
import { AppComponent } from './app/app.component';
import { AuthInterceptor } from './app/core/interceptors/auth.interceptor';
import { ErrorInterceptor } from './app/core/interceptors/error.interceptor';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(BrowserModule, AppRoutingModule, HttpClientModule),
    provideAnimations(),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }
  ]
}).catch((err) => console.error(err));
