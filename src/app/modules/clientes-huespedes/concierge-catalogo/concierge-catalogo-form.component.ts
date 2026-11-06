import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from 'src/app/core/services/toast.service';
import { SolicitudHuespedService } from '../solicitudes-huespedes/solicitudes-huespedes.service';
import { ConciergeCatalogoService } from './concierge-catalogo.service';
import { TipoSolicitudCatalogo, TipoSolicitudCatalogoGuardar } from './concierge-catalogo.models';

const AREAS: Record<string, string> = { HOUSEKEEPING: 'Ama de llaves', RECEPCION: 'Recepción', MANTENIMIENTO: 'Mantenimiento', ALIMENTOS: 'Alimentos y bebidas' };
const ICONOS: Record<string, string> = { towels: 'icon-droplet', cleaning: 'icon-wind', bed: 'icon-home', amenities: 'icon-gift', maintenance: 'icon-tool', transport: 'icon-truck', luggage: 'icon-briefcase', information: 'icon-info', 'special-request': 'icon-star', restaurant: 'icon-shopping-cart' };
@Component({ selector: 'app-concierge-catalogo-form', standalone: true, imports: [CommonModule, ReactiveFormsModule], templateUrl: './concierge-catalogo-form.component.html', styleUrls: ['./concierge-catalogo.scss'] })
export class ConciergeCatalogoFormComponent implements OnInit {
  private readonly service = inject(ConciergeCatalogoService);
  private readonly tiposService = inject(SolicitudHuespedService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly knownAreas = ['HOUSEKEEPING', 'RECEPCION', 'MANTENIMIENTO', 'ALIMENTOS'];
  readonly areaLabels = AREAS;
  readonly iconos = Object.keys(ICONOS);
  areas = [...this.knownAreas];
  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(80)]], descripcion: ['', [Validators.maxLength(250)]], area: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(30)]], icono: [''], orden: [0, [Validators.required, Validators.min(0)]],
    nombreEN: ['', [Validators.maxLength(80)]], descripcionEN: ['', [Validators.maxLength(250)]], permiteCantidad: [false], requiereComentario: [false]
  });
  id: number | null = null;
  inicial: TipoSolicitudCatalogo | null = null;
  cargando = false;
  guardando = false;
  error = '';
  get editando(): boolean { return this.id !== null; }
  ngOnInit(): void {
    this.tiposService.consultarTipos().subscribe({ next: (items) => { this.areas = [...new Set([...this.knownAreas, ...items.map((item) => item.area).filter(Boolean)])].sort(); } });
    const rawId = this.route.snapshot.paramMap.get('id');
    if (rawId === null) return;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id < 1) { this.error = 'El identificador del servicio no es válido.'; return; }
    this.id = id; this.cargando = true;
    this.service.consultar(id).subscribe({ next: (item) => { this.inicial = item; this.form.patchValue({ nombre: item.nombre, descripcion: item.descripcion ?? '', nombreEN: item.nombreEN ?? '', descripcionEN: item.descripcionEN ?? '', area: item.area, icono: item.icono ?? '', orden: item.orden, permiteCantidad: item.permiteCantidad, requiereComentario: item.requiereComentario }); this.cargando = false; }, error: (err) => { this.error = this.mensajeError(err); this.cargando = false; } });
  }
  iconClass(icon: string): string { return ICONOS[icon] ?? 'icon-help-circle'; }
  guardar(): void {
    if (this.guardando || this.cargando) return;
    this.form.markAllAsTouched(); if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const nameEn = this.normalizar(raw.nombreEN); const descriptionEn = this.normalizar(raw.descripcionEN);
    if (this.editando && (this.inicial?.nombreEN || this.inicial?.descripcionEN) && !nameEn && !descriptionEn) {
      this.error = 'No se pueden limpiar simultáneamente ambas traducciones inglesas: el procedimiento actual conserva los valores existentes cuando recibe ambos campos vacíos. Mantenga al menos una traducción.';
      return;
    }
    this.error = '';
    const payload: TipoSolicitudCatalogoGuardar = {
      nombre: this.normalizar(raw.nombre) ?? '', descripcion: this.normalizar(raw.descripcion), nombreEN: nameEn, descripcionEN: descriptionEn,
      area: raw.area.trim(), icono: this.normalizar(raw.icono), orden: Number(raw.orden), permiteCantidad: raw.permiteCantidad, requiereComentario: raw.requiereComentario
    };
    this.guardando = true;
    const request = this.id === null ? this.service.crear(payload) : this.service.actualizar(this.id, payload);
    request.subscribe({ next: () => { this.guardando = false; this.toast.success(`Servicio ${this.editando ? 'actualizado' : 'registrado'} correctamente.`); void this.router.navigate(['/administracion/configuracion-general/concierge']); }, error: (err) => { this.guardando = false; this.error = this.mensajeError(err); this.toast.error(this.error); } });
  }
  cancelar(): void { void this.router.navigate(['/administracion/configuracion-general/concierge']); }
  private normalizar(value: string): string | null { const result = value.trim().replace(/\s+/g, ' '); return result || null; }
  private mensajeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 400) return 'Los datos enviados no son válidos. Revise los campos e intente nuevamente.';
      if (err.status === 401 || err.status === 403) return 'No tiene autorización para administrar este catálogo.';
      if (err.status === 404) return 'El servicio solicitado no existe.';
      if (err.status === 409) return 'Ya existe un servicio con ese nombre.';
      if (err.status >= 500) return 'Ocurrió un error técnico. Intente nuevamente.';
    }
    return 'No fue posible guardar el servicio. Verifique su conexión e intente nuevamente.';
  }
}
