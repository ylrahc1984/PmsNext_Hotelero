import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  ServiciosService,
  ServicioUI,
  CentroCostoOption,
  CategoriaOption,
  UnidadMedidaOption
} from './servicios.service';

interface ServicioFormData {
  codReceta: string;
  nomReceta: string;
  nomCorto: string;
  codCateg: string;
  codGrupo: string;
  uMedida: string;
  numPorciones: number;
  ctoReceta: number;
  ctoProduccion: number;
  ctoNeto: number;
  utilidad: number;
  totalCUtilidad: number;
  ctoTotal: number;
  descripcion: string;
  visible: number;
  urlImagen: string;
  cabys: string;
  compuesto: string;
}

@Component({
  selector: 'app-servicio-form',
  imports: [CommonModule, SharedModule, FormsModule, RouterModule],
  templateUrl: './servicio-form.component.html',
  styleUrls: ['./servicio-form.component.scss']
})
export class ServicioFormComponent implements OnInit {
  formData: ServicioFormData = this.createEmpty();
  isEditing = false;
  isLoading = false;
  title = 'Nuevo Servicio';

  categoriaOptions: CategoriaOption[] = [];
  grupoOptions: CentroCostoOption[] = [];
  unidadOptions: UnidadMedidaOption[] = [];

  private serviciosService = inject(ServiciosService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  ngOnInit() {
    const codReceta = this.route.snapshot.paramMap.get('codReceta') ?? '';
    if (codReceta) {
      this.isEditing = true;
      this.title = 'Editar Servicio';
      this.loadCatalogsAndServicio(codReceta);
    } else {
      this.formData = this.createEmpty();
      this.loadLookupOptions();
    }
  }

  private createEmpty(): ServicioFormData {
    return {
      codReceta: '',
      nomReceta: '',
      nomCorto: '',
      codCateg: '',
      codGrupo: '',
      uMedida: 'UND',
      numPorciones: 1,
      ctoReceta: 0,
      ctoProduccion: 0,
      ctoNeto: 0,
      utilidad: 0,
      totalCUtilidad: 0,
      ctoTotal: 0,
      descripcion: '',
      visible: 1,
      urlImagen: '',
      cabys: '',
      compuesto: 'N'
    };
  }

  private loadLookupOptions(): void {
    this.loadCategoriaOptions();
    this.loadCentroCostoOptions();
    this.loadUnidadMedidaOptions();
  }

  private loadCatalogsAndServicio(codReceta: string): void {
    this.isLoading = true;
    forkJoin({
      categorias: this.serviciosService.getCategoriaOptions().pipe(catchError(() => of([]))),
      grupos: this.serviciosService.getCentroCostoOptions(1, 100).pipe(catchError(() => of([]))),
      unidades: this.serviciosService.getUnidadMedidaOptions().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ categorias, grupos, unidades }) => {
        this.categoriaOptions = categorias;
        this.grupoOptions = grupos;
        this.unidadOptions = unidades;
        this.loadServicio(codReceta);
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  private loadCategoriaOptions(): void {
    this.serviciosService.getCategoriaOptions().subscribe({
      next: (options) => {
        const selected = this.formData.codCateg;
        const merged = selected && !options.some((item) => item.codigo === selected)
          ? [...options, { codigo: selected, nombre: selected }]
          : options;
        this.categoriaOptions = merged.sort((a, b) => a.codigo.localeCompare(b.codigo));
      },
      error: () => {
        this.categoriaOptions = [];
      }
    });
  }

  private loadCentroCostoOptions(): void {
    this.serviciosService.getCentroCostoOptions(1, 100).subscribe({
      next: (options) => {
        const selected = this.formData.codGrupo;
        const merged = selected && !options.some((item) => item.codigo === selected)
          ? [...options, { codigo: selected, nombre: selected }]
          : options;
        this.grupoOptions = merged.sort((a, b) => a.codigo.localeCompare(b.codigo));
      },
      error: () => {
        this.grupoOptions = [];
      }
    });
  }

  private loadUnidadMedidaOptions(): void {
    this.serviciosService.getUnidadMedidaOptions().subscribe({
      next: (options) => {
        const selected = this.formData.uMedida;
        const merged = selected && !options.some((item) => item.codigo === selected)
          ? [...options, { codigo: selected, descripcion: selected }]
          : options;
        this.unidadOptions = merged.sort((a, b) => a.codigo.localeCompare(b.codigo));
      },
      error: () => {
        this.unidadOptions = [];
      }
    });
  }

  private loadServicio(codReceta: string): void {
    this.serviciosService.getServicioByCodigo(codReceta).subscribe({
      next: (servicio) => {
        if (!servicio) {
          Swal.fire({
            title: 'No encontrado',
            text: 'No se encontro el servicio.',
            icon: 'warning'
          });
          this.isLoading = false;
          this.router.navigate(['/catalogos/servicios']);
          return;
        }
        this.applyServicio(servicio);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar servicio:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar el servicio.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  private applyServicio(servicio: ServicioUI): void {
    this.formData = {
      ...this.createEmpty(),
      codReceta: servicio.codReceta,
      nomReceta: servicio.nomReceta,
      nomCorto: servicio.nomCorto,
      codCateg: servicio.codCateg,
      codGrupo: servicio.codGrupo,
      uMedida: servicio.uMedida || 'UND',
      numPorciones: Number(servicio.numPorciones || 0),
      ctoReceta: Number(servicio.ctoReceta || 0),
      ctoProduccion: Number(servicio.ctoProduccion || 0),
      ctoNeto: Number(servicio.ctoNeto || 0),
      utilidad: Number(servicio.utilidad || 0),
      totalCUtilidad: Number(servicio.totalCUtilidad || 0),
      ctoTotal: Number(servicio.ctoTotal || 0),
      descripcion: servicio.descripcion || '',
      visible: Number(servicio.visible ?? 0),
      urlImagen: servicio.urlImagen || '',
      cabys: servicio.cabys || '',
      compuesto: servicio.compuesto || 'N'
    };

    const normalizedGrupo = this.normalizeGrupoKey(this.formData.codGrupo);
    if (normalizedGrupo) {
      const matchByCodigo = this.grupoOptions.find(
        (item) => this.normalizeGrupoKey(item.codigo) === normalizedGrupo
      );
      const matchByNombre = matchByCodigo
        ? undefined
        : this.grupoOptions.find((item) => this.normalizeGrupoKey(item.nombre) === normalizedGrupo);
      if (matchByCodigo) {
        this.formData.codGrupo = matchByCodigo.codigo;
      } else if (matchByNombre) {
        this.formData.codGrupo = matchByNombre.codigo;
      }
    }

    if (this.formData.codCateg && !this.categoriaOptions.some((item) => item.codigo === this.formData.codCateg)) {
      this.categoriaOptions = [
        ...this.categoriaOptions,
        { codigo: this.formData.codCateg, nombre: this.formData.codCateg }
      ].sort((a, b) => a.codigo.localeCompare(b.codigo));
    }
    if (this.formData.codGrupo && !this.grupoOptions.some((item) => item.codigo === this.formData.codGrupo)) {
      this.grupoOptions = [
        ...this.grupoOptions,
        { codigo: this.formData.codGrupo, nombre: this.formData.codGrupo }
      ].sort((a, b) => a.codigo.localeCompare(b.codigo));
    }
    if (this.formData.uMedida && !this.unidadOptions.some((item) => item.codigo === this.formData.uMedida)) {
      this.unidadOptions = [
        ...this.unidadOptions,
        { codigo: this.formData.uMedida, descripcion: this.formData.uMedida }
      ].sort((a, b) => a.codigo.localeCompare(b.codigo));
    }
  }

  private normalizeGrupoKey(value: string | undefined | null): string {
    return (value || '')
      .trim()
      .toUpperCase()
      .replace(/\.+$/g, '')
      .replace(/\s+/g, ' ');
  }

  onVisibleToggle(checked: boolean): void {
    this.formData.visible = checked ? 1 : 0;
  }

  onCompuestoToggle(checked: boolean): void {
    this.formData.compuesto = checked ? 'S' : 'N';
  }

  saveServicio(form: NgForm): void {
    if (!form.valid) {
      return;
    }

    const cleaned: ServicioUI = {
      codReceta: this.formData.codReceta.trim(),
      nomReceta: this.formData.nomReceta.trim(),
      nomCorto: this.formData.nomCorto?.trim() || '',
      codCateg: this.formData.codCateg.trim(),
      codGrupo: this.formData.codGrupo.trim(),
      uMedida: this.formData.uMedida.trim(),
      numPorciones: Number(this.formData.numPorciones || 0),
      ctoReceta: Number(this.formData.ctoReceta || 0),
      ctoProduccion: Number(this.formData.ctoProduccion || 0),
      ctoNeto: Number(this.formData.ctoNeto || 0),
      utilidad: Number(this.formData.utilidad || 0),
      totalCUtilidad: Number(this.formData.totalCUtilidad || 0),
      ctoTotal: Number(this.formData.ctoTotal || 0),
      descripcion: this.formData.descripcion?.trim() || '',
      visible: Number(this.formData.visible ?? 0),
      urlImagen: this.formData.urlImagen?.trim() || '',
      cabys: this.formData.cabys?.trim() || '',
      compuesto: this.formData.compuesto || 'N'
    };

    const payload = this.serviciosService.buildPayloadFromUI(cleaned, this.isEditing ? 2 : 1);
    const request = this.isEditing
      ? this.serviciosService.editarServicio(cleaned.codReceta, payload)
      : this.serviciosService.crearServicio(payload);

    this.isLoading = true;
    request.subscribe({
      next: () => {
        Swal.fire({
          title: 'Exito',
          text: this.isEditing ? 'Servicio actualizado correctamente.' : 'Servicio creado correctamente.',
          icon: 'success'
        });
        this.router.navigate(['/catalogos/servicios']);
      },
      error: (error) => {
        console.error('Error al guardar servicio:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo guardar el servicio.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/catalogos/servicios']);
  }
}
