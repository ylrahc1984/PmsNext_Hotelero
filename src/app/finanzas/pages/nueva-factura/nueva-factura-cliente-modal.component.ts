import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { catchError, finalize, timeout } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ClienteService } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.service';
import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';

@Component({
  selector: 'app-nueva-factura-cliente-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nueva-factura-cliente-modal.component.html',
  styleUrls: ['./nueva-factura-cliente-modal.component.scss']
})
export class NuevaFacturaClienteModalComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Output() close = new EventEmitter<void>();
  @Output() clienteSelected = new EventEmitter<ClienteUI>();

  clienteSearchTerm = '';
  clientesLoading = false;
  clientes: ClienteUI[] = [];

  clientePage = 1;
  clientePageSize = 10;
  clienteTotalPages = 1;
  clienteTotalRegistros = 0;

  private clienteService = inject(ClienteService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private requestId = 0;
  private loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    const openChange = changes['open'];
    if (openChange?.currentValue === true && openChange?.previousValue !== true) {
      this.clientePage = 1;
      this.buscarClientes();
    }
    if (openChange?.currentValue === false) {
      this.cancelPending();
    }
  }

  onClose(): void {
    this.cancelPending();
    this.close.emit();
  }

  buscarClientes(): void {
    const currentRequest = ++this.requestId;
    this.clientesLoading = true;
    this.cdr.markForCheck();
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
    }
    this.loadingTimeoutId = setTimeout(() => {
      if (currentRequest === this.requestId) {
        this.clientesLoading = false;
        this.cdr.markForCheck();
      }
    }, 12000);
    this.clienteService
      .getClientes(this.clientePage, this.clientePageSize, this.clienteSearchTerm)
      .pipe(
        timeout(10000),
        catchError(() =>
          of({
            data: [],
            totalRegistros: 0,
            paginaActual: this.clientePage,
            pageSize: this.clientePageSize,
            totalPages: 1
          })
        ),
        finalize(() => {
          if (currentRequest === this.requestId) {
            this.clientesLoading = false;
            if (this.loadingTimeoutId) {
              clearTimeout(this.loadingTimeoutId);
              this.loadingTimeoutId = null;
            }
            this.cdr.markForCheck();
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          if (currentRequest !== this.requestId) {
            return;
          }
          this.clientes = res.data ?? [];
          this.clienteTotalRegistros = res.totalRegistros ?? 0;
          this.clienteTotalPages = res.totalPages ?? 1;
          this.clientesLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          if (currentRequest !== this.requestId) {
            return;
          }
          this.clientes = [];
          this.clienteTotalRegistros = 0;
          this.clienteTotalPages = 1;
          this.clientesLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  limpiarBusquedaClientes(): void {
    this.clienteSearchTerm = '';
    this.clientePage = 1;
    this.buscarClientes();
  }

  seleccionarCliente(cliente: ClienteUI): void {
    this.clientesLoading = false;
    this.clienteSelected.emit(cliente);
    this.close.emit();
  }

  paginaAnteriorClientes(): void {
    if (this.clientePage > 1) {
      this.clientePage -= 1;
      this.buscarClientes();
    }
  }

  paginaSiguienteClientes(): void {
    if (this.clientePage < this.clienteTotalPages) {
      this.clientePage += 1;
      this.buscarClientes();
    }
  }

  ngOnDestroy(): void {
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
      this.loadingTimeoutId = null;
    }
  }

  private cancelPending(): void {
    this.requestId += 1;
    this.clientesLoading = false;
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
      this.loadingTimeoutId = null;
    }
    this.cdr.markForCheck();
  }
}
