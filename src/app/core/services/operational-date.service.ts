import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { OperationalContextService } from './operational-context.service';

@Injectable({ providedIn: 'root' })
export class OperationalDateService {
  private readonly contextService = inject(OperationalContextService);

  readonly operationalDate = this.contextService.operationalDate;
  readonly loading = this.contextService.loading;
  readonly error = this.contextService.error;

  ensureLoaded(force = false): Observable<string> {
    return this.contextService.ensureLoaded(force).pipe(map((context) => context.operationalDate));
  }

  refresh(): Observable<string> {
    return this.contextService.refresh().pipe(map((context) => context.operationalDate));
  }
}
