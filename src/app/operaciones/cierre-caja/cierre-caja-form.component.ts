import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormArray, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { FormaPago } from 'src/app/demo/administracion/forma-pago/forma-pago.models';
import { FormaPagoService } from 'src/app/demo/administracion/forma-pago/forma-pago.service';
import { PuntoVentaUI } from 'src/app/demo/administracion/usuarios/usuario.models';
import { UsuarioService } from 'src/app/demo/administracion/usuarios/usuario.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { CierreCajaService } from './cierre-caja.service';
import {
  CierreCajaLinea,
  CierreCajaRecord,
  CierreCajaUpsertInput,
  Denominacion,
  DenominacionResumen,
  EjecutarCierrePayload,
  TmpFormaPago
} from './models/cierre-caja.model';

interface CierreCajaLineaFormValue {
  orden: number;
  frmPago: string;
  descripcion: string;
  tipoPago: string;
  montoSistema: number;
  montoDeclarado: number;
}

@Component({
  selector: 'app-cierre-caja-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './cierre-caja-form.component.html',
  styleUrls: ['./cierre-caja-form.component.scss']
})
export class CierreCajaFormComponent implements OnInit, OnDestroy {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  get baseRoute(): string {
    if (this.router.url.startsWith('/restaurante/cierre-caja')) {
      return '/restaurante/cierre-caja';
    }
    if (this.router.url.startsWith('/front-desk/cierre-caja')) {
      return '/front-desk/cierre-caja';
    }
    return '/operaciones/cierre-caja';
  }
  private readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly formaPagoService = inject(FormaPagoService);
  private readonly cierreCajaService = inject(CierreCajaService);

  readonly form = this.fb.group({
    usuario         : this.fb.control(''),
    operador        : this.fb.control(''),
    fecha           : this.fb.control(this.getTodayIsoDate(), Validators.required),
    pntVenta        : this.fb.control('', Validators.required),
    caja            : this.fb.control('Caja Principal', Validators.required),
    turno           : this.fb.control('1', Validators.required),
    horaApertura    : this.fb.control(this.getCurrentTime(), Validators.required),
    horaCierre      : this.fb.control(''),
    montoApertura   : this.fb.control(0, [Validators.required, Validators.min(0)]),
    observaciones   : this.fb.control(''),
    lineas          : this.fb.array<FormGroup>([])
  });

  puntosVenta: PuntoVentaUI[] = [];
  formasPago: FormaPago[] = [];
  recordId = '';
  isLoading = false;
  isSubmitting = false;
  isClosed = false;
  currentUsuario = '';
  denominaciones: Denominacion[] = [];
  denominacionesResumen: DenominacionResumen | null = null;
  denominacionesError = '';
  isLoadingDenominaciones = false;
  isSavingDenominaciones = false;
  private denominacionesSaveTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private savingDenominacionesIds = new Set<number>();
  private pendingDenominacionesIds = new Set<number>();
  tmpFormasPago: TmpFormaPago[] = [];
  tmpFormasPagoError = '';
  isLoadingTmpFormasPago = false;
  isSavingTmpFormasPago = false;
  private tmpFormaPagoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private savingTmpFormaPagoKeys = new Set<string>();
  private pendingTmpFormaPagoKeys = new Set<string>();
  private tmpFormaPagoInputValues = new Map<string, string>();

  get lineasArray(): FormArray<FormGroup> {
    return this.form.controls.lineas;
  }

  get isNew(): boolean {
    return !this.recordId;
  }

  get showCierreSections(): boolean {
    return !this.isNew;
  }

  get totalSistema(): number {
    return this.round(this.getLineasValue().reduce((sum, item) => sum + this.toNumber(item.montoSistema), 0));
  }

  get totalDeclarado(): number {
    if (this.tmpFormasPago.length > 0) {
      return this.round(this.tmpFormasPago.reduce((sum, item) => sum + this.toNumber(item.total), 0));
    }
    return this.round(this.getLineasValue().reduce((sum, item) => sum + this.toNumber(item.montoDeclarado), 0));
  }

  get diferenciaTotal(): number {
    return this.round(this.totalDeclarado - this.totalSistema);
  }

