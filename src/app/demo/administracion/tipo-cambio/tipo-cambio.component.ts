import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { MonedaService, MonedaUI } from 'src/app/demo/administracion/monedas/moneda.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { finalize, map, switchMap } from 'rxjs/operators';
import { TipoCambio, TipoCambioSaveInput, TipoCambioService } from './tipo-cambio.service';

type TipoCambioDraftField = 'compSis' | 'ventSis' | 'compBan' | 'ventBan';

interface TipoCambioDraft {
  moneda: MonedaUI;
  idTCambio: number | null;
  compSis: number | null;
  ventSis: number | null;
  compBan: number | null;
  ventBan: number | null;
}

@Component({
  selector: 'app-tipo-cambio',
  imports: [CommonModule, FormsModule, SharedModule, RouterLink],
  templateUrl: './tipo-cambio.component.html',
  styleUrls: ['./tipo-cambio.component.scss']
})
export class TipoCambioComponent implements OnInit {
  private readonly tipoCambioService = inject(TipoCambioService);
  private readonly operationalDateService = inject(OperationalDateService);
  private readonly monedaService = inject(MonedaService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  fechaDesde = signal('');
  fechaHasta = signal('');
  fechaDiaTipoCambio = signal('');
  monedasLoading = signal(false);
  monedasError = signal('');
  guardandoTiposCambio = signal(false);
  tiposCambioDraft = signal<TipoCambioDraft[]>([]);

  readonly puedeGuardarTiposCambio = computed(() => {
    const rows = this.tiposCambioDraft();
    return !this.guardandoTiposCambio()
      && !!this.fechaDiaTipoCambio()
      && rows.length > 0
      && rows.every((row) => [row.compSis, row.ventSis, row.compBan, row.ventBan].every((value) => value !== null && Number.isFinite(value) && value > 0));
  });

  tipoCambioActual = computed(() => this.tipoCambioService.getActual('USD'));

  historialFiltrado = computed(() => {
    return this.tipoCambioService.getByRangoFechas(this.fechaDesde() || undefined, this.fechaHasta() || undefined);
  });

  ngOnInit(): void {
    this.monedasLoading.set(true);
    this.operationalDateService
      .ensureLoaded()
      .pipe(
        switchMap((operationalDate) => {
          const fechaDia = normalizePmsDateDDMMYYYY(operationalDate);
          if (!fechaDia) throw new Error('No se pudo determinar una fecha operativa válida.');
          this.fechaDiaTipoCambio.set(fechaDia);
          return this.monedaService.getAll().pipe(
            map((monedas) => monedas
              .filter((moneda) => moneda.activo === 1)
              .sort((left, right) => left.orden - right.orden || left.codMoneda.localeCompare(right.codMoneda))),
            switchMap((monedas) => this.tipoCambioService.fetchTiposCambio(fechaDia, monedas.map((moneda) => moneda.codMoneda))
              .pipe(map((tiposCambio) => ({ monedas, tiposCambio }))))
          );
        }),
        finalize(() => this.monedasLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ monedas, tiposCambio }) => {
          this.monedasError.set(monedas.length ? '' : 'No hay monedas activas para cargar.');
          this.tiposCambioDraft.set(this.buildDrafts(monedas, tiposCambio));
        },
        error: (error) => {
          console.error('No se pudieron cargar las monedas y tipos de cambio de la fecha operativa.', error);
          this.monedasError.set('No se pudieron cargar las monedas y tipos de cambio de la fecha operativa.');
        }
      });
  }

  updateDraft(index: number, field: TipoCambioDraftField, value: number | null): void {
    const normalizedValue = value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
    this.tiposCambioDraft.update((rows) => rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [field]: normalizedValue } : row
    ));
  }

  guardarTiposCambio(): void {
    if (this.guardandoTiposCambio()) return;

    const fechaDia = this.fechaDiaTipoCambio();
    const operador = this.authService.getCurrentUser()?.usuario?.toString().trim() ?? '';
    const rows = this.tiposCambioDraft();
    if (!fechaDia || !operador || rows.length === 0) {
      this.toastService.warning('No se pudo determinar la fecha, el usuario o las monedas activas para guardar los tipos de cambio.', 5000, 'Tipo de cambio');
      return;
    }

    if (!this.puedeGuardarTiposCambio()) {
      this.toastService.warning('Completa los cuatro valores con montos mayores que cero para cada moneda activa.', 5000, 'Tipo de cambio');
      return;
    }

    const inputs: TipoCambioSaveInput[] = rows.map((row) => ({
      idTCambio: row.idTCambio,
      fechaDia,
      moneda: row.moneda.codMoneda,
      compSis: row.compSis!,
      ventSis: row.ventSis!,
      compBan: row.compBan!,
      ventBan: row.ventBan!,
      operador
    }));

    this.guardandoTiposCambio.set(true);
    this.tipoCambioService.saveTiposCambio(inputs)
      .pipe(
        finalize(() => this.guardandoTiposCambio.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (results) => {
          const succeeded = results.filter((result) => result.success);
          const failed = results.filter((result) => !result.success);
          if (succeeded.length) {
            const createdCount = succeeded.filter((result) => result.operation === 'created').length;
            const updatedCount = succeeded.length - createdCount;
            this.toastService.success(`${createdCount} nuevas y ${updatedCount} actualizadas de ${results.length} monedas.`, 5000, 'Tipos de cambio');
            this.reloadTiposCambio(failed.map((result) => result.moneda));
          }
          if (failed.length) {
            this.toastService.warning(`No se pudieron guardar estas monedas: ${failed.map((result) => result.moneda).join(', ')}.`, 6500, 'Tipos de cambio');
            failed.forEach((result) => console.error(`Falló el guardado del tipo de cambio ${result.moneda}.`, result.error));
          }
        },
        error: (error: unknown) => {
          console.error('No se pudieron guardar los tipos de cambio.', error);
          this.toastService.error('No se pudieron guardar los tipos de cambio.', 5000, 'Tipo de cambio');
        }
      });
  }

  private reloadTiposCambio(preserveMonedas: readonly string[] = []): void {
    const fechaDia = this.fechaDiaTipoCambio();
    const currencies = this.tiposCambioDraft().map((row) => row.moneda);
    if (!fechaDia || currencies.length === 0) return;

    this.monedasLoading.set(true);
    this.monedasError.set('');
    this.tipoCambioService.fetchTiposCambio(fechaDia, currencies.map((moneda) => moneda.codMoneda))
      .pipe(
        finalize(() => this.monedasLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (tiposCambio) => {
          const refreshed = this.buildDrafts(currencies, tiposCambio);
          const preserveCodes = new Set(preserveMonedas.map((moneda) => moneda.toUpperCase()));
          const previous = new Map(this.tiposCambioDraft().map((row) => [row.moneda.codMoneda.toUpperCase(), row]));
          this.tiposCambioDraft.set(refreshed.map((row) => preserveCodes.has(row.moneda.codMoneda.toUpperCase())
            ? previous.get(row.moneda.codMoneda.toUpperCase()) ?? row
            : row));
        },
        error: (error: unknown) => {
          console.error('No se pudieron recargar los tipos de cambio.', error);
          this.monedasError.set('Los cambios se enviaron, pero no se pudo refrescar la lista. Recarga la pantalla antes de volver a guardar.');
        }
      });
  }

  private buildDrafts(monedas: MonedaUI[], tiposCambio: TipoCambio[]): TipoCambioDraft[] {
    const byCurrency = new Map<string, TipoCambio>();
    for (const item of tiposCambio) {
      const key = item.monedaReferencia.trim().toUpperCase();
      if (key && !byCurrency.has(key)) byCurrency.set(key, item);
    }

    return monedas.map((moneda) => {
      const current = byCurrency.get(moneda.codMoneda.trim().toUpperCase());
      return {
        moneda,
        idTCambio: current?.idTCambio ?? null,
        compSis: current?.compra ?? null,
        ventSis: current?.venta ?? null,
        compBan: current?.compraBanco ?? null,
        ventBan: current?.ventaBanco ?? null
      };
    });
  }

  clearFilters() {
    this.fechaDesde.set('');
    this.fechaHasta.set('');
  }
}
