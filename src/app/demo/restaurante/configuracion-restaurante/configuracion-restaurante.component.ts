import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SharedModule } from 'src/app/theme/shared/shared.module';

type RestaurantConfigShortcut = {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: string;
  iconColor: string;
};

type RestaurantConfigGroup = {
  title: string;
  cards: RestaurantConfigShortcut[];
};

@Component({
  selector: 'app-configuracion-restaurante',
  standalone: true,
  imports: [CommonModule, RouterLink, SharedModule],
  templateUrl: './configuracion-restaurante.component.html',
  styleUrls: ['./configuracion-restaurante.component.scss']
})
export class ConfiguracionRestauranteComponent {
  readonly configGroups: RestaurantConfigGroup[] = [
    {
      title: 'Catalogos Restaurante',
      cards: [
        {
          id: 'servicios',
          title: 'Servicios',
          description: 'Productos, servicios y experiencias disponibles para venta',
          route: '/catalogos/servicios',
          icon: 'icon-layers',
          iconColor: 'text-c-cyan'
        },
        {
          id: 'listas-precios',
          title: 'Listas de Precios',
          description: 'Tarifas, precios y reglas comerciales',
          route: '/catalogos/listas-precios',
          icon: 'icon-tag',
          iconColor: 'text-c-blue'
        },
        {
          id: 'categorias-productos',
          title: 'Categorias de Productos',
          description: 'Familias y clasificaciones operativas',
          route: '/restaurante/configuracion/categorias',
          icon: 'icon-grid',
          iconColor: 'text-c-burgundy'
        }
      ]
    },
    {
      title: 'Operacion Restaurante',
      cards: [
        {
          id: 'puntos-venta',
          title: 'Puntos de Venta',
          description: 'Cajas, estaciones y puntos operativos',
          route: '/restaurante/configuracion/puntos-venta',
          icon: 'icon-monitor',
          iconColor: 'text-c-cyan'
        },
        {
          id: 'saloneros',
          title: 'Saloneros',
          description: 'Equipo de atencion, salones y turnos',
          route: '/restaurante/saloneros',
          icon: 'icon-users',
          iconColor: 'text-c-blue'
        }
      ]
    }
  ];

  getTotalConfigOptions(): number {
    return this.configGroups.reduce((total, group) => total + group.cards.length, 0);
  }
}
