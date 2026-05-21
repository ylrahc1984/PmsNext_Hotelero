import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { ClienteService } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.service';
import { ServiciosService } from 'src/app/demo/catalogos/servicios/servicios.service';
import { AgenciaComision } from '../interfaces/config-comision.interface';
import { ReglaComision, ReglaComisionPayload } from '../interfaces/regla-comision.interface';
import { AgenciaComisionService } from '../services/agencia-comision.service';
import { ReglaComisionService } from '../services/regla-comision.service';
import { ResumenCardComponent } from '../shared/components/resumen-card.component';
import { FiltrosReglasComponent } from './filtros-reglas.component';
import { ReglaCardComponent } from './regla-card.component';
import { ReglaFormComponent } from './regla-form.component';
import { ReglaPreviewComponent } from './regla-preview.component';

@Component({
  selector: 'app-reglas-comision',
  standalone: true,
  imports: [CommonModule, FormsModule, ResumenCardComponent, FiltrosReglasComponent, ReglaCardComponent, ReglaPreviewComponent, ReglaFormComponent],
  templateUrl: './reglas-comision.component.html',
  styleUrl: './reglas-comision.component.scss'
})
export class ReglasComisionComponent implements OnInit {
  private readonly service = inject(ReglaComisionService);
  private readonly agenciaComisionService = inject(AgenciaComisionService);
  private readonly clienteService = inject(ClienteService);
  private readonly serviciosService = inject(ServiciosService);
  private readonly authService = inject(AuthService);
  private readonly empresaContext = inject(EmpresaContextService);

  readonly search = signal('');
  readonly agencyFilter = signal('');
  readonly serviceFilter = signal('');
  readonly status = signal('');
  readonly typeFilter = signal('');
  readonly priorityFilter = signal('');
  readonly reglas = signal<ReglaComision[]>([]);
  readonly loading = signal(false);
  readonly selectedRegla = signal<ReglaComision | null>(null);
  readonly drawerOpen = signal(false);
  readonly agencyNames = signal<Record<string, string>>({});
  readonly serviceNames = signal<Record<string, string>>({});
  readonly agenciasComisionables = signal<AgenciaComision[]>([]);
  readonly agencyModalOpen = signal(false);
  readonly agencyModalSearch = signal('');
  readonly loadingAgencies = signal(false);

  readonly previewAgency = signal('');
  readonly previewService = signal('');
  readonly previewDate = signal(new Date().toISOString().slice(0, 10));
  readonly previewRule = signal<ReglaComision | null>(null);
  readonly previewLoading = signal(false);

  readonly selectedAgencyLabel = computed(() => {
    const code = this.agencyFilter();
    if (!code) return '';
    const agencia = this.agenciasComisionables().find((item) => item.aD15_CodAgencia === code);
    const name = agencia ? this.nombreAgenciaComisionable(agencia) : this.agencyNames()[code];
    return [code, name].filter(Boolean).join(' - ');
  });

  readonly filteredAgenciasComisionables = computed(() => {
    const search = this.agencyModalSearch().trim().toLowerCase();
    return this.agenciasComisionables().filter((agencia) =>
      [agencia.aD15_CodAgencia, this.nombreAgenciaComisionable(agencia), agencia.aD15_Observaciones].join(' ').toLowerCase().includes(search)
    );
  });

  readonly filtradas = computed(() => {
    const search = this.search().toLowerCase();
    const agency = this.agencyFilter().toLowerCase();
    const service = this.serviceFilter().toLowerCase();
    const status = this.status();
    const type = this.typeFilter();
    const priority = this.priorityFilter();

    return this.reglas()
      .filter((item) => {
        const agencyName = this.nombreAgencia(item);
        const serviceName = this.nombreServicio(item);
        const text = [item.AD17_CodAgencia, agencyName, item.AD17_CodServicio, serviceName, item.AD17_TipPax, item.AD17_TipoComision, item.AD17_Observaciones]
          .join(' ')
          .toLowerCase();
        const coincideTexto = text.includes(search);
        const coincideAgencia = !agency || [item.AD17_CodAgencia, agencyName].join(' ').toLowerCase().includes(agency);
        const coincideServicio = !service || [item.AD17_CodServicio, serviceName].join(' ').toLowerCase().includes(service);
        const coincideEstado = !status || (status === 'ACTIVAS' && item.AD17_Activo) || (status === 'INACTIVAS' && !item.AD17_Activo);
        const coincideTipo = !type || item.AD17_TipoComision === type;
        const coincidePrioridad = !priority || this.priorityLevel(item.AD17_Prioridad) === priority;
        return coincideTexto && coincideAgencia && coincideServicio && coincideEstado && coincideTipo && coincidePrioridad;
      })
      .sort((a, b) => Number(b.AD17_Prioridad ?? 0) - Number(a.AD17_Prioridad ?? 0));
  });

  readonly totalReglas = computed(() => this.reglas().length);
  readonly reglasActivas = computed(() => this.reglas().filter((item) => item.AD17_Activo).length);
  readonly reglasGlobales = computed(() => this.reglas().filter((item) => !item.AD17_CodAgencia && !item.AD17_CodServicio && !item.AD17_TipPax).length);
  readonly reglasEspecificas = computed(() => this.reglas().filter((item) => item.AD17_CodAgencia && item.AD17_CodServicio && item.AD17_TipPax).length);
  readonly prioridadMaxima = computed(() => Math.max(0, ...this.reglas().map((item) => Number(item.AD17_Prioridad ?? 0))));

  ngOnInit(): void {
    this.empresaContext.restaurarDesdeStorage();
  }

