import { AfterViewInit, Directive, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output } from '@angular/core';

import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';

declare const window: any;

export interface GooglePlaceSelection {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId: string;
  name: string;
}

@Directive({
  selector: '[appGooglePlacesAutocomplete]',
  standalone: true
})
export class GooglePlacesAutocompleteDirective implements AfterViewInit, OnDestroy {
  @Input() componentRestrictions: { country?: string } | undefined;
  @Input() types: string[] = ['establishment'];
  @Input() debug = false;
  @Output() placeSelected = new EventEmitter<GooglePlaceSelection>();
  @Output() placeSelectionError = new EventEmitter<string>();

  private autocompleteElement: any;
  private placeListener: any;
  private inputPlaceListener: any;
  private documentPlaceListener: ((event: any) => void) | null = null;
  private originalDisplay?: string;
  private internalInput: HTMLInputElement | null = null;
  private internalInputListener: ((ev: Event) => void) | null = null;
  private originalInputListener: ((ev: Event) => void) | null = null;
  private internalInputRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private internalInputRetryCount = 0;
  private usingExternalInput = false;
  private mountedElement: HTMLElement | null = null;

  constructor(
    private elementRef: ElementRef<HTMLInputElement>,
    private zone: NgZone,
    private mapsLoader: GoogleMapsLoaderService
  ) {}

  private dbg(message: string, data?: unknown): void {
    if (!this.debug) return;
    if (data !== undefined) {
      console.log(`[PlacesAutocomplete] ${message}`, data);
      return;
    }
    console.log(`[PlacesAutocomplete] ${message}`);
  }

  ngAfterViewInit(): void {
    this.initAutocomplete();
  }

  ngOnDestroy(): void {
    if (this.autocompleteElement && this.placeListener) {
      // Compatibilidad: Google renombró `gmp-placeselect` -> `gmp-select`.
      this.autocompleteElement.removeEventListener('gmp-select', this.placeListener, true);
      this.autocompleteElement.removeEventListener('gmp-placeselect', this.placeListener, true);
    }
    if (this.inputPlaceListener) {
      this.elementRef.nativeElement.removeEventListener('gmp-select', this.inputPlaceListener, true);
      this.elementRef.nativeElement.removeEventListener('gmp-placeselect', this.inputPlaceListener, true);
    }
    if (this.documentPlaceListener) {
      document.removeEventListener('gmp-select', this.documentPlaceListener, true);
      document.removeEventListener('gmp-placeselect', this.documentPlaceListener, true);
      this.documentPlaceListener = null;
    }
    if (this.internalInput && this.internalInputListener) {
      this.internalInput.removeEventListener('input', this.internalInputListener);
    }
    if (this.originalInputListener) {
      this.elementRef.nativeElement.removeEventListener('input', this.originalInputListener);
    }
    if (this.originalDisplay !== undefined) {
      this.elementRef.nativeElement.style.display = this.originalDisplay;
    }
    if (this.mountedElement?.parentElement) {
      this.mountedElement.parentElement.removeChild(this.mountedElement);
    }
    if (this.internalInputRetryTimer) {
      clearTimeout(this.internalInputRetryTimer);
      this.internalInputRetryTimer = null;
    }
  }

