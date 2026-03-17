import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
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
import { CierreCajaLinea, CierreCajaRecord, CierreCajaUpsertInput } from './models/cierre-caja.model';

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
export class CierreCajaFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly formaPagoService = inject(FormaPagoService);
  private readonly cierreCajaService = inject(CierreCajaService);

  readonly form = this.fb.group({
    usuario: this.fb.control(''),
    operador: this.fb.control(''),
    fecha: this.fb.control(this.getTodayIsoDate(), Validators.required),
    pntVenta: this.fb.control('', Validators.required),
    caja: this.fb.control('', Validators.required),
    turno: this.fb.control('', Validators.required),
    horaApertura: this.fb.control(this.getCurrentTime(), Validators.required),
    horaCierre: this.fb.control(''),
    montoApertura: this.fb.control(0, [Validators.required, Validators.min(0)]),
    observaciones: this.fb.control(''),
    lineas: this.fb.array<FormGroup>([])
  });

  puntosVenta: PuntoVentaUI[] = [];
  formasPago: FormaPago[] = [];
  recordId = '';
  isLoading = false;
  isSubmitting = false;
  isClosed = false;
  currentUsuario = '';

  get lineasArray(): FormArray<FormGroup> {
    return this.form.controls.lineas;
  }

  get isNew(): boolean {
    return !this.recordId;
  }

  get totalSistema(): number {
    return this.round(this.getLineasValue().reduce((sum, item) => sum + this.toNumber(item.montoSistema), 0));
  }

  get totalDeclarado(): number {
    return this.round(this.getLineasValue().reduce((sum, item) => sum + this.toNumber(item.montoDeclarado), 0));
  }

  get diferenciaTotal(): number {
    return this.round(this.totalDeclarado - this.totalSistema);
  }

  ngOnInit(): void {
    void this.initialize();
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
      await this.router.navigate(['/operaciones/cierre-caja', record.id]);
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

    const result = await Swal.fire({
      title: 'Cerrar caja',
      text: 'Esta acción marcará el turno como cerrado.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar caja',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) {
      return;
    }

    this.form.controls.horaCierre.setValue(this.getCurrentTime());
    this.isSubmitting = true;

    try {
      await firstValueFrom(this.cierreCajaService.close(this.recordId, this.buildPayload('CERRADO')));
      this.isClosed = true;
      this.form.disable({ emitEvent: false });
      await Swal.fire({
        title: 'Caja cerrada',
        text: 'El turno quedó cerrado correctamente.',
        icon: 'success'
      });
      await this.router.navigate(['/operaciones/cierre-caja']);
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
    void this.router.navigate(['/operaciones/cierre-caja']);
  }

  getLineDifference(index: number): number {
    const group = this.lineasArray.at(index);
    const montoSistema = this.toNumber(group.get('montoSistema')?.value);
    const montoDeclarado = this.toNumber(group.get('montoDeclarado')?.value);
    return this.round(montoDeclarado - montoSistema);
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

      const puntosVenta$ = (this.currentUsuario
        ? this.usuarioService.getPuntosVentaUsuario(this.currentUsuario)
        : this.usuarioService.getPuntosVenta()
      ).pipe(catchError(() => of([] as PuntoVentaUI[])));

      const formasPago$ = this.formaPagoService.getAll().pipe(catchError(() => of([] as FormaPago[])));

      const { puntosVenta, formasPago } = await firstValueFrom(
        forkJoin({
          puntosVenta: puntosVenta$,
          formasPago: formasPago$
        })
      );

      this.puntosVenta = [...(puntosVenta ?? [])].sort((a, b) => a.orden - b.orden);
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
        if (!this.form.controls.pntVenta.value) {
          this.form.controls.pntVenta.setValue(this.puntosVenta[0]?.codigo ?? '');
        }
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
      await this.router.navigate(['/operaciones/cierre-caja', existing.id]);
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
      await this.router.navigate(['/operaciones/cierre-caja']);
      return;
    }

    this.recordId = record.id;
    this.patchForm(record);
    this.isClosed = record.estado === 'CERRADO';

    if (this.isClosed) {
      this.form.disable({ emitEvent: false });
    }
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

  private getTodayIsoDate(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private getCurrentTime(): string {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round(value: number): number {
    return Math.round((this.toNumber(value) + Number.EPSILON) * 100) / 100;
  }
}
