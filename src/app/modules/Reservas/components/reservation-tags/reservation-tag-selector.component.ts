import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, merge, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, switchMap } from 'rxjs/operators';

import {
  ReservaTagAsignado,
  ReservaTagCatalogo,
  ReservaTagGrupo,
  ReservaTagSeleccionado
} from '../../models/reserva-tag.model';
import { ReservaTagsService } from '../../services/reserva-tags.service';
import { ReservationTagListComponent } from './reservation-tag-list.component';

@Component({
  selector: 'app-reservation-tag-selector',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ReservationTagListComponent],
  templateUrl: './reservation-tag-selector.component.html',
  styleUrls: ['./reservation-tag-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReservationTagSelectorComponent implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly tagsService = inject(ReservaTagsService);
  private readonly retrySearch = new Subject<string>();

  @ViewChild('tagSearchInput') private tagSearchInput?: ElementRef<HTMLInputElement>;

  readonly assignedTags = input<ReservaTagAsignado[]>([]);
  readonly saving = input(false);
  readonly saveError = input('');
  readonly removingTagIds = input<ReadonlySet<number>>(new Set<number>());
  readonly canManage = input(true);
  readonly catalogEnabled = input(true);

  readonly closed = output<void>();
  readonly save = output<ReservaTagSeleccionado[]>();
  readonly removeTag = output<ReservaTagAsignado>();
  readonly selectionNotice = output<string>();

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly catalog = signal<ReservaTagCatalogo[]>([]);
  readonly selectedTags = signal<ReservaTagSeleccionado[]>([]);
  readonly loadingCatalog = signal(false);
  readonly catalogError = signal('');
  readonly selectionMessage = signal('');

  readonly groupedCatalog = computed<ReservaTagGrupo[]>(() => {
    const groups = new Map<number, ReservaTagGrupo>();
    for (const tag of this.catalog()) {
      const existing = groups.get(tag.idCategoria);
      if (existing) {
        existing.tags.push(tag);
      } else {
        groups.set(tag.idCategoria, {
          idCategoria: tag.idCategoria,
          categoria: tag.categoria,
          descripcionCategoria: tag.descripcionCategoria,
          ordenCategoria: tag.ordenCategoria,
          tags: [tag]
        });
      }
    }
    return [...groups.values()]
      .sort((left, right) => left.ordenCategoria - right.ordenCategoria || left.categoria.localeCompare(right.categoria))
      .map((group) => ({ ...group, tags: [...group.tags].sort((left, right) => this.compareCatalogTags(left, right)) }));
  });

  readonly selectionCount = computed(() => this.selectedTags().length);
  readonly confirmationText = computed(() => {
    const count = this.selectionCount();
    return count === 1 ? 'Agregar etiqueta' : `Agregar ${count} etiquetas`;
  });

  ngOnInit(): void {
    if (!this.catalogEnabled()) return;

    merge(
      of(''),
      this.searchControl.valueChanges.pipe(
        map((value) => value.trim()),
        debounceTime(300),
        distinctUntilChanged()
      ),
      this.retrySearch
    )
      .pipe(
        switchMap((search) => {
          this.loadingCatalog.set(true);
          this.catalogError.set('');
          return this.tagsService.buscarTags(search, true).pipe(
            map((response) => {
              if (!response?.exito || !response.respuesta?.startsWith('OK|') || !Array.isArray(response.datos)) {
                throw new Error(this.cleanApiMessage(response?.respuesta) || 'No se pudo consultar el catálogo de etiquetas.');
              }
              return response.datos.filter((tag) => tag.activo && tag.permiteAsignacionManual);
            }),
            catchError((error: unknown) => {
              this.catalogError.set(this.errorMessage(error, 'No se pudo consultar el catálogo de etiquetas.'));
              return of([] as ReservaTagCatalogo[]);
            }),
            finalize(() => this.loadingCatalog.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((tags) => this.catalog.set(tags));
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.tagSearchInput?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.requestClose();
  }

  requestClose(): void {
    if (!this.saving()) this.closed.emit();
  }

  retryCatalog(): void {
    this.retrySearch.next(this.searchControl.value.trim());
  }

  isAssigned(idTag: number): boolean {
    return this.assignedTags().some((tag) => tag.idTag === idTag);
  }

  isSelected(idTag: number): boolean {
    return this.selectedTags().some((selection) => selection.tag.idTag === idTag);
  }

  persistedConflict(tag: ReservaTagCatalogo): ReservaTagAsignado | null {
    const group = this.exclusionGroup(tag.grupoExclusion);
    if (!group) return null;
    return this.assignedTags().find((assigned) => assigned.idTag !== tag.idTag && this.exclusionGroup(assigned.grupoExclusion) === group) ?? null;
  }

  resultDisabledReason(tag: ReservaTagCatalogo): string {
    if (this.isAssigned(tag.idTag)) return 'Esta etiqueta ya está asignada a la reserva.';
    const conflict = this.persistedConflict(tag);
    if (!conflict) return '';
    return conflict.tipoAsignacion.toUpperCase() === 'AUTOMATICO'
      ? `No disponible porque “${conflict.nombre}” es administrada automáticamente por el sistema.`
      : `Retire primero la etiqueta existente “${conflict.nombre}”.`;
  }

  toggleTag(tag: ReservaTagCatalogo): void {
    if (!this.canManage() || this.isAssigned(tag.idTag) || this.persistedConflict(tag)) return;
    const current = this.selectedTags();
    const existing = current.find((selection) => selection.tag.idTag === tag.idTag);
    if (existing) {
      this.selectedTags.set(current.filter((selection) => selection.tag.idTag !== tag.idTag));
      this.selectionMessage.set('');
      return;
    }

    const group = this.exclusionGroup(tag.grupoExclusion);
    let next = current;
    if (group) {
      const replaced = current.find((selection) => this.exclusionGroup(selection.tag.grupoExclusion) === group);
      if (replaced) {
        next = current.filter((selection) => this.exclusionGroup(selection.tag.grupoExclusion) !== group);
        const message = `“${replaced.tag.nombre}” fue reemplazada por “${tag.nombre}”.`;
        this.selectionMessage.set(message);
        this.selectionNotice.emit(message);
      } else {
        this.selectionMessage.set('');
      }
    } else {
      this.selectionMessage.set('');
    }
    this.selectedTags.set([...next, { tag, observacion: null }]);
  }

  updateObservation(idTag: number, value: string): void {
    const normalized = value.slice(0, 200);
    this.selectedTags.update((selections) => selections.map((selection) =>
      selection.tag.idTag === idTag ? { ...selection, observacion: normalized } : selection
    ));
  }

  onObservationInput(idTag: number, event: Event): void {
    const target = event.target;
    this.updateObservation(idTag, target instanceof HTMLTextAreaElement ? target.value : '');
  }

  observationFor(idTag: number): string {
    return this.selectedTags().find((selection) => selection.tag.idTag === idTag)?.observacion ?? '';
  }

  confirmSelection(): void {
    if (!this.canManage() || this.saving() || !this.selectionCount()) return;
    this.save.emit(this.selectedTags().map((selection) => ({
      tag: selection.tag,
      observacion: selection.observacion?.trim() || null
    })));
  }

  safeColor(color: string | null | undefined): string {
    return /^#[0-9A-Fa-f]{6}$/.test(color ?? '') ? color! : '#E5E7EB';
  }

  iconClass(icon: string | null | undefined): string {
    const icons: Record<string, string> = {
      crown: 'bi-crown', 'panels-top-left': 'bi-grid-1x2', alert: 'bi-exclamation-triangle',
      star: 'bi-star', heart: 'bi-heart', clock: 'bi-clock', accessibility: 'bi-universal-access', tag: 'bi-tag'
    };
    return icons[(icon ?? '').toLowerCase()] ?? 'bi-tag';
  }

  private exclusionGroup(value: string | null | undefined): string {
    return (value ?? '').trim().toUpperCase();
  }

  private compareCatalogTags(left: ReservaTagCatalogo, right: ReservaTagCatalogo): number {
    return Number(right.esAlerta) - Number(left.esAlerta)
      || right.prioridad - left.prioridad
      || left.nombre.localeCompare(right.nombre);
  }

  private cleanApiMessage(message: string | null | undefined): string {
    return (message ?? '').replace(/^(OK|ERROR)\|/i, '').replace(/\|/g, ' · ').trim();
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'object' && error !== null) {
      const candidate = error as { error?: { respuesta?: unknown; message?: unknown }; message?: unknown };
      const value = candidate.error?.respuesta ?? candidate.error?.message ?? candidate.message;
      if (typeof value === 'string' && value.trim()) return this.cleanApiMessage(value);
    }
    return fallback;
  }
}
