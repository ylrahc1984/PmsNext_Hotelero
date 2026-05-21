import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { ServiciosService } from 'src/app/demo/catalogos/servicios/servicios.service';
import {
  ServicioComisionable,
  ServicioComisionablePayload
} from '../../interfaces/config-comision.interface';
import { ServicioComisionableService } from '../../services/servicio-comisionable.service';
import { ResumenCardComponent } from '../../shared/components/resumen-card.component';
import { ServicioComisionableCardComponent } from './servicio-comisionable-card.component';
import { ServicioComisionableDrawerComponent } from './servicio-comisionable-drawer.component';
import { ServicioComisionableToolbarComponent } from './servicio-comisionable-toolbar.component';

@Component({
  selector: 'app-servicios-comisionables',
  standalone: true,
  imports: [
    CommonModule,
    ResumenCardComponent,
    ServicioComisionableToolbarComponent,
    ServicioComisionableCardComponent,
    ServicioComisionableDrawerComponent
  ],
  templateUrl: './servicios-comisionables.component.html',
  styleUrl: './servicios-comisionables.component.scss'
})
export class ServiciosComisionablesComponent implements OnInit {
  private readonly service = inject(ServicioComisionableService);
  private readonly catalogoService = inject(ServiciosService);
  private readonly authService = inject(AuthService);
  private readonly empresaContext = inject(EmpresaContextService);

  readonly search = signal('');
  readonly status = signal('');
  readonly commissionStatus = signal('');
  readonly overrideStatus = signal('');
  readonly servicios = signal<ServicioComisionable[]>([]);
  readonly loading = signal(false);
  readonly selectedServicio = signal<ServicioComisionable | null>(null);
  readonly drawerOpen = signal(false);

  readonly filtrados = computed(() => {
    const search = this.search().toLowerCase();
    const status = this.status();
    const commissionStatus = this.commissionStatus();
    const overrideStatus = this.overrideStatus();

    return this.servicios().filter((item) => {
      const hayTexto = [item.AD16_CodServicio, this.nombreServicio(item), item.AD16_Observaciones].join(' ').toLowerCase().includes(search);
      const coincideEstado =
        !status || (status === 'ACTIVOS' && item.AD16_Activo) || (status === 'INACTIVOS' && !item.AD16_Activo);
      const coincideComision =
        !commissionStatus ||
        (commissionStatus === 'COMISIONABLES' && item.AD16_Comisionable) ||
        (commissionStatus === 'NO_COMISIONABLES' && !item.AD16_Comisionable);
      const coincideOverride =
        !overrideStatus ||
        (overrideStatus === 'PERMITIDO' && item.AD16_PermiteOverride) ||
        (overrideStatus === 'BLOQUEADO' && !item.AD16_PermiteOverride);

      return hayTexto && coincideEstado && coincideComision && coincideOverride;
    });
  });

  readonly totalServicios = computed(() => this.servicios().length);
  readonly comisionables = computed(() => this.servicios().filter((item) => item.AD16_Comisionable).length);
  readonly noComisionables = computed(() => this.servicios().filter((item) => !item.AD16_Comisionable).length);
  readonly overridesActivos = computed(() => this.servicios().filter((item) => item.AD16_PermiteOverride).length);

  ngOnInit(): void {
    this.empresaContext.restaurarDesdeStorage();
    this.loadServicios();
  }

  loadServicios(): void {
    this.loading.set(true);
    this.service
      .list(this.getEmpresaId())
      .pipe(
        switchMap((servicios) => this.enrichServicios(servicios)),
        catchError(() => of([])),
        finalize(() => this.loading.set(false))
      )
      .subscribe((data) => this.servicios.set(data));
  }

  openNew(): void {
    this.selectedServicio.set(null);
    this.drawerOpen.set(true);
  }

  edit(servicio: ServicioComisionable): void {
    this.selectedServicio.set(servicio);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedServicio.set(null);
  }

  save(payload: ServicioComisionablePayload): void {
    const request = payload.aD16_Id > 0 ? this.service.update(payload.aD16_Id, payload) : this.service.create(payload);
    this.loading.set(true);
    request
      .pipe(
        catchError(() => of(null)),
        finalize(() => this.loading.set(false))
      )
      .subscribe((saved) => {
        if (!saved) {
          return;
        }
        this.closeDrawer();
        this.loadServicios();
      });
  }

  toggleEstado(servicio: ServicioComisionable): void {
    const request = servicio.AD16_Activo
      ? this.service.deactivate(servicio.AD16_Id, this.getOperador())
      : this.service.activate(servicio.AD16_Id, this.getOperador());
    this.loading.set(true);
    request
      .pipe(
        catchError(() => of(null)),
        finalize(() => this.loading.set(false))
      )
      .subscribe(() => this.loadServicios());
  }

  clearFilters(): void {
    this.search.set('');
    this.status.set('');
    this.commissionStatus.set('');
    this.overrideStatus.set('');
  }

  count(value: number): string {
    return String(value);
  }

  nombreServicio(servicio: ServicioComisionable): string {
    return servicio.AD16_NombreServicio || '';
  }

  getEmpresaId(): number {
    const unidad = this.empresaContext.getSnapshot()?.MA04_Unidad;
    const parsed = Number(unidad);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private enrichServicios(servicios: ServicioComisionable[]) {
    if (!servicios.length) {
      return of([]);
    }

    return forkJoin(
      servicios.map((servicio) =>
        this.catalogoService.getServicioByCodigo(servicio.AD16_CodServicio).pipe(
          map((catalogo) => ({
            ...servicio,
            AD16_NombreServicio: catalogo?.nomReceta || servicio.AD16_NombreServicio || ''
          })),
          catchError(() => of(servicio))
        )
      )
    );
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }
}
