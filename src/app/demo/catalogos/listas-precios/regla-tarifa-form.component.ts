// angular import
import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ReglasTarifariasService, ReglaTarifa, ListaPrecio, Servicio } from './listas-precios.service';

@Component({
  selector: 'app-regla-tarifa-form',
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './regla-tarifa-form.component.html',
  styleUrls: ['./regla-tarifa-form.component.scss']
})
export class ReglaTarifaFormComponent implements OnInit, OnChanges {
  @Input() reglaTarifa: ReglaTarifa | null = null;
  @Input() listaPrecio: ListaPrecio | null = null;
  @Input() codLstPrecio: string = '';
  @Input() servicioId: string = '';
  @Input() servicios: Servicio[] = [];

  @Output() onSave = new EventEmitter<void>();
  @Output() onCancel = new EventEmitter<void>();

  formData: Partial<ReglaTarifa> = {};
  isSaving = false;
  saveError = '';

  private reglasService = inject(ReglasTarifariasService);

  ngOnInit() {
    this.initializeForm();
  }

  ngOnChanges(_: SimpleChanges) {
    this.initializeForm();
  }

  initializeForm() {
    const baseForm: Partial<ReglaTarifa> = this.reglaTarifa
      ? { ...this.reglaTarifa }
      : {
          listaPrecioId: this.listaPrecio?.id || 0,
          codLstPrecio: this.codLstPrecio || String(this.listaPrecio?.id || ''),
          servicioId: this.servicioId,
          codServicio: String(this.servicioId || ''),
          servicioNombre: this.getServicioNombre(),
          tarifa: 'A' as ReglaTarifa['tarifa'],
          horaInicio: '08:00',
          horaFin: '18:00',
          precioBase: 0,
          adultosIncluidos: 1,
          precioAdultoExtra: 0,
          precioNino: 0,
          cantMinPax: 1,
          cantMaxPax: 1,
          moneda: this.listaPrecio?.moneda || '',
          observaciones: '',
          activa: true
        };

    this.formData = {
      ...baseForm,
      listaPrecioId: this.listaPrecio?.id || baseForm.listaPrecioId || 0,
      codLstPrecio: this.codLstPrecio || baseForm.codLstPrecio || '',
      servicioId: this.servicioId,
      codServicio: String(this.servicioId || ''),
      moneda: this.listaPrecio?.moneda || baseForm.moneda || '',
      servicioNombre: this.getServicioNombre()
    };
  }

  getServicioNombre(): string {
    if (this.servicioId) {
      const servicio = this.servicios.find((item) => item.id === this.servicioId);
      return servicio?.nombre || '';
    }
    return '';
  }

  private syncContextFields() {
    this.formData.listaPrecioId = this.listaPrecio?.id || 0;
    this.formData.codLstPrecio = this.codLstPrecio || String(this.listaPrecio?.id || '');
    this.formData.servicioId = this.servicioId;
    this.formData.codServicio = String(this.servicioId || '');
    this.formData.moneda = this.listaPrecio?.moneda || this.formData.moneda || '';
    this.formData.servicioNombre = this.getServicioNombre();
  }

  save() {
    this.syncContextFields();
    if (this.validateForm()) {
      const cantMinPax = this.getCantMinPax();
      const cantMaxPax = this.getCantMaxPax();
      const payloadBase = {
        codLstPrecio: this.formData.codLstPrecio || '',
        codServicio: this.formData.codServicio || String(this.formData.servicioId || ''),
        tipoTarifa: this.reglasService.getTipoTarifaFromCodigo(this.formData.tarifa),
        cantMinPax,
        cantMaxPax,
        precioAdulto: Number(this.formData.precioBase),
        precioNino: Number(this.formData.precioNino ?? 0),
        precioPaxExtra: Number(this.formData.precioAdultoExtra ?? 0),
        horaDesde: this.formData.horaInicio || '',
        horaHasta: this.formData.horaFin || '',
        moneda: this.formData.moneda || this.listaPrecio?.moneda || '',
        observaciones: this.formData.observaciones?.trim() || '',
        activo: !!this.formData.activa
      };
      const tipo = this.reglaTarifa ? 2 : 1;
      const id = this.reglaTarifa?.id ?? 0;
      const payload = this.reglasService.buildPayload(payloadBase, tipo, id);
      this.isSaving = true;
      this.saveError = '';
      const request$ = this.reglaTarifa
        ? this.reglasService.updateDetalle(id, payload)
        : this.reglasService.createDetalle(payload);
      request$.subscribe({
        next: () => {
          this.isSaving = false;
          this.onSave.emit();
        },
        error: () => {
          this.isSaving = false;
          this.saveError = 'No se pudo guardar la regla tarifaria.';
        }
      });
    }
  }

  cancel() {
    this.onCancel.emit();
  }

  validateForm(): boolean {
    const cantMinPax = this.getCantMinPax();
    const cantMaxPax = this.getCantMaxPax();
    return !!(this.formData.codLstPrecio &&
             this.formData.servicioId &&
             this.formData.tarifa &&
             this.formData.horaInicio &&
             this.formData.horaFin &&
             this.formData.precioBase !== undefined && this.formData.precioBase > 0 &&
             this.formData.adultosIncluidos !== undefined && this.formData.adultosIncluidos > 0 &&
             this.formData.precioAdultoExtra !== undefined && this.formData.precioAdultoExtra >= 0 &&
             this.formData.precioNino !== undefined && this.formData.precioNino >= 0 &&
             cantMinPax <= cantMaxPax &&
             this.isValidTimeRange());
  }

  isValidTimeRange(): boolean {
    if (!this.formData.horaInicio || !this.formData.horaFin) {
      return false;
    }
    return this.formData.horaFin > this.formData.horaInicio;
  }

  hasTimeRangeError(): boolean {
    return !!(this.formData.horaInicio && this.formData.horaFin &&
             this.formData.horaFin <= this.formData.horaInicio);
  }

  private getCantMinPax(): number {
    const adultosIncluidos = Number(this.formData.adultosIncluidos ?? 0);
    if (adultosIncluidos > 0) {
      return adultosIncluidos;
    }
    return Number(this.formData.cantMinPax ?? 0);
  }

  private getCantMaxPax(): number {
    const adultosIncluidos = Number(this.formData.adultosIncluidos ?? 0);
    if (adultosIncluidos > 0) {
      return adultosIncluidos;
    }
    return Number(this.formData.cantMaxPax ?? 0);
  }
}
