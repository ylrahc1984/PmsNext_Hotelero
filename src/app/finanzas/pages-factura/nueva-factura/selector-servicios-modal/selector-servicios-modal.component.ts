import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ModoPrecio,
  ServicioListaPrecioItem,
  ServiciosListaPrecioService
} from 'src/app/finanzas/services/servicios-lista-precio.service';

@Component({
  selector: 'app-selector-servicios-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './selector-servicios-modal.component.html',
  styleUrls: ['./selector-servicios-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectorServiciosModalComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() open = false;
  @Input() codLista = '';
  @Input() modoPrecio: ModoPrecio = 'R';

  @Output() close = new EventEmitter<void>();
  @Output() servicioSelected = new EventEmitter<ServicioListaPrecioItem>();

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly searchControl = new FormControl('', { nonNullable: true });

  servicios: ServicioListaPrecioItem[] = [];
  serviciosLoading = false;
  serviciosError = '';

  pageNumber = 1;
  pageSize = 20;
  pageHasNext = false;
  pageItemsCount = 0;

  private requestId = 0;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly serviciosService = inject(ServiciosListaPrecioService);

  constructor() {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (!this.open) return;
        this.pageNumber = 1;
        this.buscarServicios();
      });
  }

  get rangeLabel(): string {
    if (this.pageItemsCount <= 0) {
      return 'Mostrando 0-0';
    }
    const start = (this.pageNumber - 1) * this.pageSize + 1;
    const end = start + this.pageItemsCount - 1;
    return `Mostrando ${start}-${end}`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    const openChange = changes['open'];
    if (openChange?.currentValue === true && openChange?.previousValue !== true) {
      this.pageNumber = 1;
      this.searchControl.setValue('', { emitEvent: false });
      this.buscarServicios();
      this.focusSearchInput();
      return;
    }

    if (openChange?.currentValue === false) {
      this.cancelPending();
      return;
    }

    if (this.open && (changes['codLista'] || changes['modoPrecio'])) {
      this.pageNumber = 1;
      this.buscarServicios();
    }
  }

  ngAfterViewInit(): void {
    if (this.open) {
      this.focusSearchInput();
    }
  }

  ngOnDestroy(): void {
    this.cancelPending();
  }

  onClose(): void {
    this.cancelPending();
    this.close.emit();
  }

  onBuscar(): void {
    this.pageNumber = 1;
    this.buscarServicios();
  }

  onLimpiar(): void {
    if (!this.searchControl.value) return;
    this.searchControl.setValue('', { emitEvent: false });
    this.pageNumber = 1;
    this.buscarServicios();
  }

  seleccionarServicio(servicio: ServicioListaPrecioItem): void {
    this.serviciosLoading = false;
    this.servicioSelected.emit(servicio);
    this.close.emit();
  }

  paginaAnterior(): void {
    if (this.serviciosLoading || this.pageNumber <= 1) return;
    this.pageNumber -= 1;
    this.buscarServicios();
  }

  paginaSiguiente(): void {
    if (this.serviciosLoading || !this.pageHasNext) return;
    this.pageNumber += 1;
    this.buscarServicios();
  }

  private buscarServicios(): void {
    const codLstPrecio = (this.codLista || '').trim();
    if (!codLstPrecio) {
      this.servicios = [];
      this.pageItemsCount = 0;
      this.pageHasNext = false;
      this.serviciosError = 'Seleccione la lista de precios para listar servicios.';
      this.cdr.markForCheck();
      return;
    }

    const currentRequest = ++this.requestId;
    this.serviciosLoading = true;
    this.serviciosError = '';
    this.cdr.markForCheck();

    const searchTerm = (this.searchControl.value || '').trim();

    this.serviciosService
      .getServiciosLista(codLstPrecio, this.pageNumber, this.pageSize, searchTerm)
      .pipe(
        catchError(() => {
          this.serviciosError = 'No se pudieron cargar los servicios de la lista seleccionada.';
          return of([]);
        }),
        finalize(() => {
          if (currentRequest === this.requestId) {
            this.serviciosLoading = false;
            this.cdr.markForCheck();
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          if (currentRequest !== this.requestId) return;
          const mapped = this.serviciosService.mapServicios(items, this.modoPrecio);
          this.servicios = mapped;
          this.pageItemsCount = mapped.length;
          this.pageHasNext = (items ?? []).length === this.pageSize;
          this.cdr.markForCheck();
        }
      });
  }

  private focusSearchInput(): void {
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 0);
  }

  private cancelPending(): void {
    this.requestId += 1;
    this.serviciosLoading = false;
    this.cdr.markForCheck();
  }
}
