import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { GooglePlaceSelection, GooglePlacesAutocompleteDirective } from './google-places-autocomplete.directive';
import { DetalleForm } from './reserva-create.models';
import { hasCoordinates, safeJsonStringify } from './reserva-create.utils';
import { ServicioUI } from '../catalogos/servicios/servicios.service';

@Component({
  selector: 'app-reserva-create-detalle-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, GooglePlacesAutocompleteDirective],
  templateUrl: './reserva-create-detalle-modal.component.html',
  styleUrls: ['./reserva-create-detalle-modal.component.scss']
})
export class ReservaCreateDetalleModalComponent implements OnChanges {
  @Input() open = false;
  @Input() editingDetalleId: number | null = null;
  @Input({ required: true }) detalleForm!: DetalleForm;
  @Input() tarifas: string[] = [];
  @Input() zonas: string[] = [];
  @Input() servicios: ServicioUI[] = [];
  @Input() serviciosLoading = false;
  @Input() reglaTarifaError = '';
  @Input() allowManualPricing = false;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();
  @Output() serviceChange = new EventEmitter<string>();
  @Output() recalculate = new EventEmitter<void>();

  origenAutocompleteMessage = '';
  destinoAutocompleteMessage = '';
  copiedLink: 'origen' | 'destino' | null = null;
  copyError = '';
  copyErrorTarget: 'origen' | 'destino' | null = null;
  locationInfoTarget: 'origen' | 'destino' | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    const openChange = changes['open'];
    if (openChange?.currentValue === true && openChange?.previousValue !== true) {
      this.resetAutocompleteState();
    }
  }

  onClose(): void {
    this.resetAutocompleteState();
    this.locationInfoTarget = null;
    this.close.emit();
  }

  onSubmit(formRef: any): void {
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

  onManualCostoChange(): void {
    if (!this.allowManualPricing) return;
    const neto = Number(this.detalleForm?.costoNeto ?? 0) || 0;
    this.detalleForm.montoServicio = neto;
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
}
