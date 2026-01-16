import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ActividadComercialService } from './actividad-comercial.service';
import { ActividadDto, ActividadPost } from './actividad-comercial.models';

@Component({
  selector: 'actividad-comercial',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './actividad-comercial.component.html',
  styleUrls: ['./actividad-comercial.component.scss']
})
export class ActividadComercialComponent implements OnChanges {
  @Input() cedula = '';
  @Output() principalChange = new EventEmitter<ActividadDto>();

  form: FormGroup;
  actividades: ActividadDto[] = [];
  isLoading = false;

  constructor(private fb: FormBuilder, private actividadService: ActividadComercialService) {
    this.form = this.fb.group({
      codigoAMH: ['', [Validators.required]],
      descripcion: ['', [Validators.required]],
      principal: [false]
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cedula']) {
      const value = (this.cedula || '').trim();
      if (value) {
        this.loadActividades(value);
      } else {
        this.actividades = [];
      }
    }
  }

  loadActividades(cedula: string): void {
    if (!cedula) {
      this.actividades = [];
      return;
    }

    this.isLoading = true;
    this.actividadService
      .getActividades(cedula)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (data) => {
          this.actividades = data ?? [];
        },
        error: (error) => {
          console.error('Error al cargar actividades comerciales:', error);
          this.actividades = [];
        }
      });
  }

  addActividad(): void {
    if (!this.cedula || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const principal = raw.principal ? 1 : 0;
    const payload: ActividadPost = this.actividadService.buildPayload(
      {
        id: 0,
        cedula: this.cedula,
        codigoAMH: String(raw.codigoAMH || '').trim(),
        descripcion: String(raw.descripcion || '').trim(),
        principal
      },
      1
    );

    this.isLoading = true;
    this.actividadService
      .crearActividad(payload)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.form.reset({ codigoAMH: '', descripcion: '', principal: false });
        })
      )
      .subscribe({
        next: () => {
          if (principal === 1) {
            this.updatePrincipalExclusive(payload.codigoAMH);
          } else {
            this.loadActividades(this.cedula);
          }
        },
        error: (error) => {
          console.error('Error al agregar actividad comercial:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo agregar la actividad comercial.',
            icon: 'error'
          });
        }
      });
  }

  togglePrincipal(actividad: ActividadDto): void {
    if (!this.cedula) {
      return;
    }

    this.isLoading = true;
    this.updatePrincipalExclusive(actividad.MPV32_CodigoAMH, actividad).add(() => {
      this.isLoading = false;
    });
  }

  deleteActividad(actividad: ActividadDto): void {
    if (!this.cedula) {
      return;
    }

    Swal.fire({
      title: 'Eliminar actividad',
      text: `Desea eliminar la actividad "${actividad.MPV32_CodigoAMH}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isLoading = true;
      this.actividadService
        .eliminarActividad(actividad.MPV32_ID, this.cedula, actividad.MPV32_CodigoAMH)
        .pipe(finalize(() => (this.isLoading = false)))
        .subscribe({
          next: () => this.loadActividades(this.cedula),
          error: (error) => {
            console.error('Error al eliminar actividad comercial:', error);
            Swal.fire({
              title: 'Error',
              text: 'No se pudo eliminar la actividad comercial.',
              icon: 'error'
            });
          }
        });
    });
  }

  private updatePrincipalExclusive(codigoAMH: string, actividad?: ActividadDto) {
    const updates = this.actividades.map((item) => {
      const isPrincipal = item.MPV32_CodigoAMH === codigoAMH ? 1 : 0;
      if (item.MPV32_Principal === isPrincipal) {
        return of(null);
      }
      const payload = this.actividadService.buildPayload(
        {
          id: item.MPV32_ID,
          cedula: this.cedula,
          codigoAMH: item.MPV32_CodigoAMH,
          descripcion: item.MPV32_NombreActividad,
          principal: isPrincipal
        },
        2
      );
      return this.actividadService.actualizarActividad(payload);
    });

    return forkJoin(updates)
      .pipe(
        catchError((error) => {
          console.error('Error al actualizar actividad principal:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo actualizar la actividad principal.',
            icon: 'error'
          });
          return of(null);
        }),
        finalize(() => {
          this.loadActividades(this.cedula);
        })
      )
      .subscribe(() => {
        const principal = actividad ?? this.actividades.find((item) => item.MPV32_CodigoAMH === codigoAMH);
        if (principal) {
          this.principalChange.emit({ ...principal, MPV32_Principal: 1 });
        }
      });
  }
}
