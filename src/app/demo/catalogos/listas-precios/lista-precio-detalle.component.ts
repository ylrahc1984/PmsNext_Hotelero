// angular import
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { DetalleLstPrecioPost, ListaPrecio, ReglaTarifa, ReglasTarifariasService, Servicio } from './listas-precios.service';
import { ListaPrecioService } from './lista-precio.service';
import { ListaPrecioUI } from './lista-precio.models';
import { ServiciosService, ServicioUI } from '../servicios/servicios.service';

@Component({
  selector: 'app-lista-precio-detalle',
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './lista-precio-detalle.component.html',
  styleUrls: ['./lista-precio-detalle.component.scss']
})
export class ListaPrecioDetalleComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly listaPrecioService = inject(ListaPrecioService);
  private readonly serviciosService = inject(ServiciosService);
  private readonly reglasService = inject(ReglasTarifariasService);

  listaPrecioId: number = 0;
  listaPrecioCodigo: string = '';
  listaPrecio: ListaPrecio | null = null;
  readonly selectedServicioId = signal<string>('');
  isCreatingRegla = false;

  servicios: Servicio[] = [];
  readonly reglas = signal<ReglaTarifa[]>([]);
  isLoadingReglas = false;
  reglasError = '';

  private readonly editDrafts = signal<Record<number, ReglaTarifa>>({});
  private readonly rowOps = signal<Record<number, { busy: boolean; error: string }>>({});

  readonly selectedServicioIdNormalized = computed(() => (this.selectedServicioId() || '').trim());
  readonly hasServicioSeleccionado = computed(() => {
    const id = this.selectedServicioIdNormalized();
    return id !== '' && id !== '0';
  });

  readonly reglasFiltradas = computed(() => {
    const servicioId = this.selectedServicioIdNormalized();
    if (!servicioId || servicioId === '0') {
      return [];
    }
    return this.reglas().filter((regla) => regla.servicioId === servicioId);
  });

  ngOnInit(): void {
    this.loadListaPrecio();
  }

  private setServicioInicial(): void {
    if (this.servicios.length === 0) {
      return;
    }

    const servicioConReglas = this.servicios.find(s =>
      this.reglas().some((regla) => regla.servicioId === s.id)
    );
    const servicioObjetivo = servicioConReglas || this.servicios[0];

    if (!this.hasServicioSeleccionado()) {
      this.selectedServicioId.set(servicioObjetivo.id);
    }
  }

  loadListaPrecio(): void {
    const codigo = this.route.snapshot.paramMap.get('id')?.trim();
    if (!codigo) {
      this.volverAListas();
      return;
    }
    this.listaPrecioCodigo = codigo;
    this.listaPrecioId = Number(codigo) || 0;
    this.loadServicios();
    this.loadReglas();
    this.listaPrecioService
      .getListaByCodigo(codigo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lista) => {
          if (!lista) {
            this.volverAListas();
            return;
          }
          this.listaPrecio = this.mapFromApi(lista);
        },
        error: () => {
          this.volverAListas();
        }
      });
  }

  onServicioChange(servicioId: number | string): void {
    const parsedId = String(servicioId ?? '').trim();
    this.selectedServicioId.set(parsedId);
  }

  readonly trackByReglaId = (_: number, regla: ReglaTarifa) => regla.id;

  isEditing(reglaId: number): boolean {
    return !!this.editDrafts()[reglaId];
  }

  getDraft(regla: ReglaTarifa): ReglaTarifa {
    return this.editDrafts()[regla.id] ?? regla;
  }

  startEdit(regla: ReglaTarifa): void {
    if (this.isSavingRegla(regla.id) || this.isEditing(regla.id)) {
      return;
    }
    this.editDrafts.update((current) => ({ ...current, [regla.id]: { ...regla } }));
    this.setRowError(regla.id, '');
  }

  cancelEdit(reglaId: number): void {
    this.editDrafts.update((current) => {
      const { [reglaId]: _removed, ...rest } = current;
      return rest;
    });
    this.setRowError(reglaId, '');
  }

  onDraftChange(reglaId: number, patch: Partial<ReglaTarifa>): void {
    this.editDrafts.update((current) => {
      const draft = current[reglaId];
      if (!draft) {
        return current;
      }

      const next: ReglaTarifa = { ...draft, ...patch } as ReglaTarifa;

      if (patch.cantMinPax !== undefined) {
        next.cantMinPax = this.toNumber(patch.cantMinPax, 0);
        next.adultosIncluidos = next.cantMinPax;
      }

      if (patch.cantMaxPax !== undefined) {
        next.cantMaxPax = this.toNumber(patch.cantMaxPax, 0);
      }

      if (patch.precioBase !== undefined) {
        next.precioBase = this.toNumber(patch.precioBase, 0);
      }

      if (patch.precioAdultoExtra !== undefined) {
        next.precioAdultoExtra = this.toNumber(patch.precioAdultoExtra, 0);
      }

      if (patch.precioNino !== undefined) {
        next.precioNino = this.toNumber(patch.precioNino, 0);
      }

      return { ...current, [reglaId]: next };
    });

    this.setRowError(reglaId, '');
  }

  isSavingRegla(reglaId: number): boolean {
    return this.rowOps()[reglaId]?.busy ?? false;
  }

  getRowError(reglaId: number): string {
    return this.rowOps()[reglaId]?.error ?? '';
  }

  saveRegla(reglaId: number): void {
    const draft = this.editDrafts()[reglaId];
    if (!draft || this.isSavingRegla(reglaId)) {
      return;
    }

    const validationError = this.validateDraft(draft);
    if (validationError) {
      this.setRowError(reglaId, validationError);
      return;
    }

    const payloadBase = this.buildDetallePayloadFromRegla(draft);
    const payload = this.reglasService.buildPayload(payloadBase, 2, reglaId);

    this.setRowBusy(reglaId, true);
    this.reglasService
      .updateDetalleWithResult(reglaId, payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.setRowBusy(reglaId, false))
      )
      .subscribe({
        next: (updated) => {
          const merged = updated ? this.mergeUpdatedRegla(draft, updated) : { ...draft };
          this.reglas.update((current) =>
            current.map((item) =>
              item.id === reglaId
                ? {
                    ...item,
                    ...merged,
                    servicioNombre: this.getServicioNombre(merged.servicioId),
                    moneda: this.listaPrecio?.moneda || merged.moneda
                  }
                : item
            )
          );
          this.cancelEdit(reglaId);
        },
        error: () => {
          this.setRowError(reglaId, 'No se pudo guardar la regla.');
        }
      });
  }

  addReglaBlank(): void {
    this.setServicioInicial();
    const servicioId = (this.selectedServicioId() || '').trim();
    if (!this.listaPrecioCodigo || !servicioId || servicioId === '0' || this.isCreatingRegla) {
      return;
    }

    this.isCreatingRegla = true;
    this.reglasError = '';

    const existingIds = new Set(
      this.reglas()
        .filter((r) => r.servicioId === servicioId && r.id > 0)
        .map((r) => r.id)
    );

    const tempId = this.buildTempId();
    const optimistic = this.buildBlankRegla(servicioId, tempId);

    this.reglas.update((current) => [optimistic, ...current]);
    this.startEdit(optimistic);
    this.setRowBusy(tempId, true);

    const payload = this.reglasService.buildPayload(this.buildDetallePayloadFromRegla(optimistic), 1, 0);
    this.reglasService
      .createDetalleWithResult(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isCreatingRegla = false;
          this.setRowBusy(tempId, false);
        })
      )
      .subscribe({
        next: (created) => {
          if (!created || !created.id || created.id <= 0) {
            this.reconcileCreatedReglaId(tempId, servicioId, existingIds);
            return;
          }

          const hydrated: ReglaTarifa = {
            ...optimistic,
            ...created,
            id: created.id,
            codLstPrecio: created.codLstPrecio || this.listaPrecioCodigo,
            servicioId: created.servicioId || servicioId,
            codServicio: created.codServicio || servicioId,
            servicioNombre: this.getServicioNombre(servicioId),
            moneda: this.listaPrecio?.moneda || created.moneda || ''
          };

          this.replaceReglaId(tempId, hydrated);
        },
        error: () => {
          this.removeReglaFromTable(tempId);
          this.reglasError = 'No se pudo crear la regla en blanco.';
        }
      });
  }

  toggleActive(reglaId: number): void {
    const regla = this.reglas().find((item) => item.id === reglaId);
    if (!regla) {
      return;
    }

    if (this.isSavingRegla(reglaId)) {
      return;
    }

    this.setRowBusy(reglaId, true);
    const payloadBase = this.buildDetallePayloadFromRegla({ ...regla, activa: !regla.activa });
    const payload = this.reglasService.buildPayload(payloadBase, 2, reglaId);

    this.reglasService
      .updateDetalleWithResult(reglaId, payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.setRowBusy(reglaId, false))
      )
      .subscribe({
      next: () => {
        const nextActiva = !regla.activa;
        this.reglas.update((current) => current.map((item) => (item.id === reglaId ? { ...item, activa: nextActiva } : item)));
        if (this.isEditing(reglaId)) {
          this.onDraftChange(reglaId, { activa: nextActiva });
        }
      },
      error: () => {
        this.setRowError(reglaId, 'No se pudo actualizar el estado de la regla.');
      }
    });
  }

  deleteRegla(reglaId: number): void {
    if (confirm('Estas seguro de que deseas eliminar esta regla tarifaria?')) {
      if (this.isSavingRegla(reglaId)) {
        return;
      }
      this.setRowBusy(reglaId, true);
      this.reglasService
        .deleteDetalle(reglaId)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => this.setRowBusy(reglaId, false))
        )
        .subscribe({
          next: () => {
            this.cancelEdit(reglaId);
            this.reglas.update((current) => current.filter((item) => item.id !== reglaId));
          },
          error: () => {
            this.setRowError(reglaId, 'No se pudo eliminar la regla.');
          }
        });
    }
  }

  volverAListas() {
    this.router.navigate(['/catalogos/listas-precios']);
  }

  getEstadoBadge(activa: boolean) {
    return activa ? 'badge-success' : 'badge-danger';
  }

  getEstadoText(activa: boolean) {
    return activa ? 'Activa' : 'Inactiva';
  }

  formatDate(date: Date) {
    if (!date) {
      return '';
    }
    return date.toLocaleDateString('es-ES');
  }

  getServicioNombre(servicioId: string): string {
    const servicio = this.servicios.find((item) => item.id === servicioId);
    return servicio?.nombre || 'Servicio no encontrado';
  }

  getIconClass(activa: boolean): string {
    return activa ? 'icon-check-circle' : 'icon-x-circle';
  }

  getPausePlayIcon(activa: boolean): string {
    return activa ? 'icon-pause-circle' : 'icon-play-circle';
  }

  getToggleTitle(activa: boolean): string {
    return activa ? 'Desactivar' : 'Activar';
  }

  getServicioIcon(): string {
    return 'icon-circle';
  }

  getChevronIcon(): string {
    return 'icon-chevron-down';
  }

  private mapFromApi(lista: ListaPrecioUI): ListaPrecio {
    return {
      id: Number(lista.codigo) || 0,
      nombre: lista.descripcion || lista.codigo,
      descripcion: lista.observaciones || '',
      moneda: (lista.moneda as ListaPrecio['moneda']) || 'CRC',
      vigenciaDesde: lista.fechaDesde ? new Date(lista.fechaDesde) : new Date(),
      vigenciaHasta: lista.fechaHasta ? new Date(lista.fechaHasta) : new Date(),
      activa: lista.vigente === 'S',
      updatedAt: new Date(),
      observaciones: lista.observaciones || ''
    };
  }

  private loadServicios(): void {
    this.serviciosService
      .getServiciosActivosAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (servicios) => {
          this.servicios = servicios.map((item) => this.mapServicioFromApi(item));
          this.syncReglaServicioNombres();
          this.setServicioInicial();
        },
        error: () => {
          this.servicios = [];
        }
      });
  }

  private mapServicioFromApi(item: ServicioUI): Servicio {
    return {
      id: String(item.codReceta) || '',
      nombre: item.nomReceta || item.codReceta,
      descripcion: item.descripcion || '',
      categoria: item.codCateg || '',
      activa: Number(item.visible ?? 0) === 1
    };
  }

  private loadReglas(): void {
    if (!this.listaPrecioCodigo) {
      return;
    }
    this.isLoadingReglas = true;
    this.reglasError = '';
    this.editDrafts.set({});
    this.rowOps.set({});
    this.reglasService
      .getDetallesByListaPrecio(this.listaPrecioCodigo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reglas) => {
          this.reglas.set(reglas);
          this.isLoadingReglas = false;
          this.syncReglaServicioNombres();
          this.setServicioInicial();
        },
        error: () => {
          this.isLoadingReglas = false;
          this.reglasError = 'No se pudieron cargar las reglas tarifarias.';
          this.reglas.set([]);
        }
      });
  }

  private syncReglaServicioNombres(): void {
    if (this.reglas().length === 0 || this.servicios.length === 0) {
      return;
    }
    this.reglas.update((current) =>
      current.map((regla) => ({
        ...regla,
        servicioNombre: this.getServicioNombre(regla.servicioId)
      }))
    );
  }

  private buildDetallePayloadFromRegla(
    regla: ReglaTarifa
  ): Omit<DetalleLstPrecioPost, 'tipo' | 'id' | 'operador' | 'respuesta'> {
    const cantMinPax = Number(regla.cantMinPax ?? regla.adultosIncluidos ?? 0);
    const cantMaxPax = Number(regla.cantMaxPax ?? regla.adultosIncluidos ?? 0);
    return {
      codLstPrecio: regla.codLstPrecio || this.listaPrecioCodigo,
      codServicio: regla.codServicio || String(regla.servicioId || ''),
      tipoTarifa: this.reglasService.getTipoTarifaFromCodigo(regla.tarifa),
      cantMinPax,
      cantMaxPax,
      precioAdulto: Number(regla.precioBase ?? 0),
      precioNino: Number(regla.precioNino ?? 0),
      precioPaxExtra: Number(regla.precioAdultoExtra ?? 0),
      horaDesde: regla.horaInicio || '',
      horaHasta: regla.horaFin || '',
      moneda: regla.moneda || this.listaPrecio?.moneda || '',
      observaciones: regla.observaciones?.trim() || '',
      activo: !!regla.activa
    };
  }

  private validateDraft(draft: ReglaTarifa): string {
    const cantMinPax = Number(draft.cantMinPax ?? 0);
    const cantMaxPax = Number(draft.cantMaxPax ?? 0);

    if (!draft.horaInicio || !draft.horaFin) {
      return 'Debe indicar el horario.';
    }
    if (draft.horaFin <= draft.horaInicio) {
      return 'El horario "Hasta" debe ser mayor que "Desde".';
    }
    if (cantMinPax < 0 || cantMaxPax < 0) {
      return 'Los pax no pueden ser negativos.';
    }
    if (cantMinPax > cantMaxPax) {
      return 'La cantidad mínima no puede ser mayor que la máxima.';
    }
    return '';
  }

  private mergeUpdatedRegla(draft: ReglaTarifa, updated: ReglaTarifa): ReglaTarifa {
    return {
      ...draft,
      id: updated.id || draft.id,
      codLstPrecio: updated.codLstPrecio || draft.codLstPrecio,
      codServicio: updated.codServicio || draft.codServicio,
      moneda: updated.moneda || draft.moneda
    };
  }

  private buildTempId(): number {
    return -Math.floor(Date.now() / 1000);
  }

  private buildBlankRegla(servicioId: string, id: number): ReglaTarifa {
    const moneda = this.listaPrecio?.moneda || '';
    return {
      id,
      listaPrecioId: this.listaPrecioId || Number(this.listaPrecioCodigo) || 0,
      codLstPrecio: this.listaPrecioCodigo,
      servicioId,
      codServicio: servicioId,
      servicioNombre: this.getServicioNombre(servicioId),
      tarifa: 'A',
      horaInicio: '08:00',
      horaFin: '18:00',
      precioBase: 0,
      adultosIncluidos: 1,
      precioAdultoExtra: 0,
      precioNino: 0,
      cantMinPax: 1,
      cantMaxPax: 1,
      moneda,
      observaciones: '',
      activa: true
    };
  }

  private replaceReglaId(oldId: number, next: ReglaTarifa): void {
    const draft = this.editDrafts()[oldId];
    const op = this.rowOps()[oldId];

    this.reglas.update((current) => current.map((item) => (item.id === oldId ? next : item)));

    if (draft) {
      this.editDrafts.update((current) => {
        const { [oldId]: removed, ...rest } = current;
        return { ...rest, [next.id]: { ...removed, ...next, id: next.id } };
      });
    }

    if (op) {
      this.rowOps.update((current) => {
        const { [oldId]: removed, ...rest } = current;
        return { ...rest, [next.id]: removed };
      });
    }
  }

  private removeReglaFromTable(reglaId: number): void {
    this.cancelEdit(reglaId);
    this.reglas.update((current) => current.filter((item) => item.id !== reglaId));
  }

  private reconcileCreatedReglaId(tempId: number, servicioId: string, existingIds: Set<number>): void {
    this.reglasService
      .getByListaPrecioAndServicio(this.listaPrecioCodigo, servicioId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reglas) => {
          const created = (reglas ?? [])
            .filter((r) => r.id > 0 && !existingIds.has(r.id))
            .sort((a, b) => (b.id || 0) - (a.id || 0))[0];

          if (!created) {
            this.removeReglaFromTable(tempId);
            this.reglasError = 'No se pudo identificar la regla creada. Recargando...';
            this.loadReglas();
            return;
          }

          const currentDraft = this.editDrafts()[tempId] ?? this.reglas().find((r) => r.id === tempId);
          const hydrated: ReglaTarifa = {
            ...(currentDraft as ReglaTarifa),
            ...created,
            id: created.id,
            codLstPrecio: created.codLstPrecio || this.listaPrecioCodigo,
            servicioId: created.servicioId || servicioId,
            codServicio: created.codServicio || servicioId,
            servicioNombre: this.getServicioNombre(servicioId),
            moneda: this.listaPrecio?.moneda || created.moneda || ''
          };

          this.replaceReglaId(tempId, hydrated);
        },
        error: () => {
          this.removeReglaFromTable(tempId);
          this.reglasError = 'No se pudo obtener el ID de la regla creada.';
        }
      });
  }

  private toNumber(value: unknown, fallback: number): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  private setRowBusy(reglaId: number, busy: boolean): void {
    this.rowOps.update((current) => ({
      ...current,
      [reglaId]: { busy, error: current[reglaId]?.error ?? '' }
    }));
  }

  private setRowError(reglaId: number, error: string): void {
    this.rowOps.update((current) => ({
      ...current,
      [reglaId]: { busy: current[reglaId]?.busy ?? false, error }
    }));
  }
}
