import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';

interface SettingsShortcut {
  title: string;
  description: string;
  icon: string;
  route: string;
  tone: 'blue' | 'cyan' | 'slate' | 'green' | 'amber' | 'burgundy';
}

@Component({
  selector: 'app-front-desk-settings',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './front-desk-settings.component.html',
  styleUrls: ['./front-desk-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FrontDeskSettingsComponent {
  readonly shortcuts: SettingsShortcut[] = [
    {
      title: 'Grupos de Habitaciones',
      description: 'Organización interna por bloques, zonas o edificios.',
      icon: 'domain',
      route: '/front-desk/configuraciones/grupos-habitaciones',
      tone: 'amber'
    },
    {
      title: 'Categorías de Habitaciones',
      description: 'Agrupaciones para venta, operación y reportes.',
      icon: 'category',
      route: '/front-desk/configuraciones/categorias',
      tone: 'cyan'
    },
    {
      title: 'Tipos de Habitación',
      description: 'Clasificación comercial y operativa de las habitaciones.',
      icon: 'hotel_class',
      route: '/front-desk/configuraciones/tipos-habitacion',
      tone: 'blue'
    },
    {
      title: 'Tipos de PAX',
      description: 'Parámetros para adultos, menores, cortesías y perfiles.',
      icon: 'groups',
      route: '/front-desk/configuraciones/tipos-pax',
      tone: 'green'
    },
    {
      title: 'Nacionalidades',
      description: 'Catálogo base para huéspedes y segmentación operativa.',
      icon: 'public',
      route: '/front-desk/configuraciones/nacionalidades',
      tone: 'slate'
    },
    {
      title: 'Habitaciones',
      description: 'Inventario maestro de habitaciones disponibles en el hotel.',
      icon: 'meeting_room',
      route: '/front-desk/configuraciones/habitaciones',
      tone: 'burgundy'
    }
  ];

  trackByTitle(_: number, item: SettingsShortcut): string {
    return item.title;
  }
}
