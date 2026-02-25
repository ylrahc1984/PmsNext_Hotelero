import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

import { EmpresaContextService } from '../services/empresa-context.service';

@Injectable()
export class EmpresaInterceptor implements HttpInterceptor {
  constructor(private empresaContext: EmpresaContextService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (req.url.includes('/api/empresa')) {
      return next.handle(req);
    }

    const empresa = this.empresaContext.getSnapshot();
    if (!empresa?.MA04_Unidad) {
      return next.handle(req);
    }

    return next.handle(
      req.clone({
        setHeaders: {
          'X-Unidad': empresa.MA04_Unidad
        }
      })
    );
  }
}
