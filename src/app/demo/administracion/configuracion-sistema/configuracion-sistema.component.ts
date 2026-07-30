import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SharedModule } from 'src/app/theme/shared/shared.module';

/**
 * Interface para las tarjetas de configuraciÃ³n
 */
interface ConfigCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  iconColor: string;
}

/**
 * Interface para grupos de configuraciÃ³n
 */
interface ConfigGroup {
  title: string;
  cards: ConfigCard[];
}

/**
 * Componente HUB central para la configuraciÃ³n del sistema
 * Presenta todas las opciones de configuraciÃ³n en un diseÃ±o tipo panel de control
 */
@Component({
  selector: 'app-configuracion-sistema',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './configuracion-sistema.component.html',
  styleUrls: ['./configuracion-sistema.component.scss']
})
export class ConfiguracionSistemaComponent implements OnInit {
  
  // Grupos de configuraciÃ³n con sus respectivas tarjetas
  configGroups: ConfigGroup[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.initializeConfigGroups();
  }

  /**
   * Inicializa los grupos de configuraciÃ³n con sus tarjetas
   */
  private initializeConfigGroups(): void {
    this.configGroups = [
      {
        title: 'Configuracion Financiera',
        cards: [
          {
            id: 'monedas',
            title: 'Monedas',
            description: 'Gestionar las monedas del sistema',
            icon: 'icon-coin-dollar',
            route: '/monedas',
            iconColor: 'text-c-green'
          },
          {
            id: 'tipo-cambio',
            title: 'Tipo de Cambio',
            description: 'Configurar tasas de cambio entre monedas',
            icon: 'icon-refresh-cw',
            route: '/administracion/tipo-cambio',
            iconColor: 'text-c-blue'
          },
          {
            id: 'formas-pago',
            title: 'Formas de Pago',
            description: 'Administrar metodos de pago',
            icon: 'icon-credit-card',
            route: '/formas-pago',
            iconColor: 'text-c-purple'
          },
          {
            id: 'impuestos',
            title: 'Impuestos',
            description: 'Configurar impuestos y tasas',
            icon: 'icon-percent',
            route: '/administracion/configuracion/impuestos',
            iconColor: 'text-c-red'
          },
          {
            id: 'documentos',
            title: 'Documentos',
            description: 'Definicion de documentos fiscales y operativos',
            icon: 'icon-file-text',
            route: '/administracion/configuracion/documento',
            iconColor: 'text-c-blue'
          }
        ]
      },
      {
        title: 'Configuracion Administrativa',
        cards: [
          {
            id: 'departamentos',
            title: 'Departamentos',
            description: 'Gestionar departamentos de la empresa',
            icon: 'icon-briefcase',
            route: '/administracion/configuracion/departamentos',
            iconColor: 'text-c-yellow'
          },
          {
            id: 'centros-costos',
            title: 'Centros de Costos',
            description: 'Administrar centros de costos',
            icon: 'icon-layers',
            route: '/administracion/configuracion/centrocosto',
            iconColor: 'text-c-blue'
          },
          {
            id: 'tipo-cliente',
            title: 'Tipo de Cliente',
            description: 'Clasificacion de clientes del sistema',
            icon: 'icon-users',
            route: '/administracion/configuracion/tipo-cliente',
            iconColor: 'text-c-green'
          },
          {
            id: 'correlativos',
            title: 'Contadores (Correlativos)',
            description: 'Configurar numeracion de documentos',
            icon: 'icon-hash',
            route: '/administracion/configuracion/contadores',
            iconColor: 'text-c-green'
          },
          {
            id: 'unidad-medida',
            title: 'Unidades de Medida',
            description: 'Configurar unidades fisicas de productos/servicios',
            icon: 'icon-sliders',
            route: '/administracion/configuracion/unidad-medida',
            iconColor: 'text-c-purple'
          }
        ]
      },
      {
        title: 'Configuracion General',
        cards: [
          {
            id: 'parametros',
            title: 'Parametros Generales',
            description: 'Configuracion general del sistema',
            icon: 'icon-settings',
            route: '/administracion/configuracion/parametros',
            iconColor: 'text-c-purple'
          },
          {
            id: 'seguridad',
            title: 'Seguridad (Usuarios y Perfiles)',
            description: 'Gestionar usuarios, roles y permisos',
            icon: 'icon-shield',
            route: '/usuarios',
            iconColor: 'text-c-red'
          },
          {
            id: 'migraciones',
            title: 'Migraciones',
            description: 'Importar información desde sistemas anteriores',
            icon: 'icon-repeat',
            route: '/administracion/configuracion/migraciones',
            iconColor: 'text-c-blue'
          }
        ]
      }
    ];
  }

  /**
   * Navega a la ruta de configuraciÃ³n seleccionada
   * @param route Ruta de destino
   */
  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  /**
   * Obtiene el total de opciones de configuraciÃ³n
   */
  getTotalConfigOptions(): number {
    return this.configGroups.reduce((total, group) => total + group.cards.length, 0);
  }
}


