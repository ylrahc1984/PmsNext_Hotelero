import { Injectable } from '@angular/core';

import { environment } from 'src/environments/environment';

declare const window: any;

@Injectable({
  providedIn: 'root'
})
export class GoogleMapsLoaderService {
  private loadingPromise: Promise<void> | null = null;

  load(): Promise<void> {
    console.info('[GoogleMapsLoader] load() solicitado');
    if (this.isGoogleMapsLoaded()) {
      console.info('[GoogleMapsLoader] Google Maps ya esta cargado');
      return Promise.resolve();
    }

    if (typeof window === 'undefined') {
      console.error('[GoogleMapsLoader] Window no disponible (SSR)');
      return Promise.reject('Google Maps solo esta disponible en el navegador.');
    }

    if (this.loadingPromise) {
      console.info('[GoogleMapsLoader] Reutilizando promesa en curso');
      return this.loadingPromise;
    }

    const apiKey = environment.googleMapsApiKey;
    if (!apiKey) {
      console.error('[GoogleMapsLoader] Falta googleMapsApiKey en environment');
      return Promise.reject('Falta configurar googleMapsApiKey en environments.');
    }

    this.loadingPromise = new Promise<void>((resolve, reject) => {
      const finalize = async () => {
        try {
          await this.ensurePlacesLibraryLoaded();
          if (this.isGoogleMapsLoaded()) {
            console.info('[GoogleMapsLoader] Script cargado correctamente');
            resolve();
            return;
          }
          throw new Error('Google Maps no se inicializo correctamente.');
        } catch (error: any) {
          this.loadingPromise = null;
          console.error('[GoogleMapsLoader] Google Maps no se inicializo correctamente tras onload', error);
          reject(error?.message ?? error ?? 'Google Maps no se inicializo correctamente.');
        }
      };

      const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-maps-loader]');
      if (existingScript) {
        // Si el script ya fue cargado por otro loader, pero no tiene nuestra marca `data-loaded`,
        // igual intentamos finalizar (evita quedar "colgado" esperando el evento load).
        if (this.isGoogleMapsLoaded()) {
          console.info('[GoogleMapsLoader] Script existente detectado y Google Maps ya disponible');
          finalize();
          return;
        }

        if (existingScript.getAttribute('data-loaded') === 'true') {
          console.info('[GoogleMapsLoader] Script existente ya cargado');
          finalize();
          return;
        }

        const readyState = (existingScript as any)?.readyState;
        if (readyState === 'complete' || readyState === 'loaded') {
          console.info('[GoogleMapsLoader] Script existente con readyState completo');
          finalize();
          return;
        }

        existingScript.addEventListener('load', () => {
          console.info('[GoogleMapsLoader] Script existente finalizo carga');
          finalize();
        });
        existingScript.addEventListener('error', error => {
          console.error('[GoogleMapsLoader] Error en script existente', error);
          this.loadingPromise = null;
          reject(error);
        });
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=beta`;
      script.async = true;
      script.defer = true;
      script.dataset['googleMapsLoader'] = 'true';

      script.onload = async () => {
        script.setAttribute('data-loaded', 'true');
        finalize();
      };

      script.onerror = error => {
        this.loadingPromise = null;
        console.error('[GoogleMapsLoader] Error al cargar el script', error);
        reject(error);
      };

      console.info('[GoogleMapsLoader] Inyectando script de Google Maps...');
      document.head.appendChild(script);
    });

    return this.loadingPromise;
  }

  private async ensurePlacesLibraryLoaded(): Promise<void> {
    const hasAutocompleteClasses =
      !!window?.google?.maps?.places?.PlaceAutocompleteElement || !!window?.google?.maps?.places?.Autocomplete;

    if (hasAutocompleteClasses) {
      return;
    }

    const importLibrary = window?.google?.maps?.importLibrary;
    if (typeof importLibrary === 'function') {
      const placesModule = await importLibrary('places');
      if (!window.google.maps.places) {
        window.google.maps.places = {};
      }
      Object.assign(window.google.maps.places, placesModule);
    }
  }

  private isGoogleMapsLoaded(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.google?.maps?.places &&
      (!!window.google.maps.places.PlaceAutocompleteElement || !!window.google.maps.places.Autocomplete)
    );
  }
}
