import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ConfigService } from '../services/config.service';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {

  const config = inject(ConfigService);

  if (!req.url.startsWith('http')) {

    const newReq = req.clone({
      url: `${config.apiUrl}${req.url}`
    });

    return next(newReq);
  }

  return next(req);
};