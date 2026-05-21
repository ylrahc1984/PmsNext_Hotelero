import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { ComisionLog } from '../interfaces/comision-log.interface';
import { ComisionLogService } from '../services/comision-log.service';
import { asArray, readText } from '../shared/models/comisiones-normalizers';

@Component({
  selector: 'app-comisiones-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comisiones-auditoria.component.html',
  styleUrl: './comisiones-auditoria.component.scss'
})
export class ComisionesAuditoriaComponent implements OnInit {
  private readonly service = inject(ComisionLogService);

  readonly search = signal('');
  readonly logs = signal<ComisionLog[]>([]);
  readonly filtrados = computed(() => {
    const search = this.search().toLowerCase();
    return this.logs().filter((log) =>
      [readText(log, ['AD24_Operador']), readText(log, ['AD24_Accion']), readText(log, ['AD24_TablaAfectada']), readText(log, ['AD24_Cambios'])]
        .join(' ')
        .toLowerCase()
        .includes(search)
    );
  });

  ngOnInit(): void {
    this.service
      .listar()
      .pipe(catchError(() => of([])))
      .subscribe((data) => this.logs.set(asArray<ComisionLog>(data)));
  }

  text(record: Record<string, unknown>, keys: string[], fallback = 'N/D'): string {
    return readText(record, keys, fallback);
  }
}
