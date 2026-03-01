import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { catchError, finalize } from 'rxjs/operators';
import { EMPTY, of } from 'rxjs';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { LineaProducto } from './interfaces/LineaProducto.interface';
import { LineaProductoRequest } from './interfaces/LineaProductoRequest.interface';
import { LineaProductoService } from './linea-producto.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface LineaFiltroForm {
  lineaProdu: FormControl<string>;
}

interface LineaModalForm {
  codLinea: FormControl<string>;
  lineaProdu: FormControl<string>;
  orden: FormControl<number>;
  operador: FormControl<string>;
}

@Component({
  selector: 'app-linea-producto',
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './linea-producto.component.html',
  styleUrls: ['./linea-producto.component.scss']
})
export class LineaProductoComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly lineaService = inject(LineaProductoService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly filtroForm: FormGroup<LineaFiltroForm> = this.fb.group({
    lineaProdu: this.fb.control('')
  });

  readonly modalForm: FormGroup<LineaModalForm> = this.fb.group({
    codLinea: this.fb.control('', { validators: [Validators.required] }),
    lineaProdu: this.fb.control('', { validators: [Validators.required] }),
    orden: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
    operador: this.fb.control('', { validators: [Validators.required] })
  });

  lineas: LineaProducto[] = [];
  isLoading = false;
  isSaving = false;
  isDeleting = false;
  showModal = false;
  isEditing = false;
  errorMessage = '';

  ngOnInit(): void {
    this.setOperadorDefault();
    this.loadLineas();
  }

  onBuscar(): void {
    this.loadLineas();
  }

  onLimpiar(): void {
    this.filtroForm.reset({ lineaProdu: '' });
    this.loadLineas();
  }

  abrirModalCrear(): void {
    this.isEditing = false;
    this.modalForm.reset(
      {
        codLinea: '',
        lineaProdu: '',
        orden: 0,
        operador: this.getOperador()
      },
      { emitEvent: false }
    );
    this.modalForm.controls.codLinea.enable({ emitEvent: false });
    this.showModal = true;
  }

  abrirModalEditar(linea: LineaProducto): void {
    this.isEditing = true;
    this.modalForm.reset(
      {
        codLinea: linea.CAC02_CodLinea,
        lineaProdu: linea.CAC02_LineaProdu,
        orden: this.toNumber(linea.CAC02_Orden),
        operador: linea.CAC02_Operador || this.getOperador()
      },
      { emitEvent: false }
    );
    this.modalForm.controls.codLinea.disable({ emitEvent: false });
    this.showModal = true;
  }

  cerrarModal(): void {
    if (this.isSaving) {
      return;
    }
    this.showModal = false;
    this.modalForm.reset(
      {
        codLinea: '',
        lineaProdu: '',
        orden: 0,
        operador: this.getOperador()
      },
      { emitEvent: false }
    );
    this.modalForm.controls.codLinea.enable({ emitEvent: false });
  }

  guardarLinea(): void {
    if (this.modalForm.invalid) {
      this.modalForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.buildPayload();
    const action = this.isEditing
      ? this.lineaService.actualizarLinea(payload)
      : this.lineaService.crearLinea(payload);

    action
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar la linea.', error);
          return EMPTY;
        }),
        finalize(() => {
          this.isSaving = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        const message = this.isEditing ? 'Linea actualizada correctamente.' : 'Linea creada correctamente.';
        Swal.fire({
          title: 'Exito',
          text: message,
          icon: 'success'
        });
        this.cerrarModal();
        this.loadLineas();
      });
  }

  eliminarLinea(linea: LineaProducto): void {
    Swal.fire({
      title: 'Eliminar linea',
      text: `Desea eliminar la linea ${linea.CAC02_CodLinea}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.lineaService
        .eliminarLinea(linea.CAC02_CodLinea)
        .pipe(
          catchError((error) => {
            this.handleError('No se pudo eliminar la linea.', error);
            return EMPTY;
          }),
          finalize(() => {
            this.isDeleting = false;
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(() => {
          Swal.fire({
            title: 'Eliminado',
            text: 'Linea eliminada correctamente.',
            icon: 'success'
          });
          this.loadLineas();
        });
    });
  }

  isFieldInvalid(field: keyof LineaModalForm): boolean {
    const control = this.modalForm.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  get modalTitle(): string {
    return this.isEditing ? 'Editar Linea' : 'Nueva Linea';
  }

  get emptyMessage(): string {
    return this.isLoading ? 'Cargando lineas...' : 'No hay lineas para mostrar.';
  }

  private loadLineas(): void {
    const filtro = this.normalizeValue(this.filtroForm.getRawValue().lineaProdu);
    this.isLoading = true;
    this.errorMessage = '';

    this.lineaService
      .getLineas(filtro)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar las lineas.', error);
          return of([] as LineaProducto[]);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((lineas) => {
        this.lineas = lineas;
      });
  }

  private buildPayload(): LineaProductoRequest {
    const raw = this.modalForm.getRawValue();
    return {
      proceso: 0,
      codLinea: raw.codLinea.trim(),
      lineaProdu: raw.lineaProdu.trim(),
      orden: this.toNumber(raw.orden),
      operador: raw.operador.trim(),
      respuesta: ''
    };
  }

  private setOperadorDefault(): void {
    this.modalForm.controls.operador.setValue(this.getOperador(), { emitEvent: false });
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }

  private toNumber(value: number | string | null | undefined): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private normalizeValue(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private handleError(message: string, error: unknown): void {
    console.error(message, error);
    this.errorMessage = message;
    Swal.fire({
      title: 'Error',
      text: message,
      icon: 'error'
    });
  }
}
