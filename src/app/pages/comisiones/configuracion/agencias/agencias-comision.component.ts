import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { catchError, finalize, of } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { AgenciaComision, AgenciaComisionPayload } from '../../interfaces/config-comision.interface';
import { AgenciaComisionService } from '../../services/agencia-comision.service';
import { ResumenCardComponent } from '../../shared/components/resumen-card.component';
import { asArray } from '../../shared/models/comisiones-normalizers';
import { AgenciasComisionCardComponent } from './agencias-comision-card.component';
import { AgenciasComisionDrawerComponent } from './agencias-comision-drawer.component';
import { AgenciasComisionToolbarComponent } from './agencias-comision-toolbar.component';

@Component({
  selector: 'app-agencias-comision',
  standalone: true,
  imports: [
    CommonModule,
    ResumenCardComponent,
    AgenciasComisionToolbarComponent,
    AgenciasComisionCardComponent,
    AgenciasComisionDrawerComponent
  ],
  templateUrl: './agencias-comision.component.html',
  styleUrl: './agencias-comision.component.scss'
})
export class AgenciasComisionComponent implements OnInit {
  private readonly service = inject(AgenciaComisionService);
  private readonly authService = inject(AuthService);
  private readonly empresaContext = inject(EmpresaContextService);

  readonly search = signal('');
  readonly status = signal('');
  readonly agencias = signal<AgenciaComision[]>([]);
  readonly loading = signal(false);
  readonly selectedAgencia = signal<AgenciaComision | null>(null);
  readonly drawerOpen = signal(false);

  readonly filtradas = computed(() => {
    const search = this.search().toLowerCase();
    const status = this.status();
    return this.agencias().filter((item) => {
      const hayTexto = [item.aD15_CodAgencia, this.nombreAgencia(item), item.aD15_Observaciones]
        .join(' ')
        .toLowerCase()
        .includes(search);
      const coincideEstado =
        !status || (status === 'ACTIVAS' && item.aD15_Activo) || (status === 'INACTIVAS' && !item.aD15_Activo);
      return hayTexto && coincideEstado;
    });
  });

  readonly totalAgencias = computed(() => this.agencias().length);
  readonly activas = computed(() => this.agencias().filter((item) => item.aD15_Activo).length);
  readonly inactivas = computed(() => this.agencias().filter((item) => !item.aD15_Activo).length);
  readonly comisionables = computed(() => this.agencias().filter((item) => item.aD15_Comisiona).length);

  ngOnInit(): void {
    this.empresaContext.restaurarDesdeStorage();
    this.loadAgencias();
  }

  loadAgencias(): void {
    this.loading.set(true);
    this.service
      .list(this.getEmpresaId())
      .pipe(
        catchError(() => of([])),
        finalize(() => this.loading.set(false))
      )
      .subscribe((data) => this.agencias.set(asArray<AgenciaComision>(data)));
  }

  openNew(): void {
    this.selectedAgencia.set(null);
    this.drawerOpen.set(true);
  }

  edit(agencia: AgenciaComision): void {
    this.selectedAgencia.set(agencia);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedAgencia.set(null);
  }

  save(payload: AgenciaComisionPayload): void {
    const request = payload.aD15_Id > 0 ? this.service.update(payload.aD15_Id, payload) : this.service.create(payload);
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
        this.loadAgencias();
      });
  }

  toggleEstado(agencia: AgenciaComision): void {
    const request = agencia.aD15_Activo
      ? this.service.deactivate(agencia.aD15_Id, this.getOperador())
      : this.service.activate(agencia.aD15_Id, this.getOperador());
    this.loading.set(true);
    request
      .pipe(catchError(() => of([])))
      .subscribe(() => {
        this.loading.set(false);
        this.loadAgencias();
      });
  }

  clearFilters(): void {
    this.search.set('');
    this.status.set('');
  }

  count(value: number): string {
    return String(value);
  }

  nombreAgencia(agencia: AgenciaComision): string {
    const record = agencia as unknown as Record<string, unknown>;
    return String(record['MPV00_NomClien'] ?? record['aD15_NombreAgencia'] ?? record['AD15_NombreAgencia'] ?? record['nombreAgencia'] ?? '');
  }

  getEmpresaId(): number {
    const unidad = this.empresaContext.getSnapshot()?.MA04_Unidad;
    const parsed = Number(unidad);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }
}
