import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'comisionValue',
  standalone: true
})
export class ComisionValuePipe implements PipeTransform {
  transform(record: Record<string, unknown> | null | undefined, keys: string[], fallback = 'N/D'): string {
    if (!record) {
      return fallback;
    }

    for (const key of keys) {
      const value = record[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value);
      }
    }

    return fallback;
  }
}
