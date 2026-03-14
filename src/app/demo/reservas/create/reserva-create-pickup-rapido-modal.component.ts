import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface PickupRapidoModalSavePayload {
  nombre: string;
  duracion: string;
}

@Component({
  selector: 'app-reserva-create-pickup-rapido-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reserva-create-pickup-rapido-modal.component.html',
  styleUrls: ['./reserva-create-pickup-rapido-modal.component.scss']
})
export class ReservaCreatePickupRapidoModalComponent implements OnChanges {
  @Input() open = false;
  @Input() saving = false;
  @Input() errorMessage = '';
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<PickupRapidoModalSavePayload>();

  nombre = '';
  duracion = '00:00';

  ngOnChanges(changes: SimpleChanges): void {
    const openChange = changes['open'];
    if (openChange?.currentValue === true && openChange?.previousValue !== true) {
      this.nombre = '';
      this.duracion = '00:00';
    }
  }

  onClose(): void {
    if (this.saving) {
      return;
    }
    this.close.emit();
  }

  onSave(): void {
    const nombre = (this.nombre ?? '').toString().trim();
    const duracion = (this.duracion ?? '').toString().trim();
    if (!nombre || !duracion || this.saving) {
      return;
    }

    this.save.emit({ nombre, duracion });
  }
}
