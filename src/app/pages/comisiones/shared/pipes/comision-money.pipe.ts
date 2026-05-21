import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'comisionMoney',
  standalone: true
})
export class ComisionMoneyPipe implements PipeTransform {
  transform(value: number | string | null | undefined, currency = 'USD'): string {
    const amount = Number(value ?? 0);
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(Number.isFinite(amount) ? amount : 0);
  }
}
