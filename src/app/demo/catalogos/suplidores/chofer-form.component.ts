import { Component, Input, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ChoferSuplidorService, ChoferSuplidorUI } from './chofer-suplidor.service';

@Component({
  selector: 'app-chofer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule],
  templateUrl: './chofer-form.component.html',
  styleUrls: ['./chofer-form.component.scss']
})
export class ChoferFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private choferService = inject(ChoferSuplidorService);

  @Input() codSuplidor!: string;
  @Input() chofer: ChoferSuplidorUI | null = null;
  @Output() close = new EventEmitter<boolean>();

  isEdit = false;
  isLoading = false;

  form = this.fb.group({
    codigo: [''],
    nombre: ['', Validators.required],
    tipoLicencia: ['', Validators.required],
    telefono: [''],
    email: ['', [Validators.email]],
    observaciones: [''],
    estado: ['ACT', Validators.required]
  });

  ngOnInit(): void {
    if (!this.codSuplidor) {
      console.error('codSuplidor es requerido');
      this.cancelar();
      return;
    }

    if (this.chofer) {
      this.isEdit = true;
      this.form.patchValue({
        codigo: this.chofer.codigo,
        nombre: this.chofer.nombre,
        tipoLicencia: this.chofer.tipoLicencia,
        telefono: this.chofer.telefono,
        email: this.chofer.email,
        observaciones: this.chofer.observaciones,
        estado: this.chofer.estado
      });
    }
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Swal.fire({
        title: 'Formulario incompleto',
        text: 'Por favor complete todos los campos requeridos.',
        icon: 'warning'
      });
      return;
    }

    this.isLoading = true;
    const formValue = this.form.value;

    const choferData: Partial<ChoferSuplidorUI> = {
      codigo: formValue.codigo || '',
      codSuplidor: this.codSuplidor,
      nombre: formValue.nombre || '',
      tipoLicencia: formValue.tipoLicencia || '',
      telefono: formValue.telefono || '',
      email: formValue.email || '',
      observaciones: formValue.observaciones || '',
      estado: formValue.estado || 'ACT'
    };

    const payload = this.choferService.buildPayloadFromUI(choferData, this.isEdit ? 2 : 1);

    const request = this.isEdit
      ? this.choferService.editarChofer(this.chofer!.codigo, payload)
      : this.choferService.crearChofer(payload);

    request.subscribe({
      next: () => {
        Swal.fire({
          title: 'Éxito',
          text: `Chofer ${this.isEdit ? 'actualizado' : 'creado'} correctamente.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        this.close.emit(true);
      },
      error: (error) => {
        console.error('Error al guardar chofer:', error);
        Swal.fire({
          title: 'Error',
          text: `No se pudo ${this.isEdit ? 'actualizar' : 'crear'} el chofer.`,
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  cancelar(): void {
    this.close.emit(false);
  }
}
