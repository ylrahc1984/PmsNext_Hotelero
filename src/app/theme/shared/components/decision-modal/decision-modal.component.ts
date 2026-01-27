import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-decision-modal',
  imports: [CommonModule],
  templateUrl: './decision-modal.component.html',
  styleUrls: ['./decision-modal.component.scss']
})
export class DecisionModalComponent {
  @Input() open = false;
  @Input() title = 'Decisión requerida';
  @Input() message = '';
  @Input() confirmText = 'Guardar borrador';
  @Input() cancelText = 'Cancelar y seguir editando';
  @Input() dangerText = 'Descartar reserva';
  @Input() busy = false;

  @Output() confirmAction = new EventEmitter<void>();
  @Output() cancelAction = new EventEmitter<void>();
  @Output() dangerAction = new EventEmitter<void>();

  onConfirm(): void {
    if (this.busy) return;
    this.confirmAction.emit();
  }

  onCancel(): void {
    if (this.busy) return;
    this.cancelAction.emit();
  }

  onDanger(): void {
    if (this.busy) return;
    this.dangerAction.emit();
  }
}