  get totalDenominacionMN(): number {
    return this.round(this.denominaciones.reduce((sum, item) => sum + this.toNumber(item.totalMN), 0));
  }

  get totalDenominacionME(): number {
    return this.round(this.denominaciones.reduce((sum, item) => sum + this.toNumber(item.totalME), 0));
  }

  get totalDenominaciones(): number {
    return this.round(this.totalDenominacionMN + this.totalDenominacionME);
  }

  get denominacionesColones(): Denominacion[] {
    return this.denominaciones.filter((item) => item.mon === 'COL');
  }

  get denominacionesDolares(): Denominacion[] {
    return this.denominaciones.filter((item) => item.mon !== 'COL');
  }

  get tmpFormasPagoColones(): TmpFormaPago[] {
    return this.tmpFormasPago.filter((item) => item.moneda === 'COL');
  }

  get tmpFormasPagoDolares(): TmpFormaPago[] {
    return this.tmpFormasPago.filter((item) => item.moneda !== 'COL');
  }

  get totalTmpFormaPagoColones(): number {
    return this.round(this.tmpFormasPagoColones.reduce((sum, item) => sum + this.toNumber(item.total), 0));
  }

  get totalTmpFormaPagoDolares(): number {
    return this.round(this.tmpFormasPagoDolares.reduce((sum, item) => sum + this.toNumber(item.total), 0));
  }

  ngOnInit(): void {
    void this.initialize();
  }

  ngOnDestroy(): void {
    this.denominacionesSaveTimers.forEach((timer) => clearTimeout(timer));
    this.denominacionesSaveTimers.clear();
    this.tmpFormaPagoSaveTimers.forEach((timer) => clearTimeout(timer));
    this.tmpFormaPagoSaveTimers.clear();
  }

