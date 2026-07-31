import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ModuleAccessApi, ModuleAccessMode, ModuleAccessState } from '../models/module-access.models';

const EMPTY_MODULES: ReadonlySet<string> = new Set<string>();

@Injectable({ providedIn: 'root' })
export class ModuleAccessService {
  private readonly apiUrl = `${environment.apiUrl}/modxusuario`;
  private readonly stateSubject = new BehaviorSubject<ModuleAccessState>({
    status: 'idle',
    usuario: '',
    modules: EMPTY_MODULES,
    error: null
  });

  private inFlightRequest: Observable<ReadonlySet<string>> | null = null;
  private inFlightUsuario = '';

  readonly state$ = this.stateSubject.asObservable();

  constructor(private http: HttpClient) {}

  get snapshot(): ModuleAccessState {
    return this.stateSubject.value;
  }

  loadForUser(usuario: string, force = false): Observable<ReadonlySet<string>> {
    const normalizedUsuario = usuario.trim();
    if (!normalizedUsuario) {
      return throwError(() => new Error('No se pudo determinar el usuario para consultar sus módulos.'));
    }

    const current = this.snapshot;
    if (!force && current.status === 'loaded' && this.sameUser(current.usuario, normalizedUsuario)) {
      return of(current.modules);
    }

    if (!force && this.inFlightRequest && this.sameUser(this.inFlightUsuario, normalizedUsuario)) {
      return this.inFlightRequest;
    }

    this.stateSubject.next({
      status: 'loading',
      usuario: normalizedUsuario,
      modules: EMPTY_MODULES,
      error: null
    });
    this.inFlightUsuario = normalizedUsuario;

    const request$ = this.http
      .get<ModuleAccessApi[]>(`${this.apiUrl}/usuario/${encodeURIComponent(normalizedUsuario)}`)
      .pipe(
        map((response) => this.toModuleSet(response)),
        tap((modules) => {
          this.stateSubject.next({
            status: 'loaded',
            usuario: normalizedUsuario,
            modules,
            error: null
          });
        }),
        catchError((error) => {
          this.stateSubject.next({
            status: 'error',
            usuario: normalizedUsuario,
            modules: EMPTY_MODULES,
            error
          });
          return throwError(() => error);
        }),
        finalize(() => {
          if (this.sameUser(this.inFlightUsuario, normalizedUsuario)) {
            this.inFlightRequest = null;
            this.inFlightUsuario = '';
          }
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );

    this.inFlightRequest = request$;
    return request$;
  }

  hasAccess(requiredModules: readonly string[], mode: ModuleAccessMode = 'any', state = this.snapshot): boolean {
    if (!requiredModules.length || state.status !== 'loaded') {
      return requiredModules.length === 0;
    }

    const normalizedRequired = requiredModules.map((module) => this.normalizeModule(module)).filter(Boolean);
    if (!normalizedRequired.length) {
      return true;
    }

    return mode === 'all'
      ? normalizedRequired.every((module) => state.modules.has(module))
      : normalizedRequired.some((module) => state.modules.has(module));
  }

  reset(): void {
    this.inFlightRequest = null;
    this.inFlightUsuario = '';
    this.stateSubject.next({
      status: 'idle',
      usuario: '',
      modules: EMPTY_MODULES,
      error: null
    });
  }

  private toModuleSet(response: ModuleAccessApi[] | null | undefined): ReadonlySet<string> {
    const modules = (response ?? [])
      .map((item) => this.normalizeModule(item.MA05_Modulo ?? item.MA03_Modulo ?? ''))
      .filter(Boolean);
    return new Set(modules);
  }

  private normalizeModule(module: string): string {
    return (module || '').trim().toUpperCase();
  }

  private sameUser(left: string, right: string): boolean {
    return left.trim().toUpperCase() === right.trim().toUpperCase();
  }
}