  loadReglas(): void {
    const codAgencia = this.agencyFilter().trim();
    if (!codAgencia) {
      this.reglas.set([]);
      this.agencyNames.set({});
      this.serviceNames.set({});
      return;
    }

    this.loading.set(true);
    this.service
      .list({ empresaId: this.getEmpresaId(), codAgencia })
      .pipe(
        catchError(() => of([])),
        finalize(() => this.loading.set(false))
      )
      .subscribe((data) => {
        this.reglas.set(data);
        this.loadDisplayNames(data);
      });
  }

  openNew(): void {
    this.selectedRegla.set(null);
    this.drawerOpen.set(true);
  }

  edit(regla: ReglaComision): void {
    this.selectedRegla.set(regla);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedRegla.set(null);
  }

  save(payload: ReglaComisionPayload): void {
    const request = payload.aD17_Id > 0 ? this.service.update(payload.aD17_Id, payload) : this.service.create(payload);
    this.loading.set(true);
    request
      .pipe(
        catchError(() => of(null)),
        finalize(() => this.loading.set(false))
      )
      .subscribe((saved) => {
        if (!saved) return;
        this.closeDrawer();
        this.loadReglas();
      });
  }

  toggleEstado(regla: ReglaComision): void {
    const request = regla.AD17_Activo ? this.service.deactivate(regla.AD17_Id, this.getOperador()) : this.service.activate(regla.AD17_Id, this.getOperador());
    this.loading.set(true);
    request
      .pipe(
        catchError(() => of(null)),
        finalize(() => this.loading.set(false))
      )
      .subscribe(() => this.loadReglas());
  }

  openAgencyModal(): void {
    this.agencyModalOpen.set(true);
    this.agencyModalSearch.set('');
    this.loadAgenciasComisionables();
  }

  closeAgencyModal(): void {
    this.agencyModalOpen.set(false);
  }

  selectAgencyFilter(agencia: AgenciaComision): void {
    const codAgencia = String(agencia.aD15_CodAgencia ?? '').trim();
    if (!codAgencia) return;

    this.agencyFilter.set(codAgencia);
    this.agencyNames.update((names) => ({ ...names, [codAgencia]: this.nombreAgenciaComisionable(agencia) }));
    this.closeAgencyModal();
    this.loadReglas();
  }

  clearAgencyFilter(): void {
    this.agencyFilter.set('');
    this.reglas.set([]);
    this.agencyNames.set({});
    this.serviceNames.set({});
  }

  simulateRule(): void {
    this.previewLoading.set(true);
    this.service
      .getReglaVigente({
        empresaId: this.getEmpresaId(),
        codAgencia: this.previewAgency(),
        codServicio: this.previewService(),
        fechaOperacion: this.toSlashDate(this.previewDate())
      })
      .pipe(
        catchError(() => of(null)),
        finalize(() => this.previewLoading.set(false))
      )
      .subscribe((rule) => this.previewRule.set(rule));
  }

  clearFilters(): void {
    this.search.set('');
    this.clearAgencyFilter();
    this.serviceFilter.set('');
    this.status.set('');
    this.typeFilter.set('');
    this.priorityFilter.set('');
  }

  count(value: number): string {
    return String(value);
  }

  nombreAgencia(regla: ReglaComision): string {
    return this.agencyNames()[regla.AD17_CodAgencia] ?? '';
  }

  nombreServicio(regla: ReglaComision): string {
    return this.serviceNames()[regla.AD17_CodServicio] ?? '';
  }

  getEmpresaId(): number {
    const unidad = this.empresaContext.getSnapshot()?.MA04_Unidad;
    const parsed = Number(unidad);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  nombreAgenciaComisionable(agencia: AgenciaComision): string {
    const record = agencia as unknown as Record<string, unknown>;
    return String(record['MPV00_NomClien'] ?? record['aD15_NombreAgencia'] ?? record['AD15_NombreAgencia'] ?? record['nombreAgencia'] ?? '');
  }

  private loadAgenciasComisionables(): void {
    if (this.agenciasComisionables().length) {
      return;
    }

    this.loadingAgencies.set(true);
    this.agenciaComisionService
      .list(this.getEmpresaId())
      .pipe(
        catchError(() => of([])),
        finalize(() => this.loadingAgencies.set(false))
      )
      .subscribe((agencias) => {
        this.agenciasComisionables.set(
          agencias.filter((agencia) => agencia.aD15_Activo && agencia.aD15_Comisiona && agencia.aD15_CodAgencia)
        );
      });
  }

  private priorityLevel(priority: number): string {
    if (priority >= 8) return 'ALTA';
    if (priority >= 4) return 'MEDIA';
    return 'BAJA';
  }

  private loadDisplayNames(reglas: ReglaComision[]): void {
    const agencias = Array.from(new Set(reglas.map((item) => item.AD17_CodAgencia).filter(Boolean)));
    const servicios = Array.from(new Set(reglas.map((item) => item.AD17_CodServicio).filter(Boolean)));

    if (agencias.length) {
      forkJoin(
        agencias.map((codigo) =>
          this.clienteService.getClienteByCodigo(codigo).pipe(
            map((cliente) => [codigo, cliente?.nombre || ''] as const),
            catchError(() => of([codigo, ''] as const))
          )
        )
      ).subscribe((entries) => this.agencyNames.set(Object.fromEntries(entries)));
    } else {
      this.agencyNames.set({});
    }

    if (servicios.length) {
      forkJoin(
        servicios.map((codigo) =>
          this.serviciosService.getServicioByCodigo(codigo).pipe(
            map((servicio) => [codigo, servicio?.nomReceta || ''] as const),
            catchError(() => of([codigo, ''] as const))
          )
        )
      ).subscribe((entries) => this.serviceNames.set(Object.fromEntries(entries)));
    } else {
      this.serviceNames.set({});
    }
  }

  private toSlashDate(value: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }
}