  async guardarApertura(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    const result = await Swal.fire({
      title: 'Registrar apertura',
      text: 'Se creará una nueva apertura de caja para este turno.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) {
      return;
    }

    this.isSubmitting = true;
    try {
      const record = await firstValueFrom(this.cierreCajaService.create(this.buildPayload('ABIERTO')));
      await Swal.fire({
        title: 'Apertura registrada',
        text: 'La caja quedó abierta y lista para completar el cierre.',
        icon: 'success'
      });
      await this.router.navigate([this.baseRoute, record.id]);
    } catch (error) {
      console.error('Error creando apertura de caja', error);
      await Swal.fire({
        title: 'Error',
        text: 'No se pudo registrar la apertura de caja.',
        icon: 'error'
      });
    } finally {
      this.isSubmitting = false;
    }
  }

  async guardarAvance(): Promise<void> {
    if (!this.recordId || this.isClosed || !this.validateForm()) {
      return;
    }

    this.isSubmitting = true;
    try {
      await firstValueFrom(this.cierreCajaService.update(this.recordId, this.buildPayload('ABIERTO')));
      await Swal.fire({
        title: 'Avance guardado',
        text: 'El cierre de caja quedó actualizado.',
        icon: 'success',
        timer: 1400,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error actualizando cierre de caja', error);
      await Swal.fire({
        title: 'Error',
        text: 'No se pudo guardar el avance del cierre.',
        icon: 'error'
      });
    } finally {
      this.isSubmitting = false;
    }
  }

  async cerrarCaja(): Promise<void> {
    if (!this.recordId || this.isClosed || !this.validateForm()) {
      return;
    }

    const cierrePayload = this.buildEjecutarCierrePayload();
    const result = await Swal.fire({
      title: 'Confirmar cierre',
      text: 'Se ejecutará el cierre de caja definitivo para este turno. ¿Desea continuar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, ejecutar cierre',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) {
      return;
    }

    this.form.controls.horaCierre.setValue(this.getCurrentTime());
    this.isSubmitting = true;

    try {
      console.log('POST http://localhost:5000/api/ejecutar-cierre payload', cierrePayload);
      const cierreResponse = await firstValueFrom(this.cierreCajaService.ejecutarCierre(cierrePayload));
      console.log('POST http://localhost:5000/api/ejecutar-cierre response', cierreResponse);
      const numCierre = this.extractNumCierre(cierreResponse);
      await firstValueFrom(this.cierreCajaService.close(this.recordId, this.buildPayload('CERRADO')));
      this.isClosed = true;
      this.form.disable({ emitEvent: false });
      await Swal.fire({
        title: 'Caja cerrada',
        text: numCierre ? `El cierre ${numCierre} fue generado correctamente.` : 'El turno quedó cerrado correctamente.',
        icon: 'success'
      });
      await this.router.navigate([this.baseRoute]);
    } catch (error) {
      console.error('Error cerrando caja', error);
      await Swal.fire({
        title: 'Error',
        text: 'No se pudo cerrar la caja.',
        icon: 'error'
      });
    } finally {
      this.isSubmitting = false;
    }
  }

  cancelar(): void {
    void this.router.navigate([this.baseRoute]);
  }

  getLineDifference(index: number): number {
    const group = this.lineasArray.at(index);
    const montoSistema = this.toNumber(group.get('montoSistema')?.value);
    const montoDeclarado = this.toNumber(group.get('montoDeclarado')?.value);
    return this.round(montoDeclarado - montoSistema);
  }

  trackDenominacion(_index: number, item: Denominacion): number {
    return item.orden;
  }

  trackTmpFormaPago(_index: number, item: TmpFormaPago): string {
    return `${item.frmPago}-${item.moneda}`;
  }

  formatNumberInput(value: unknown, decimals = 2): string {
    return this.toNumber(value).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  formatMontoAperturaInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = this.round(this.toNumber(input.value));
    input.value = this.formatNumberInput(value, 2);
    this.form.controls.montoApertura.setValue(value, { emitEvent: false });
  }

  getTmpFormaPagoInputValue(item: TmpFormaPago): string {
    const key = this.getTmpFormaPagoKey(item);
    return this.tmpFormaPagoInputValues.get(key) ?? this.formatNumberInput(item.total, 2);
  }

  async inicializarDenominaciones(): Promise<void> {
    if (this.isClosed) {
      return;
    }

    const result = await Swal.fire({
      title: 'Inicializar denominaciones',
      text: 'Se preparará la tabla temporal para capturar el conteo físico.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, inicializar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) {
      return;
    }

    this.isLoadingDenominaciones = true;
    this.denominacionesError = '';
    try {
      await firstValueFrom(this.cierreCajaService.inicializarDenominaciones());
      await this.loadDenominaciones();
      await Swal.fire({
        title: 'Denominaciones listas',
        text: 'La tabla temporal quedó inicializada.',
        icon: 'success',
        timer: 1400,
        showConfirmButton: false
      });
    } catch (error) {
      this.denominacionesError = this.getErrorMessage(error, 'No se pudieron inicializar las denominaciones.');
      await Swal.fire({
        title: 'Error',
        text: this.denominacionesError,
        icon: 'error'
      });
    } finally {
      this.isLoadingDenominaciones = false;
    }
  }

  updateDenominacionCantidad(item: Denominacion, event: Event): void {
    const input = event.target as HTMLInputElement;
    item.cantidad = Math.max(0, this.toNumber(input.value));
    const total = this.round(item.valor * item.cantidad);
    item.totalMN = item.mp === 1 || item.mon === 'COL' ? total : 0;
    item.totalME = item.mp === 0 || item.mon !== 'COL' ? total : 0;
    this.scheduleDenominacionSave(item);
  }

  formatDenominacionCantidadInput(item: Denominacion, event: Event): void {
    const input = event.target as HTMLInputElement;
    item.cantidad = Math.max(0, Math.trunc(this.toNumber(input.value)));
    input.value = this.formatNumberInput(item.cantidad, 0);
    const total = this.round(item.valor * item.cantidad);
    item.totalMN = item.mp === 1 || item.mon === 'COL' ? total : 0;
    item.totalME = item.mp === 0 || item.mon !== 'COL' ? total : 0;
    this.scheduleDenominacionSave(item);
  }

  private scheduleDenominacionSave(item: Denominacion): void {
    if (this.isClosed || !item) {
      return;
    }

    this.denominacionesError = '';
    const existingTimer = this.denominacionesSaveTimers.get(item.orden);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.denominacionesSaveTimers.delete(item.orden);
      void this.persistDenominacion(item);
    }, 650);
    this.denominacionesSaveTimers.set(item.orden, timer);
  }

  private async persistDenominacion(item: Denominacion): Promise<void> {
    if (this.isClosed || !item) {
      return;
    }

    if (this.savingDenominacionesIds.has(item.orden)) {
      this.pendingDenominacionesIds.add(item.orden);
      return;
    }

    this.savingDenominacionesIds.add(item.orden);
    this.isSavingDenominaciones = this.savingDenominacionesIds.size > 0;
    this.denominacionesError = '';
    try {
      const payload = [{
        id: item.orden,
        cantidad: this.toNumber(item.cantidad),
        monPrincip: this.toNumber(item.mp)
      }];
      console.log('POST https://localhost:7206/api/denominacion/batch payload', payload);
      const response = await firstValueFrom(this.cierreCajaService.updateDenominacionesBatch(payload));
      console.log('POST https://localhost:7206/api/denominacion/batch response', response);
    } catch (error) {
      this.denominacionesError = this.getErrorMessage(error, 'No se pudieron guardar las denominaciones.');
    } finally {
      this.savingDenominacionesIds.delete(item.orden);
      this.isSavingDenominaciones = this.savingDenominacionesIds.size > 0;
      if (this.pendingDenominacionesIds.has(item.orden)) {
        this.pendingDenominacionesIds.delete(item.orden);
        void this.persistDenominacion(item);
      }
    }
  }

  updateTmpFormaPagoTotal(item: TmpFormaPago, event: Event): void {
    const input = event.target as HTMLInputElement;
    const formattedValue = this.formatDecimalTypingInput(input.value, 2);
    input.value = formattedValue;
    this.tmpFormaPagoInputValues.set(this.getTmpFormaPagoKey(item), formattedValue);
    item.total = Math.max(0, this.toNumber(formattedValue));
    this.syncLineasFromTmpFormasPago();
    this.scheduleTmpFormaPagoSave(item);
  }

  formatTmpFormaPagoTotalInput(item: TmpFormaPago, event: Event): void {
    const input = event.target as HTMLInputElement;
    item.total = this.round(Math.max(0, this.toNumber(input.value)));
    const formattedValue = this.formatNumberInput(item.total, 2);
    input.value = formattedValue;
    this.tmpFormaPagoInputValues.set(this.getTmpFormaPagoKey(item), formattedValue);
    this.syncLineasFromTmpFormasPago();
    this.scheduleTmpFormaPagoSave(item);
  }

  private scheduleTmpFormaPagoSave(item: TmpFormaPago): void {
    if (this.isClosed || !item) {
      return;
    }

    this.tmpFormasPagoError = '';
    const key = this.getTmpFormaPagoKey(item);
    const existingTimer = this.tmpFormaPagoSaveTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.tmpFormaPagoSaveTimers.delete(key);
      void this.persistTmpFormaPago(item);
    }, 650);
    this.tmpFormaPagoSaveTimers.set(key, timer);
  }

  private async persistTmpFormaPago(item: TmpFormaPago): Promise<void> {
    if (this.isClosed || !item) {
      return;
    }

    const key = this.getTmpFormaPagoKey(item);
    if (this.savingTmpFormaPagoKeys.has(key)) {
      this.pendingTmpFormaPagoKeys.add(key);
      return;
    }

    this.savingTmpFormaPagoKeys.add(key);
    this.isSavingTmpFormasPago = this.savingTmpFormaPagoKeys.size > 0;
    this.tmpFormasPagoError = '';
    try {
      const payload = {
        proceso: 0,
        codFrmPago: item.frmPago,
        moneda: item.moneda,
        valor: this.toNumber(item.total),
        operador: this.currentUsuario,
        respuesta: ''
      };
      const response = await firstValueFrom(this.cierreCajaService.actualizarTmpFormaPago(payload));
      console.log('PUT http://localhost:5000/api/tmpformapago/actualizar payload', payload);
      console.log('PUT http://localhost:5000/api/tmpformapago/actualizar response', response);
    } catch (error) {
      this.tmpFormasPagoError = this.getErrorMessage(error, 'No se pudo guardar la forma de pago.');
    } finally {
      this.savingTmpFormaPagoKeys.delete(key);
      this.isSavingTmpFormasPago = this.savingTmpFormaPagoKeys.size > 0;
      if (this.pendingTmpFormaPagoKeys.has(key)) {
        this.pendingTmpFormaPagoKeys.delete(key);
        void this.persistTmpFormaPago(item);
      }
    }
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;

    try {
      const user = this.authService.getCurrentUser();
      this.currentUsuario = String(user?.usuario ?? '').trim();

      this.form.patchValue({
        usuario: this.currentUsuario,
        operador: this.currentUsuario
      });

      const puntosVenta$ = this.usuarioService.getPuntosVenta().pipe(catchError(() => of([] as PuntoVentaUI[])));
      const formasPago$ = this.formaPagoService.getAll().pipe(catchError(() => of([] as FormaPago[])));

      const { puntosVenta, formasPago } = await firstValueFrom(
        forkJoin({
          puntosVenta: puntosVenta$,
          formasPago: formasPago$
        })
      );

      this.applyPuntosVentaCatalogo((puntosVenta ?? []).filter((item) => !!item.codigo));
      this.formasPago = [...(formasPago ?? [])].sort((a, b) => a.orden - b.orden);

      const recordId = String(this.route.snapshot.paramMap.get('id') ?? '').trim();
      if (recordId) {
        await this.loadRecord(recordId);
      } else {
        const shouldContinue = await this.handleExistingOpenRecord();
        if (shouldContinue) {
          return;
        }
        this.resetLineas(this.formasPago);
        this.syncPuntoVentaDefault();
      }

      if (!this.isNew) {
        await this.initializeTmpFormasPago();
      }
    } finally {
      this.isLoading = false;
    }
  }

  private async handleExistingOpenRecord(): Promise<boolean> {
    if (!this.currentUsuario) {
      return false;
    }

    const existing = await firstValueFrom(this.cierreCajaService.findOpenByUsuario(this.currentUsuario));
    if (!existing) {
      return false;
    }

    const result = await Swal.fire({
      title: 'Ya existe una caja abierta',
      text: `El usuario ${this.currentUsuario} ya tiene un cierre en estado ABIERTO.`,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Ir al cierre abierto',
      cancelButtonText: 'Crear otro'
    });

    if (result.isConfirmed) {
      await this.router.navigate([this.baseRoute, existing.id]);
      return true;
    }

    return false;
  }

  private async loadRecord(id: string): Promise<void> {
    const record = await firstValueFrom(this.cierreCajaService.getById(id));
    if (!record) {
      await Swal.fire({
        title: 'Registro no encontrado',
        text: 'No se encontró el cierre de caja solicitado.',
        icon: 'warning'
      });
      await this.router.navigate([this.baseRoute]);
      return;
    }

    this.recordId = record.id;
    this.patchForm(record);
    this.isClosed = record.estado === 'CERRADO';

    if (this.isClosed) {
      this.form.disable({ emitEvent: false });
    }

    await this.loadDenominaciones();
  }

  private patchForm(record: CierreCajaRecord): void {
    this.form.patchValue({
      usuario: record.usuario,
      operador: record.operador,
      fecha: record.fecha,
      pntVenta: record.pntVenta,
      caja: record.caja,
      turno: record.turno,
      horaApertura: record.horaApertura,
      horaCierre: record.horaCierre,
      montoApertura: record.montoApertura,
      observaciones: record.observaciones
    });
    this.resetLineasFromRecord(record.lineas);
    this.syncPuntoVentaDefault();
  }

  private applyPuntosVentaCatalogo(puntosVenta: PuntoVentaUI[]): void {
    this.puntosVenta = [...puntosVenta].sort((a, b) => a.orden - b.orden);
    this.syncPuntoVentaDefault();
  }

  private syncPuntoVentaDefault(): void {
    const current = this.form.controls.pntVenta.value;
    const exists = this.puntosVenta.some((item) => item.codigo === current);
    if (!current || !exists) {
      this.form.controls.pntVenta.setValue(this.puntosVenta[0]?.codigo ?? '', { emitEvent: false });
    }
  }

  private resetLineas(formasPago: FormaPago[]): void {
    this.lineasArray.clear();
    formasPago.forEach((item, index) => {
      this.lineasArray.push(this.createLineaGroup({
        orden: index + 1,
        frmPago: item.codigo,
        descripcion: item.descripcion,
        tipoPago: item.tipoPago,
        montoSistema: 0,
        montoDeclarado: 0,
        diferencia: 0
      }));
    });
  }

  private resetLineasFromRecord(lineas: CierreCajaLinea[]): void {
    this.lineasArray.clear();
    (lineas ?? []).forEach((item) => {
      this.lineasArray.push(this.createLineaGroup(item));
    });
  }

  private createLineaGroup(linea: CierreCajaLinea): FormGroup {
    return this.fb.group({
      orden: this.fb.control(linea.orden),
      frmPago: this.fb.control(linea.frmPago),
      descripcion: this.fb.control(linea.descripcion),
      tipoPago: this.fb.control(linea.tipoPago),
      montoSistema: this.fb.control(this.toNumber(linea.montoSistema), [Validators.required, Validators.min(0)]),
      montoDeclarado: this.fb.control(this.toNumber(linea.montoDeclarado), [Validators.required, Validators.min(0)])
    });
  }

  private buildPayload(estado: 'ABIERTO' | 'CERRADO'): CierreCajaUpsertInput {
    const value = this.form.getRawValue();
    return {
      usuario: value.usuario,
      operador: value.operador || value.usuario,
      pntVenta: value.pntVenta,
      caja: value.caja,
      turno: value.turno,
      fecha: value.fecha,
      horaApertura: value.horaApertura,
      horaCierre: value.horaCierre,
      montoApertura: this.toNumber(value.montoApertura),
      estado,
      observaciones: value.observaciones,
      lineas: this.getLineasValue().map((item, index) => ({
        orden: index + 1,
        frmPago: String(item.frmPago ?? '').trim(),
        descripcion: String(item.descripcion ?? '').trim(),
        tipoPago: String(item.tipoPago ?? '').trim(),
        montoSistema: this.toNumber(item.montoSistema),
        montoDeclarado: this.toNumber(item.montoDeclarado),
        diferencia: this.round(this.toNumber(item.montoDeclarado) - this.toNumber(item.montoSistema))
      }))
    };
  }

  private getLineasValue(): CierreCajaLineaFormValue[] {
    return this.lineasArray.getRawValue() as CierreCajaLineaFormValue[];
  }

  private buildEjecutarCierrePayload(): EjecutarCierrePayload {
    const value = this.form.getRawValue();
    const usuario = String(value.usuario || this.currentUsuario).trim().toUpperCase();
    const operador = String(value.operador || value.usuario || this.currentUsuario).trim();
    const fecha = this.formatDateForCierre(value.fecha);

    return {
      nomTabla: `TMPDMO${this.toPascalCase(operador)}`,
      fechaIng: fecha,
      pntVenta: String(value.pntVenta ?? '').trim(),
      fechaCie: fecha,
      concepto: 'CIERRE DE CAJA',
      fondo: this.toNumber(value.montoApertura),
      usuario,
      usuCierre: usuario,
      respuesta: ''
    };
  }

  private extractNumCierre(response: unknown): string {
    if (response == null) {
      return '';
    }
    if (typeof response === 'number' || typeof response === 'string') {
      return String(response);
    }
    if (typeof response === 'object') {
      const raw = response as any;
      return String(raw.NUMCIERRE ?? raw.numCierre ?? raw.NumCierre ?? raw.data?.NUMCIERRE ?? raw.data?.numCierre ?? '').trim();
    }
    return '';
  }

  private validateForm(): boolean {
    if (this.form.valid) {
      return true;
    }

    this.form.markAllAsTouched();
    void Swal.fire({
      title: 'Validación',
      text: 'Complete los campos requeridos para continuar.',
      icon: 'warning'
    });
    return false;
  }

  private async loadDenominaciones(): Promise<void> {
    this.isLoadingDenominaciones = true;
    this.denominacionesError = '';
    try {
      const resumen = await firstValueFrom(this.cierreCajaService.getDenominacionesResumen());
      this.denominacionesResumen = resumen;
      this.denominaciones = resumen.denominaciones;

      if (this.denominaciones.length === 0) {
        this.denominaciones = await firstValueFrom(this.cierreCajaService.getDenominaciones());
      }
    } catch (error) {
      console.error('Error cargando denominaciones', error);
      this.denominacionesError = this.getErrorMessage(error, 'No se pudieron cargar las denominaciones.');
      this.denominaciones = [];
      this.denominacionesResumen = null;
    } finally {
      this.isLoadingDenominaciones = false;
    }
  }

  private async initializeTmpFormasPago(): Promise<void> {
    const operador = this.currentUsuario || this.form.controls.operador.value || this.form.controls.usuario.value;
    if (!operador) {
      this.tmpFormasPago = [];
      return;
    }

    this.isLoadingTmpFormasPago = true;
    this.tmpFormasPagoError = '';
    try {
      const payload = {
        proceso: 1,
        codFrmPago: '',
        moneda: '',
        valor: 0,
        operador,
        respuesta: ''
      };
      await firstValueFrom(this.cierreCajaService.crearTmpFormaPago(payload));
      await this.loadTmpFormasPago(operador);
    } catch (error) {
      console.error('Error inicializando formas de pago temporales', error);
      this.tmpFormasPagoError = this.getErrorMessage(error, 'No se pudieron preparar las formas de pago.');
      this.tmpFormasPago = [];
    } finally {
      this.isLoadingTmpFormasPago = false;
    }
  }

  private async loadTmpFormasPago(operador: string): Promise<void> {
    this.tmpFormasPago = await firstValueFrom(this.cierreCajaService.consultarTmpFormaPago(operador));
    this.syncTmpFormaPagoInputValues();
    this.syncLineasFromTmpFormasPago();
  }

  private syncLineasFromTmpFormasPago(): void {
    if (this.tmpFormasPago.length === 0) {
      return;
    }

    this.lineasArray.clear();
    this.tmpFormasPago.forEach((item, index) => {
      this.lineasArray.push(this.createLineaGroup({
        orden: index + 1,
        frmPago: item.frmPago,
        descripcion: `${item.descripcion} (${item.moneda})`,
        tipoPago: item.moneda,
        montoSistema: 0,
        montoDeclarado: this.toNumber(item.total),
        diferencia: this.toNumber(item.total)
      }));
    });
  }

  private getTmpFormaPagoKey(item: TmpFormaPago): string {
    return `${item.frmPago}-${item.moneda}`;
  }

  private syncTmpFormaPagoInputValues(): void {
    this.tmpFormaPagoInputValues.clear();
    this.tmpFormasPago.forEach((item) => {
      this.tmpFormaPagoInputValues.set(this.getTmpFormaPagoKey(item), this.formatNumberInput(item.total, 2));
    });
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  }

  private getTodayIsoDate(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private formatDateForCierre(value: string): string {
    const normalized = String(value ?? '').trim();
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return normalized;
  }

  private toPascalCase(value: string): string {
    const clean = String(value ?? '').trim().toLowerCase();
    return clean ? `${clean.charAt(0).toUpperCase()}${clean.slice(1)}` : '';
  }

  private getCurrentTime(): string {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private toNumber(value: unknown): number {
    const parsed = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private formatDecimalTypingInput(value: unknown, decimals: number): string {
    const raw = String(value ?? '').replace(/,/g, '').replace(/[^\d.]/g, '');
    if (!raw) {
      return '';
    }
    const firstDotIndex = raw.indexOf('.');
    const integerPartRaw = firstDotIndex >= 0 ? raw.slice(0, firstDotIndex) : raw;
    const decimalPartRaw = firstDotIndex >= 0 ? raw.slice(firstDotIndex + 1).replace(/\./g, '') : '';
    const integerPart = integerPartRaw.replace(/^0+(?=\d)/, '') || '0';
    const groupedInteger = Number(integerPart).toLocaleString('en-US', { maximumFractionDigits: 0 });

    if (firstDotIndex < 0) {
      return groupedInteger;
    }

    return `${groupedInteger}.${decimalPartRaw.slice(0, decimals)}`;
  }

  private round(value: number): number {
    return Math.round((this.toNumber(value) + Number.EPSILON) * 100) / 100;
  }
}
