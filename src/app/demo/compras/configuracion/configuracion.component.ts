import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { SharedModule } from 'src/app/theme/shared/shared.module';

type ConfigCard = {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  iconColor: string;
};

type ConfigGroup = {
  title: string;
  cards: ConfigCard[];
};

@Component({
  selector: 'app-configuracion-compras',
  imports: [CommonModule, SharedModule],
  templateUrl: './configuracion.component.html',
  styleUrls: ['./configuracion.component.scss']
})
export class ConfiguracionComprasComponent implements OnInit {
  configGroups: ConfigGroup[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.initializeConfigGroups();
  }

  private initializeConfigGroups(): void {
    this.configGroups = [
      {
        title: 'Catalogos de Compras',
        cards: [
          {
            id: 'lineas',
            title: 'Lineas de Producto',
            description: 'Gestiona las lineas para clasificar productos',
            icon: 'icon-grid',
            route: '/compras/linea-producto',
            iconColor: 'text-c-blue'
          },
          {
            id: 'categorias',
            title: 'Categorias de Producto',
            description: 'Administra las categorias por linea',
            icon: 'icon-layers',
            route: '/compras/categoria-producto',
            iconColor: 'text-c-green'
          },
          {
            id: 'almacenes',
            title: 'Almacenes',
            description: 'Configura almacenes y ubicaciones',
            icon: 'icon-home',
            route: '/compras/almacen',
            iconColor: 'text-c-yellow'
          }
        ]
      }
    ];
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  getTotalConfigOptions(): number {
    return this.configGroups.reduce((total, group) => total + group.cards.length, 0);
  }
}
