import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { MonedaService, MonedaUI } from 'src/app/demo/administracion/monedas/moneda.service';
import { ListaPrecioService } from './lista-precio.service';
import { ListaPrecioUI } from './lista-precio.models';
import { PlanesTarifasService, PlanTarifaUI } from './planes-tarifas.service';

@Component({
  selector: 'app-lista-precio-form',
  imports: [CommonModule, SharedModule, ReactiveFormsModule],
  templateUrl: './lista-precio-form.component.html',
  styleUrls: ['./lista-precio-form.component.scss']
})
export class ListaPrecioFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private listaPrecioService = inject(ListaPrecioService);
  private monedaService = inject(MonedaService);
  private planesTarifasService = inject(PlanesTarifasService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  form!: FormGroup;
  isEditing = false;
  isLoading = false;
  monedas: MonedaUI[] = [];
  planesTarifas: PlanTarifaUI[] = [];

  ngOnInit() {
    this.buildForm();
    this.loadMonedas();
    this.loadPlanesTarifas();
    const codigo = this.route.snapshot.paramMap.get('id');
    if (codigo) {
      this.isEditing = true;
      this.loadLista(codigo);
    }
  }

  private buildForm() {
    this.form = this.fb.group({
      codLstPrecio: ['', [Validators.required]],
      desLstPrecio: ['', [Validators.required]],
      moneda: ['', [Validators.required]],
      simbolo: [''],
      planRate: [null, [Validators.required]],
      vigencia: ['S', [Validators.required]],
      fechaDesde: [null],
      fechaHasta: [null],
      observaciones: ['']
    });
  }

  private loadMonedas() {
    this.monedaService.getAll().subscribe({
      next: (monedas) => {
        this.monedas = monedas ?? [];
      },
      error: (error) => {
        console.error('Error al cargar monedas:', error);
      }
    });
  }

  private loadPlanesTarifas() {
    this.planesTarifasService.getPlanesTarifas().subscribe({
      next: (planes) => {
        this.planesTarifas = planes ?? [];
        console.log('Planes de tarifas cargados:', this.planesTarifas);
      },
      error: (error) => {
        console.error('Error al cargar planes de tarifas:', error);
        Swal.fire({
          title: 'Advertencia',
          text: 'No se pudieron cargar los planes de tarifas.',
          icon: 'warning'
        });
      }
    });
  }

  private loadLista(codigo: string) {
    this.isLoading = true;
    this.listaPrecioService.getListaByCodigo(codigo).subscribe({
      next: (lista) => {
        if (!lista) {
          Swal.fire({
            title: 'No encontrado',
            text: 'No se encontro la lista de precios.',
            icon: 'warning'
          });
          this.isLoading = false;
          this.router.navigate(['/catalogos/listas-precios']);
          return;
        }
        this.form.patchValue({
          codLstPrecio: lista.codigo,
          desLstPrecio: lista.descripcion,
          moneda: lista.moneda,
          simbolo: lista.simbolo,
          planRate: lista.planRate || null,
          vigencia: lista.vigente || 'S',
          fechaDesde: lista.fechaDesde || null,
          fechaHasta: lista.fechaHasta || null,
          observaciones: lista.observaciones || ''
        });
        this.form.get('codLstPrecio')?.disable();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar lista de precios:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar la lista de precios.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  onCodigoInput() {
    const control = this.form.get('codLstPrecio');
    const value = (control?.value || '').toUpperCase();
    control?.setValue(value, { emitEvent: false });
  }

  onMonedaChange() {
    const moneda = this.form.get('moneda')?.value;
    const selected = this.monedas.find((m) => m.codMoneda === moneda);
    if (selected) {
      this.form.patchValue({ simbolo: selected.simbolo || '' });
    }
  }

  onVigenciaToggle(checked: boolean) {
    this.form.patchValue({ vigencia: checked ? 'S' : 'N' });
  }

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const uiPayload: ListaPrecioUI = {
      codigo: raw.codLstPrecio,
      descripcion: raw.desLstPrecio,
      moneda: raw.moneda,
      simbolo: raw.simbolo || '',
      planRate: raw.planRate || 0,
      vigente: raw.vigencia || 'S',
      fechaDesde: raw.fechaDesde || '',
      fechaHasta: raw.fechaHasta || '',
      observaciones: raw.observaciones || '',
      operador: ''
    };

    this.isLoading = true;
    if (this.isEditing) {
      const payload = this.listaPrecioService.buildPayloadFromUI(uiPayload, 2);
      this.listaPrecioService.editarLista(raw.codLstPrecio, payload).subscribe({
        next: () => {
          Swal.fire({
            title: 'Exito',
            text: 'Lista de precios actualizada correctamente.',
            icon: 'success'
          });
          this.router.navigate(['/catalogos/listas-precios']);
        },
        error: (error) => {
          console.error('Error al actualizar lista de precios:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo actualizar la lista de precios.',
            icon: 'error'
          });
          this.isLoading = false;
        }
      });
      return;
    }

    const payload = this.listaPrecioService.buildPayloadFromUI(uiPayload, 1);
    this.listaPrecioService.crearLista(payload).subscribe({
      next: () => {
        Swal.fire({
          title: 'Exito',
          text: 'Lista de precios creada correctamente.',
          icon: 'success'
        });
        this.router.navigate(['/catalogos/listas-precios']);
      },
      error: (error) => {
        console.error('Error al crear lista de precios:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo crear la lista de precios.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  cancelar() {
    this.router.navigate(['/catalogos/listas-precios']);
  }

  get isVigente() {
    return this.form.get('vigencia')?.value === 'S';
  }

  get planSeleccionado(): PlanTarifaUI | undefined {
    const planId = this.form.get('planRate')?.value;
    return this.planesTarifas.find(p => p.planId === planId);
  }
}
