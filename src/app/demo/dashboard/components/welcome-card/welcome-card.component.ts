import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-welcome-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './welcome-card.component.html',
  styleUrls: ['./welcome-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WelcomeCardComponent {
  @Input() userName = 'Usuario';
  @Input() title = 'Bienvenido de nuevo';
  @Input() description = 'Gestiona tu operación diaria, consulta pendientes y mantén visibilidad del día desde un solo lugar.';

  get initials(): string {
    const parts = this.userName
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 2);

    if (!parts.length) {
      return 'U';
    }

    return parts.map((item) => item[0].toUpperCase()).join('');
  }
}
