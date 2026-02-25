import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { Empresa } from '../models/empresa.model';
import { EmpresaService } from './empresa.service';

@Injectable({ providedIn: 'root' })
export class EmpresaContextService {
  private readonly empresaService = inject(EmpresaService);
  private readonly storageKey = 'empresa_context';

  private readonly _empresa = signal<Empresa | null>(null);
  readonly empresa = computed(() => this._empresa());

  private loading = false;

  cargarEmpresaPrincipal(): void {
    if (this.loading || this._empresa()) {
      return;
    }

    this.loading = true;
    this.empresaService
      .obtenerEmpresas()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (empresas) => {
          const principal = empresas.find((item) => Number(item.MA04_Principal) === 1) ?? empresas[0] ?? null;
          if (principal) {
            this.setEmpresa(principal);
          }
        },
        error: () => {
          // Sin empresa disponible: se mantiene el contexto en null.
        }
      });
  }

  restaurarDesdeStorage(): void {
    if (this._empresa()) {
      return;
    }

    const stored = localStorage.getItem(this.storageKey);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Empresa;
      if (parsed?.MA04_Unidad) {
        this._empresa.set(parsed);
      }
    } catch {
      localStorage.removeItem(this.storageKey);
    }
  }

  setEmpresa(empresa: Empresa): void {
    this._empresa.set(empresa);
    localStorage.setItem(this.storageKey, JSON.stringify(empresa));
  }

  limpiar(): void {
    this._empresa.set(null);
    localStorage.removeItem(this.storageKey);
  }

  getSnapshot(): Empresa | null {
    return this._empresa();
  }
}
