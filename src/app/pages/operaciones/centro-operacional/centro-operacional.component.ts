import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';

import { CentroOperacionalService } from './centro-operacional.service';
import {
  CentroActividadCard,
  CentroDetalleBloque,
  CentroHeatmapCell,
  CentroKpi,
  CentroNivelOperacion,
  CentroOperacionMatrixCell,
  CentroOperacionMatrixRow,
  CentroOperacionalParams,
  CentroOperacionalViewModel,
  CentroTimelineBlock
} from './interfaces/centro-operacional.interface';
import { buildCentroOperacionalViewModel, levelClass } from './utils/centro-operacional.mapper';

@Component({
  selector: 'app-centro-operacional',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './centro-operacional.component.html',
  styleUrls: ['./centro-operacional.component.scss', './centro-operacional-matrix.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CentroOperacionalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly centroService = inject(CentroOperacionalService);
  private readonly reloadSubject = new BehaviorSubject<void>(undefined);

  readonly today = this.toInputDate(new Date());
  readonly loading$ = new BehaviorSubject<boolean>(false);
  readonly error$ = new BehaviorSubject<string | null>(null);
  readonly expandedBlocks = new Set<string>();
  readonly expandedActivities = new Set<string>();

  readonly filtersForm = this.fb.group({
    fechaInicio: [this.today],
    fechaFin: [this.today],
    busqueda: [''],
    agenciaId: [''],
    choferId: ['']
  });

  readonly skeletonKpis = Array.from({ length: 5 });
  readonly skeletonRows = Array.from({ length: 4 });

  readonly vm$: Observable<CentroOperacionalViewModel> = this.reloadSubject.pipe(
    switchMap(() =>
      this.filtersForm.valueChanges.pipe(
        startWith(this.filtersForm.getRawValue()),
        debounceTime(250),
        map(() => this.buildParams()),
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
        tap(() => {
          this.loading$.next(true);
          this.error$.next(null);
        }),
        switchMap((params) =>
          this.centroService.getCentroOperacional(params).pipe(
            map((response) => buildCentroOperacionalViewModel(response)),
            catchError(() => {
              this.error$.next('No fue posible cargar el centro operacional. Verifique la conexion o los filtros aplicados.');
              return of(buildCentroOperacionalViewModel(null));
            }),
            startWith(buildCentroOperacionalViewModel(null)),
            finalize(() => this.loading$.next(false))
          )
        )
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  reload(): void {
    this.reloadSubject.next();
  }

  clearFilters(): void {
    this.filtersForm.patchValue({
      fechaInicio: this.today,
      fechaFin: this.today,
      busqueda: '',
      agenciaId: '',
      choferId: ''
    });
  }

  toggleBlock(block: CentroDetalleBloque): void {
    if (this.expandedBlocks.has(block.bloqueHora)) {
      this.expandedBlocks.delete(block.bloqueHora);
      return;
    }

    this.expandedBlocks.add(block.bloqueHora);
  }

  isExpanded(block: CentroDetalleBloque): boolean {
    return this.expandedBlocks.has(block.bloqueHora);
  }

  toggleActivity(row: CentroOperacionMatrixRow): void {
    if (this.expandedActivities.has(row.codServicio)) {
      this.expandedActivities.delete(row.codServicio);
      return;
    }

    this.expandedActivities.add(row.codServicio);
  }

  isActivityExpanded(row: CentroOperacionMatrixRow): boolean {
    return this.expandedActivities.has(row.codServicio);
  }

  getLevelClass(level: CentroNivelOperacion | 'neutral'): string {
    return level === 'neutral' ? 'is-neutral' : levelClass(level);
  }

  trackByKpi(index: number, item: CentroKpi): string {
    return `${index}-${item.label}`;
  }

  trackByTimeline(_: number, item: CentroTimelineBlock): string {
    return item.bloqueHora;
  }

  trackByActivity(_: number, item: CentroActividadCard): string {
    return item.codServicio;
  }

  trackByDetalle(_: number, item: CentroDetalleBloque): string {
    return item.bloqueHora;
  }

  trackByMatrixRow(_: number, item: CentroOperacionMatrixRow): string {
    return item.codServicio;
  }

  trackByMatrixCell(_: number, item: CentroOperacionMatrixCell): string {
    return item.bloqueHora;
  }

  trackByCell(_: number, item: CentroHeatmapCell): string {
    return item.bloqueHora;
  }

  private buildParams(): CentroOperacionalParams {
    const value = this.filtersForm.getRawValue();
    return {
      fechaInicio: value.fechaInicio ?? this.today,
      fechaFin: value.fechaFin ?? value.fechaInicio ?? this.today,
      busqueda: value.busqueda ?? '',
      agenciaId: value.agenciaId ?? '',
      choferId: value.choferId ?? '',
      page: 1,
      pageSize: 1000
    };
  }

  private toInputDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
