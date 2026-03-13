import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ContactoRapidoModalSavePayload {
  codAgencia: string;
  nomContacto: string;
}

@Component({
  selector: 'app-reserva-create-contacto-rapido-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reserva-create-contacto-rapido-modal.component.html',
  styleUrls: ['./reserva-create-contacto-rapido-modal.component.scss']
})
export class ReservaCreateContactoRapidoModalComponent implements OnChanges {
  @Input() open = false;
  @Input() saving = false;
  @Input() codAgencia = '';
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<ContactoRapidoModalSavePayload>();

  nomContacto = '';

  ngOnChanges(changes: SimpleChanges): void {
    const openChange = changes['open'];
    if (openChange?.currentValue === true && openChange?.previousValue !== true) {
      this.nomContacto = '';
    }
  }

  onClose(): void {
    if (this.saving) {
      return;
    }
    this.close.emit();
  }

  onSave(): void {
    const codAgencia = (this.codAgencia ?? '').toString().trim();
    const nomContacto = (this.nomContacto ?? '').toString().trim();
    if (!codAgencia || !nomContacto || this.saving) {
      return;
    }
    this.save.emit({ codAgencia, nomContacto });
  }
}
