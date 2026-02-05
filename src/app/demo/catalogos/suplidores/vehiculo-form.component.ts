import { Component, Input, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { VehiculoSuplidorService, VehiculoSuplidorUI } from './vehiculo-suplidor.service';

@Component({
  selector: 'app-vehiculo-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule],
  templateUrl: './vehiculo-form.component.html',
  styleUrls: ['./vehiculo-form.component.scss']
})
export class VehiculoFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vehiculoService = inject(VehiculoSuplidorService);

  @Input() codSuplidor!: string;
  @Input() vehiculo: VehiculoSuplidorUI | null = null;
  @Output() close = new EventEmitter<boolean>();

  isEdit = false;
  isLoading = false;

  form = this.fb.group({
    codigo: [''],
    descripcion: ['', Validators.required],
    placa: ['', Validators.required],
    capacidad: [0, [Validators.required, Validators.min(1)]],
    tipoVehiculo: [''],
    observaciones: [''],
    estado: ['ACT', Validators.required]
  });

  tiposVehiculo = [
    { value: 'VAN', label: 'Van' },
    { value: 'BUS', label: 'Bus' },
    { value: 'MINIBUS', label: 'Minibus' },
    { value: 'COASTER', label: 'Coaster' },
    { value: 'SEDAN', label: 'Sedán' },
    { value: 'SUV', label: 'SUV' },
    { value: 'PICKUP', label: 'Pick-up' }
  ];

  ngOnInit(): void {
    if (!this.codSuplidor) {
      console.error('codSuplidor es requerido');
      this.cancelar();
      return;
    }

    if (this.vehiculo) {
      this.isEdit = true;
      this.form.patchValue({
        codigo: this.vehiculo.codigo,
        descripcion: this.vehiculo.descripcion,
        placa: this.vehiculo.placa,
        capacidad: this.vehiculo.capacidad,
        tipoVehiculo: this.vehiculo.tipoVehiculo,
        observaciones: this.vehiculo.observaciones,
        estado: this.vehiculo.estado
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

    const vehiculoData: Partial<VehiculoSuplidorUI> = {
      codigo: formValue.codigo || '',
      codSuplidor: this.codSuplidor,
      descripcion: formValue.descripcion || '',
      placa: formValue.placa || '',
      capacidad: formValue.capacidad || 0,
      tipoVehiculo: formValue.tipoVehiculo || '',
      observaciones: formValue.observaciones || '',
      estado: formValue.estado || 'ACT'
    };

    const payload = this.vehiculoService.buildPayloadFromUI(vehiculoData, this.isEdit ? 2 : 1);

    const request = this.isEdit
      ? this.vehiculoService.editarVehiculo(this.vehiculo!.codigo, payload)
      : this.vehiculoService.crearVehiculo(payload);

    request.subscribe({
      next: () => {
        Swal.fire({
          title: 'Éxito',
          text: `Vehículo ${this.isEdit ? 'actualizado' : 'creado'} correctamente.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        this.close.emit(true);
      },
      error: (error) => {
        console.error('Error al guardar vehículo:', error);
        Swal.fire({
          title: 'Error',
          text: `No se pudo ${this.isEdit ? 'actualizar' : 'crear'} el vehículo.`,
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
