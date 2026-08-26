import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ReservaTagAsignado, ReservaTagResumen } from '../../models/reserva-tag.model';

@Component({
  selector: 'app-reservation-tag-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-tag-list.component.html',
  styleUrls: ['./reservation-tag-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReservationTagListComponent {
  readonly tags = input<ReservaTagResumen[]>([]);
  readonly maxVisible = input(4);
  readonly compact = input(false);
  readonly expanded = input(false);
  readonly detailed = input(false);
  readonly showRemove = input(false);
  readonly removingTagIds = input<ReadonlySet<number>>(new Set<number>());
  readonly readOnlyReason = input('');

  readonly removeTag = output<ReservaTagAsignado>();
  readonly showAll = output<void>();

  readonly orderedTags = computed(() => [...this.tags()].sort((left, right) => this.compareTags(left, right)));
  readonly visibleTags = computed(() =>
    this.expanded() ? this.orderedTags() : this.orderedTags().slice(0, Math.max(0, this.maxVisible()))
  );
  readonly hiddenCount = computed(() => Math.max(this.orderedTags().length - this.maxVisible(), 0));

  canRemove(tag: ReservaTagResumen): boolean {
    return this.showRemove() && !this.readOnlyReason() && (tag.tipoAsignacion ?? '').toUpperCase() === 'MANUAL';
  }

  isAutomatic(tag: ReservaTagResumen): boolean {
    return (tag.tipoAsignacion ?? '').toUpperCase() === 'AUTOMATICO';
  }

  safeColor(color: string | null | undefined): string {
    return /^#[0-9A-Fa-f]{6}$/.test(color ?? '') ? color! : '#E5E7EB';
  }

  iconClass(icon: string | null | undefined): string {
    const icons: Record<string, string> = {
      crown: 'bi-crown',
      'panels-top-left': 'bi-grid-1x2',
      alert: 'bi-exclamation-triangle',
      star: 'bi-star',
      heart: 'bi-heart',
      clock: 'bi-clock',
      accessibility: 'bi-universal-access',
      tag: 'bi-tag'
    };
    return icons[(icon ?? '').toLowerCase()] ?? 'bi-tag';
  }

  accessibleTitle(tag: ReservaTagResumen): string {
    return [
      tag.nombre,
      tag.descripcion,
      tag.observacion ? `Observación: ${tag.observacion}` : null,
      tag.esAlerta ? 'Etiqueta de alerta.' : null,
      this.isAutomatic(tag) ? 'Etiqueta administrada automáticamente por el sistema.' : null
    ].filter(Boolean).join(' · ');
  }

  assignmentLabel(tag: ReservaTagResumen): string {
    return this.isAutomatic(tag) ? 'Automática' : 'Manual';
  }

  formatAssignedAt(value: string | null | undefined): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || '-';
    return new Intl.DateTimeFormat('es-CR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date);
  }

  requestRemoval(tag: ReservaTagResumen): void {
    if (this.canRemove(tag) && !this.removingTagIds().has(tag.idTag) && this.isAssignedTag(tag)) {
      this.removeTag.emit(tag);
    }
  }

  private isAssignedTag(tag: ReservaTagResumen): tag is ReservaTagAsignado {
    return typeof tag.idAsignacion === 'number'
      && Boolean(tag.codReserva)
      && Boolean(tag.tipoAsignacion)
      && typeof tag.fechaAsignacion === 'string'
      && typeof tag.operadorAsignacion === 'string';
  }

  private compareTags(left: ReservaTagResumen, right: ReservaTagResumen): number {
    return Number(right.esAlerta) - Number(left.esAlerta)
      || right.prioridad - left.prioridad
      || left.ordenCategoria - right.ordenCategoria
      || left.nombre.localeCompare(right.nombre);
  }
}
