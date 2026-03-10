import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbTypeaheadModule, NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { OperatorFunction, Subject, merge } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, tap } from 'rxjs/operators';

import { GooglePlaceSelection, GooglePlacesAutocompleteDirective } from '../shared/google-places-autocomplete.directive';
import { DetalleForm } from './reserva-create.models';
import { hasCoordinates, safeJsonStringify } from './reserva-create.utils';
import { TipoPaxUI } from '../services/tipo-pax.service';
import { PlanTarifaUI } from '../../catalogos/listas-precios/planes-tarifas.service';
import { ListaPrecioUI } from '../../catalogos/listas-precios/lista-precio.models';
import { ServicioPrecioApiItem } from './reserva-create.tarifa.models';

@Component({
  selector: 'app-reserva-create-detalle-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbTypeaheadModule, GooglePlacesAutocompleteDirective],
  templateUrl: './reserva-create-detalle-modal.component.html',
  styleUrls: ['./reserva-create-detalle-modal.component.scss']
})
export class ReservaCreateDetalleModalComponent implements OnChanges {
  @Input() open = false;
  @Input() saving = false;
  @Input() editingDetalleId: number | null = null;
  @Input({ required: true }) detalleForm!: DetalleForm;
  @Input() servicios: ServicioPrecioApiItem[] = [];
  @Input() serviciosLoading = false;
  @Input() reglaTarifaError = '';
  @Input() allowManualPricing = false;
  @Input() planesTarifas: PlanTarifaUI[] = [];
  @Input() listaPrecios: ListaPrecioUI[] = [];
  @Input() tiposPax: TipoPaxUI[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();
  @Output() serviceChange = new EventEmitter<string>();
  @Output() recalculate = new EventEmitter<void>();
  @Output() tarifaContextChange = new EventEmitter<void>();
  @Output() servicioSearch = new EventEmitter<string>();

  origenAutocompleteMessage = '';
  destinoAutocompleteMessage = '';
  copiedLink: 'origen' | 'destino' | null = null;
  copyError = '';
  copyErrorTarget: 'origen' | 'destino' | null = null;
  locationInfoTarget: 'origen' | 'destino' | null = null;
  servicioSearchValue: ServicioPrecioApiItem | string = '';
  submitLocked = false;
  private servicioSearchTouched = false;
  private lastServicioTerm = '';
  private readonly serviciosRefresh$ = new Subject<string>();

  readonly searchServicios: OperatorFunction<string, readonly ServicioPrecioApiItem[]> = (text$) => {
    const userInput$ = text$.pipe(
      map((value) => (value ?? '').toString()),
      debounceTime(300),
      distinctUntilChanged(),
      tap((term) => {
        this.lastServicioTerm = term;
        this.servicioSearchTouched = true;
        this.servicioSearch.emit(term.trim());
      })
    );

    return merge(userInput$, this.serviciosRefresh$).pipe(
      map((term) => this.filterServicios(term))
    );
  };

  get selectedListaPrecio(): ListaPrecioUI | null {
    const code = (this.detalleForm?.codLstPrecio ?? '').toString().trim();
    if (!code) return null;
    return (this.listaPrecios || []).find((item) => (item.codigo ?? '').toString().trim() === code) ?? null;
  }

  get isSubmitting(): boolean {
    return this.submitLocked || this.saving;
  }

  ngOnChanges(changes: SimpleChanges): void {
    const openChange = changes['open'];
    if (openChange?.currentValue !== true) {
      this.submitLocked = false;
    }

    if (changes['saving'] && changes['saving'].currentValue !== true) {
      this.submitLocked = false;
    }

    if (openChange?.currentValue === true && openChange?.previousValue !== true) {
      this.submitLocked = false;
      this.resetAutocompleteState();
      this.resetServicioSearch();
      this.syncServicioSearchSelection();
    }

    if (this.open && changes['detalleForm']) {
      this.servicioSearchTouched = false;
      this.syncServicioSearchSelection();
    }

    if (this.open && changes['servicios']) {
      this.syncServicioSearchSelection();
    }
  }

  onClose(): void {
    if (this.isSubmitting) {
      return;
    }
    this.resetAutocompleteState();
    this.locationInfoTarget = null;
    this.close.emit();
  }

  onTarifaChange(): void {
    this.tarifaContextChange.emit();
  }

  onServicioSelected(event: NgbTypeaheadSelectItemEvent): void {
    const item = event.item as ServicioPrecioApiItem;
    if (!item) return;
    this.servicioSearchTouched = false;
    this.servicioSearchValue = item;
    this.detalleForm.codServicio = item.CodServicio;
    this.serviceChange.emit(item.CodServicio);
  }

  onServicioInputChange(value: ServicioPrecioApiItem | string): void {
    if (typeof value !== 'string') return;
    const term = value.trim();
    if (!term) {
      this.detalleForm.codServicio = '';
      this.serviceChange.emit('');
      return;
    }
    if (this.detalleForm.codServicio) {
      this.detalleForm.codServicio = '';
      this.serviceChange.emit('');
    }
  }

  onSubmit(formRef: any): void {
    if (this.isSubmitting) {
      return;
    }
    this.submitLocked = true;
    this.save.emit(formRef);
  }

  openLocationInfo(tipo: 'origen' | 'destino'): void {
    this.locationInfoTarget = tipo;
    this.copyError = '';
    this.copyErrorTarget = null;
    this.copiedLink = null;
  }

  closeLocationInfo(): void {
    this.locationInfoTarget = null;
    this.copyError = '';
    this.copyErrorTarget = null;
    this.copiedLink = null;
  }

  addPaxRow(): void {
    const list = this.detalleForm.detallesPax ?? [];
    const used = new Set(list.map((item) => (item.tipoPax || '').toString().trim().toUpperCase()));
    const defaultTipo = (this.tiposPax || []).find((item) => !used.has((item.code || '').toString().trim().toUpperCase()))?.code ?? '';
    this.detalleForm.detallesPax = [
      ...list,
      {
        tipoPax: defaultTipo,
        cantidad: 0,
        precioTotal: 0
      }
    ];
    this.recalculate.emit();
  }

  removePaxRow(index: number): void {
    const list = this.detalleForm.detallesPax ?? [];
    if (list.length <= 1) {
      list[0] = { ...list[0], cantidad: 0, precioTotal: 0 };
      this.detalleForm.detallesPax = [...list];
      this.recalculate.emit();
      return;
    }
    this.detalleForm.detallesPax = list.filter((_, i) => i !== index);
    this.onManualPaxPriceChange();
    this.recalculate.emit();
  }

  onManualPaxPriceChange(): void {
    const total = (this.detalleForm.detallesPax ?? []).reduce((sum, item) => sum + (Number(item?.precioTotal ?? 0) || 0), 0);
    this.detalleForm.montoServicio = total;
  }

  isTipoPaxDisabled(tipo: string, index: number): boolean {
    const normalized = (tipo || '').toString().trim().toUpperCase();
    if (!normalized) return false;
    return (this.detalleForm.detallesPax ?? []).some((item, idx) => idx !== index && (item.tipoPax || '').toString().trim().toUpperCase() === normalized);
  }

  onPlaceSelected(tipo: 'origen' | 'destino', selection: GooglePlaceSelection): void {
    const formatted = (selection.formattedAddress || '').toString().trim();
    const name = (selection.name || '').toString().trim();
    const displayText = name && formatted ? (formatted.toLowerCase().includes(name.toLowerCase()) ? formatted : `${name}, ${formatted}`) : (formatted || name);
    const googlePayload = { ...selection, displayText };

    if (tipo === 'origen') {
      this.detalleForm.origenDireccionGoogle = displayText;
      this.detalleForm.origenGoogle = safeJsonStringify(googlePayload);
      this.detalleForm.origenLat = selection.lat;
      this.detalleForm.origenLng = selection.lng;
      this.detalleForm.origenPlaceId = selection.placeId;
      this.origenAutocompleteMessage = '';
    } else {
      this.detalleForm.destinoDireccionGoogle = displayText;
      this.detalleForm.destinoGoogle = safeJsonStringify(googlePayload);
      this.detalleForm.destinoLat = selection.lat;
      this.detalleForm.destinoLng = selection.lng;
      this.detalleForm.destinoPlaceId = selection.placeId;
      this.destinoAutocompleteMessage = '';
    }
    this.copyError = '';
    this.copiedLink = null;
    this.copyErrorTarget = null;
  }

  onPlaceSelectionError(tipo: 'origen' | 'destino', message: string): void {
    const normalizedMessage = (message || '').trim();
    // El directive emite "" cuando la selección es válida (para limpiar errores).
    // En ese caso NO debemos resetear coordenadas/placeId.
    if (!normalizedMessage) {
      if (tipo === 'origen') {
        this.origenAutocompleteMessage = '';
      } else {
        this.destinoAutocompleteMessage = '';
      }
      this.copyError = '';
      this.copyErrorTarget = null;
      this.copiedLink = null;
      return;
    }

    const displayMessage = normalizedMessage || 'Seleccione una opción del listado de Google para obtener coordenadas.';
    if (tipo === 'origen') {
      this.origenAutocompleteMessage = displayMessage;
      this.detalleForm.origenGoogle = '';
      this.detalleForm.origenPlaceId = '';
      this.detalleForm.origenLat = 0;
      this.detalleForm.origenLng = 0;
    } else {
      this.destinoAutocompleteMessage = displayMessage;
      this.detalleForm.destinoGoogle = '';
      this.detalleForm.destinoPlaceId = '';
      this.detalleForm.destinoLat = 0;
      this.detalleForm.destinoLng = 0;
    }
    this.copyError = '';
    this.copyErrorTarget = null;
    this.copiedLink = null;
  }

  onDireccionGoogleChange(tipo: 'origen' | 'destino', value: string): void {
    const v = (value || '').trim();
    if (v) return;

    if (tipo === 'origen') {
      this.detalleForm.origenGoogle = '';
      this.detalleForm.origenPlaceId = '';
      this.detalleForm.origenLat = 0;
      this.detalleForm.origenLng = 0;
      this.origenAutocompleteMessage = '';
    } else {
      this.detalleForm.destinoGoogle = '';
      this.detalleForm.destinoPlaceId = '';
      this.detalleForm.destinoLat = 0;
      this.detalleForm.destinoLng = 0;
      this.destinoAutocompleteMessage = '';
    }
    this.copyError = '';
    this.copyErrorTarget = null;
    this.copiedLink = null;
  }

  getMapsLink(tipo: 'origen' | 'destino'): string {
    const lat = tipo === 'origen' ? this.detalleForm.origenLat : this.detalleForm.destinoLat;
    const lng = tipo === 'origen' ? this.detalleForm.origenLng : this.detalleForm.destinoLng;
    if (!hasCoordinates(lat, lng)) {
      return '';
    }
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  async copyMapsLink(tipo: 'origen' | 'destino'): Promise<void> {
    const link = this.getMapsLink(tipo);
    const lat = tipo === 'origen' ? this.detalleForm.origenLat : this.detalleForm.destinoLat;
    const lng = tipo === 'origen' ? this.detalleForm.origenLng : this.detalleForm.destinoLng;
    if (!hasCoordinates(lat, lng) || !link) {
      this.copyError = 'Seleccione una opción del listado de Google para obtener coordenadas.';
      this.copyErrorTarget = tipo;
      this.copiedLink = null;
      return;
    }

    if (!navigator?.clipboard?.writeText) {
      this.copyError = 'Copiado no disponible en este navegador.';
      this.copyErrorTarget = tipo;
      this.copiedLink = null;
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      this.copyError = '';
      this.copyErrorTarget = null;
      this.copiedLink = tipo;
      setTimeout(() => (this.copiedLink = null), 2000);
    } catch {
      this.copyError = 'No se pudo copiar el enlace. Intente manualmente.';
      this.copyErrorTarget = tipo;
      this.copiedLink = null;
    }
  }

  private resetAutocompleteState(): void {
    this.origenAutocompleteMessage = '';
    this.destinoAutocompleteMessage = '';
    this.copiedLink = null;
    this.copyError = '';
    this.copyErrorTarget = null;
  }

  private resetServicioSearch(): void {
    this.servicioSearchTouched = false;
    this.lastServicioTerm = '';
    this.servicioSearchValue = '';
  }

  private syncServicioSearchSelection(): void {
    if (this.servicioSearchTouched) return;
    const cod = (this.detalleForm?.codServicio || '').toString().trim();
    if (!cod) {
      this.servicioSearchValue = '';
      return;
    }
    const match = (this.servicios || []).find((item) => item.CodServicio === cod);
    this.servicioSearchValue = match ?? cod;
  }

  private filterServicios(term: string): ServicioPrecioApiItem[] {
    const query = (term ?? '').toString().trim().toLowerCase();
    const list = this.servicios ?? [];
    if (!query) return list;
    return list.filter((item) => {
      const cod = (item?.CodServicio || '').toString().toLowerCase();
      const nom = (item?.NomServicio || '').toString().toLowerCase();
      return cod.includes(query) || nom.includes(query);
    });
  }

  servicioResultFormatter = (item: ServicioPrecioApiItem): string =>
    `${item?.CodServicio || ''} - ${item?.NomServicio || ''}`.trim();

  servicioInputFormatter = (value: ServicioPrecioApiItem | string | null): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return this.servicioResultFormatter(value);
  }
}