  private initAutocomplete(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.mapsLoader
      .load()
      .then(() => {
        this.dbg('Loader resuelto. google?', !!window.google);
        const places = window.google?.maps?.places;
        if (!places) {
          console.error('[PlacesAutocomplete] google.maps.places no disponible');
          this.placeSelectionError.emit('Google Places no esta disponible.');
          return;
        }

        if (places.PlaceAutocompleteElement) {
          this.dbg('Usando PlaceAutocompleteElement (modo recomendado)');
          try {
            this.autocompleteElement = new places.PlaceAutocompleteElement();
            this.applyPlaceTheme(this.autocompleteElement);
            // En algunos builds `inputElement` puede parecer readonly, pero el assign sí funciona.
            // Probamos asignar y si falla, caemos al modo de input interno.
            this.mountElementHidden();

            try {
              (this.autocompleteElement as any).inputElement = this.elementRef.nativeElement;
              this.usingExternalInput = true;
              this.dbg('Modo inputElement (input real con ngModel)');
            } catch {
              // Fallback: input interno del web component (si el proyecto no puede usar inputElement).
              // Nota: algunos proyectos tienen shadow DOM cerrado, por lo que no siempre se podrá sincronizar el typing;
              // pero la selección vía `gmp-placeselect` debe seguir funcionando.
              this.usingExternalInput = false;
              if (this.mountedElement?.parentElement) {
                this.mountedElement.parentElement.removeChild(this.mountedElement);
              }
              this.mountedElement = null;
              this.mountElementWithInternalInput();
              this.dbg('Modo input interno (shadow DOM)');
            }
          } catch (error) {
            console.error('[PlacesAutocomplete] Error al inicializar PlaceAutocompleteElement', error);
            this.placeSelectionError.emit('No se pudo inicializar Google Places en este navegador.');
            return;
          }

          this.autocompleteElement.componentRestrictions = this.normalizeComponentRestrictions(
            this.componentRestrictions ?? { country: 'cr' }
          );
          this.autocompleteElement.types = this.types?.length ? this.types : ['establishment'];

          this.placeListener = (event: any) => this.zone.run(() => void this.handlePlaceSelected(event));
          // El evento no siempre burbujea: escuchamos en capture también.
          this.autocompleteElement.addEventListener('gmp-select', this.placeListener, true);
          this.autocompleteElement.addEventListener('gmp-placeselect', this.placeListener, true);

          this.inputPlaceListener = (event: any) => {
            this.zone.run(() => void this.handlePlaceSelected(event));
          };
          this.elementRef.nativeElement.addEventListener('gmp-select', this.inputPlaceListener, true);
          this.elementRef.nativeElement.addEventListener('gmp-placeselect', this.inputPlaceListener, true);

          // Debug profundo: escuchar en el documento para saber si el evento se dispara en otro target.
          if (this.debug && !this.documentPlaceListener) {
            this.documentPlaceListener = (event: any) => {
              const targetTag = (event?.target as any)?.tagName || (event?.target as any)?.localName || '';
              const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];
              const pathTags = Array.isArray(path)
                ? path
                    .map((p: any) => p?.tagName || p?.localName || '')
                    .filter(Boolean)
                    .slice(0, 6)
                : [];
              const eventType = (event?.type ?? '').toString();
              this.dbg(`${eventType} (document capture)`, {
                targetTag,
                pathTags,
                hasPlace: !!(event?.detail?.place || event?.place || event?.placePrediction || event?.detail?.placePrediction)
              });
            };
            document.addEventListener('gmp-select', this.documentPlaceListener, true);
            document.addEventListener('gmp-placeselect', this.documentPlaceListener, true);
          }
          return;
        }

        console.error('[PlacesAutocomplete] PlaceAutocompleteElement no disponible');
        this.placeSelectionError.emit('Google Places no está disponible en este navegador o proyecto.');
        return;
      })
      .catch(error => {
        console.error('[PlacesAutocomplete] Error al cargar Google Maps', error);
        this.placeSelectionError.emit(typeof error === 'string' ? error : 'No se pudo cargar Google Maps.');
      });
  }

  private async handlePlaceSelected(event: any): Promise<void> {
    const place = await this.resolvePlaceFromEvent(event);
    if (!place) {
      console.warn('[PlacesAutocomplete] Evento sin place/placePrediction', { type: event?.type });
      this.placeSelectionError.emit('Seleccione una opcion del listado de Google para obtener coordenadas.');
      return;
    }

    this.dbg('Evento recibido', {
      type: (event?.type ?? '').toString(),
      hasDetail: !!event?.detail,
      detailKeys: event?.detail ? Object.keys(event.detail) : [],
      placeKeys: Object.keys(place ?? {})
    });
    this.dbg('Place raw', place);

    this.dbg('gmp-placeselect recibido', {
      inputValue: this.internalInput?.value ?? this.elementRef.nativeElement.value ?? '',
      placeKeys: Object.keys(place ?? {})
    });

    // PlaceAutocompleteElement puede emitir un Place "ligero" (sin `id` / `formattedAddress`).
    // Intentamos pedir campos explícitos para asegurar `id` (placeId) + coordenadas.
    const fetchFields = (place as any)?.fetchFields;
    if (typeof fetchFields === 'function') {
      try {
        await fetchFields.call(place, { fields: ['id', 'formattedAddress', 'location', 'displayName'] });
      } catch (error) {
        console.warn('[PlacesAutocomplete] No se pudieron obtener campos del place', error);
        this.dbg('fetchFields falló', error);
      }
    }

    const location = place.location;
    const lat = typeof location?.lat === 'function' ? location.lat() : location?.lat;
    const lng = typeof location?.lng === 'function' ? location.lng() : location?.lng;

    if (lat === undefined || lng === undefined) {
      console.warn('[PlacesAutocomplete] Place sin coordenadas');
      this.placeSelectionError.emit('Seleccione una opcion del listado de Google para obtener coordenadas.');
      return;
    }

    this.placeSelectionError.emit('');

    const placeId = (place.id ?? place.placeId ?? place.place_id ?? '').toString();
    const formattedAddress =
      place.formattedAddress ??
      place.formatted_address ??
      place.displayName?.text ??
      place.displayName ??
      // Fallback: el texto visible en el input suele ser lo que el usuario espera guardar.
      this.internalInput?.value ??
      this.elementRef.nativeElement.value ??
      '';

    this.dbg('Selección parseada', { formattedAddress, placeId, lat, lng });

    // Si estamos usando input interno del web component, sincronizamos el valor al input original
    // para que `ngModel` reciba los cambios y el modelo se actualice.
    // Si `inputElement` fue asignado al input original, google ya escribe ahí; igual lo forzamos para consistencia.
    this.syncValueToOriginalInput(formattedAddress);

    this.placeSelected.emit({
      formattedAddress: (formattedAddress ?? '').toString(),
      lat,
      lng,
      placeId,
      name: (place.displayName?.text ?? place.displayName ?? '').toString()
    });
  }

  private async resolvePlaceFromEvent(event: any): Promise<any | null> {
    // Legacy: `gmp-placeselect` => event.detail.place
    const legacyPlace = event?.detail?.place ?? event?.place;
    if (legacyPlace) return legacyPlace;

    // New: `gmp-select` => event.placePrediction (o event.detail.placePrediction)
    const placePrediction = event?.placePrediction ?? event?.detail?.placePrediction;
    const toPlace = placePrediction?.toPlace;
    if (typeof toPlace === 'function') {
      try {
        const place = toPlace.call(placePrediction);
        return place ?? null;
      } catch (error) {
        console.warn('[PlacesAutocomplete] placePrediction.toPlace() fallo', error);
        return null;
      }
    }

    return null;
  }

  private applyPlaceTheme(element: HTMLElement): void {
    element.classList.add('places-autocomplete-themed');
    const style = (element as HTMLElement).style;
    // Variables GMPX (PlaceAutocompleteElement) + aliases GM (temas legacy) para forzar look claro en apps con tema oscuro.
    style.setProperty('--gmpx-color-surface', '#ffffff');
    style.setProperty('--gmpx-color-on-surface', '#212529');
    style.setProperty('--gmpx-color-outline', '#d0d5db');
    style.setProperty('--gmpx-color-primary', '#0d6efd');
    style.setProperty('--gmpx-shadow-elevation-1', '0 6px 18px rgba(0, 0, 0, 0.08)');
    style.setProperty('--gm-color-surface', '#ffffff');
    style.setProperty('--gm-color-on-surface', '#212529');
    style.setProperty('--gm-color-outline', '#d0d5db');
    style.setProperty('--gm-color-primary', '#0d6efd');
    style.setProperty('--gm-shadow-elevation-1', '0 6px 18px rgba(0, 0, 0, 0.08)');
    style.display = 'block';
    style.width = '100%';
    style.borderRadius = '6px';
  }

  private mountElementWithInternalInput(): void {
    // Para proyectos nuevos, Autocomplete clasico esta deshabilitado y algunos builds exponen inputElement como solo lectura.
    // En ese caso, insertamos el web component con su input interno y ocultamos el input original.
    const input = this.elementRef.nativeElement;
    const parent = input.parentElement;
    if (!parent) {
      console.error('[PlacesAutocomplete] No se pudo ubicar el input en el DOM');
      this.placeSelectionError.emit('No se pudo inicializar Google Places en este navegador.');
      return;
    }

    this.originalDisplay = input.style.display;
    input.style.display = 'none';

    const placeholder = input.getAttribute('placeholder') ?? '';
    if (placeholder) {
      this.autocompleteElement.setAttribute('placeholder', placeholder);
    }
    const element = this.autocompleteElement as HTMLElement;

    // Si previamente lo montamos en modo hidden, el elemento pudo quedar con estilos "0x0" e inert.
    // Al usarlo como input visible, debemos restaurar estilos para permitir interacción.
    this.resetHiddenMount(element);

    parent.insertBefore(element, input.nextSibling);
    this.mountedElement = element;

    // En este modo, el usuario escribe en un input interno (shadow DOM / componente).
    // Si no sincronizamos, Angular nunca ve los cambios y `[(ngModel)]` no se actualiza.
    this.setupInternalInputSync();
    this.setupOriginalInputSync();
  }

  private mountElementHidden(): void {
    const input = this.elementRef.nativeElement;
    const parent = input.parentElement;
    if (!parent) {
      console.error('[PlacesAutocomplete] No se pudo ubicar el input en el DOM');
      this.placeSelectionError.emit('No se pudo inicializar Google Places en este navegador.');
      return;
    }

    const element = this.autocompleteElement as HTMLElement;
    // Mantener conectado al DOM sin afectar layout/UI.
    // Importante: NO usar aria-hidden aquí porque el web component puede retener focus internamente.
    // Usamos `inert` para evitar interacción/focus sin afectar eventos programáticos.
    element.style.position = 'absolute';
    element.style.width = '0';
    element.style.height = '0';
    element.style.overflow = 'hidden';
    element.style.opacity = '0';
    element.style.pointerEvents = 'none';
    element.setAttribute('inert', '');
    element.removeAttribute('aria-hidden');

    parent.appendChild(element);
    this.mountedElement = element;
  }

  private resetHiddenMount(element: HTMLElement): void {
    element.style.removeProperty('position');
    element.style.removeProperty('width');
    element.style.removeProperty('height');
    element.style.removeProperty('overflow');
    element.style.removeProperty('opacity');
    element.style.removeProperty('pointer-events');
    element.removeAttribute('inert');
    element.removeAttribute('aria-hidden');
  }

  private setupInternalInputSync(): void {
    const internal = this.findInternalInput();
    if (!internal) {
      // El input interno puede renderizarse de forma asíncrona (shadow DOM).
      // Reintentamos un corto periodo para no perder la sincronización con ngModel.
      if (this.internalInputRetryCount < 25) {
        this.internalInputRetryCount += 1;
        this.internalInputRetryTimer = setTimeout(() => this.setupInternalInputSync(), 100);
      } else {
        this.dbg('No se pudo ubicar el input interno para sincronizar ngModel');
      }
      return;
    }

    this.internalInput = internal;
    this.internalInputRetryTimer = null;
    this.internalInputRetryCount = 0;

    this.internalInputListener = () => {
      this.syncValueToOriginalInput(this.internalInput?.value ?? '');
    };
    internal.addEventListener('input', this.internalInputListener);
  }

  private findInternalInput(): HTMLInputElement | null {
    const fromProperty = (this.autocompleteElement as any)?.inputElement as HTMLInputElement | undefined;
    if (fromProperty) return fromProperty;

    const shadow = (this.autocompleteElement as any)?.shadowRoot;
    const fromShadow = shadow?.querySelector?.('input') as HTMLInputElement | null;
    if (fromShadow) return fromShadow;

    // Fallback: algunos builds pueden renderizar un input en light DOM.
    const fromLight = (this.autocompleteElement as any)?.querySelector?.('input') as HTMLInputElement | null;
    return fromLight || null;
  }

  private setupOriginalInputSync(): void {
    // Mantiene el input interno alineado cuando el modelo actualiza el input original
    // (ej: edición de detalle y se setea la dirección desde API).
    this.originalInputListener = () => {
      if (this.internalInput) {
        this.internalInput.value = this.elementRef.nativeElement.value ?? '';
      }
    };
    this.elementRef.nativeElement.addEventListener('input', this.originalInputListener);
  }

  private syncValueToOriginalInput(value: string): void {
    const input = this.elementRef.nativeElement;
    input.value = value ?? '';
    // Dispara evento input para que Angular (ngModel) capture el cambio.
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private normalizeComponentRestrictions(
    restrictions: { country?: string | string[] }
  ): { country?: string[] } | undefined {
    if (!restrictions?.country) {
      return undefined;
    }
    return { country: Array.isArray(restrictions.country) ? restrictions.country : [restrictions.country] };
  }

  private handlePlaceChanged(): void {
    // Metodo legado (Autocomplete clasico) eliminado porque ya no aplica para proyectos nuevos.
  }
}
