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
  selector: 'app-configuracion-finanzas',
  imports: [CommonModule, SharedModule],
  templateUrl: './configuracion.component.html',
  styleUrls: ['./configuracion.component.scss']
})
export class ConfiguracionFinanzasComponent implements OnInit {
  configGroups: ConfigGroup[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.initializeConfigGroups();
  }

  private initializeConfigGroups(): void {
    this.configGroups = [
      {
        title: 'Catalogos Bancarios',
        cards: [
          {
            id: 'bancos',
            title: 'Bancos',
            description: 'Administra el catalogo de bancos',
            icon: 'icon-briefcase',
            route: '/finanzas/bancos',
            iconColor: 'text-c-blue'
          },
          {
            id: 'cuentas-bancarias',
            title: 'Cuentas Bancarias',
            description: 'Gestiona cuentas y datos bancarios',
            icon: 'icon-credit-card',
            route: '/finanzas/cuenta-banco',
            iconColor: 'text-c-green'
          },
          {
            id: 'conceptos-bancarios',
            title: 'Conceptos Bancarios',
            description: 'Define conceptos y clasificaciones',
            icon: 'icon-book',
            route: '/finanzas/conceptos',
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
