import { Injectable } from '@angular/core';

declare global {
  interface Window {
    __env: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

    get apiUrl(): string {
    if (!window.__env) {
        console.error('env.js no cargado');
    }
    return window.__env?.apiUrl || '';
    }
}