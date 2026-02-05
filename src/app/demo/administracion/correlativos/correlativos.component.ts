import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { Correlativo, CorrelativoModule } from './correlativo.model';

declare var bootstrap: any;

@Component({
  selector: 'app-correlativos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './correlativos.component.html',
  styleUrls: ['./correlativos.component.scss']
})
export class CorrelativosComponent implements OnInit {
  correlativos: Correlativo[] = [];
  filteredCorrelativos: Correlativo[] = [];
  searchTerm: string = '';
  moduleFilter: string = '';
  statusFilter: string = '';
  currentPage: number = 1;
  itemsPerPage: number = 10;
  isEditing: boolean = false;
  currentCorrelativo: Correlativo | null = null;

  @ViewChild('correlativoModal') correlativoModal!: ElementRef;
  @ViewChild('correlativoForm') correlativoForm!: NgForm;

  // Módulos disponibles
  modules: CorrelativoModule[] = [
    { value: 'reservations', label: 'Reservas', description: 'Códigos para reservas de habitaciones' },
    { value: 'clients', label: 'Clientes', description: 'Códigos para clientes' },
    { value: 'suppliers', label: 'Proveedores', description: 'Códigos para proveedores' },
    { value: 'agencies', label: 'Agencias', description: 'Códigos para agencias comisionistas' },
    { value: 'invoices', label: 'Facturas', description: 'Códigos para facturas' },
    { value: 'receipts', label: 'Recibos', description: 'Códigos para recibos de pago' },
    { value: 'orders', label: 'Órdenes', description: 'Códigos para órdenes de trabajo' },
    { value: 'services', label: 'Servicios', description: 'Códigos para servicios' },
    { value: 'products', label: 'Productos', description: 'Códigos para productos' },
    { value: 'users', label: 'Usuarios', description: 'Códigos para usuarios' }
  ];

  // Opciones de separadores
  separators: { value: string; label: string }[] = [
    { value: '-', label: 'Guion (-)' },
    { value: '/', label: 'Barra (/)' },
    { value: '_', label: 'Guion bajo (_)' },
    { value: '', label: 'Sin separador' }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadCorrelativos();
  }

  loadCorrelativos(): void {
    // Datos de ejemplo - en producción vendrían de un servicio
    this.correlativos = [
      {
        id: '1',
        name: 'Código de Reserva',
        description: 'Correlativo para códigos de reserva',
        prefix: 'RSV',
        currentNumber: 1523,
        digits: 4,
        separator: '-',
        module: 'reservations',
        isActive: true,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-12-25')
      },
      {
        id: '2',
        name: 'Código de Cliente',
        description: 'Correlativo para códigos de cliente',
        prefix: 'CLI',
        currentNumber: 456,
        digits: 3,
        separator: '-',
        module: 'clients',
        isActive: true,
        createdAt: new Date('2024-01-20'),
        updatedAt: new Date('2024-12-20')
      },
      {
        id: '3',
        name: 'Código de Suplidor',
        description: 'Correlativo para códigos de suplidor',
        prefix: 'SUP',
        currentNumber: 89,
        digits: 3,
        separator: '/',
        module: 'suppliers',
        isActive: true,
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-12-15')
      },
      {
        id: '4',
        name: 'Código de Agencia',
        description: 'Correlativo para códigos de agencia',
        prefix: 'AGN',
        currentNumber: 23,
        digits: 2,
        separator: '_',
        module: 'agencies',
        isActive: false,
        createdAt: new Date('2024-03-10'),
        updatedAt: new Date('2024-11-30')
      },
      {
        id: '5',
        name: 'Código de Factura',
        description: 'Correlativo para códigos de factura',
        prefix: 'INV',
        currentNumber: 789,
        digits: 3,
        separator: '-',
        module: 'invoices',
        isActive: true,
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date('2024-12-24')
      }
    ];
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredCorrelativos = this.correlativos.filter(correlativo => {
      const matchesSearch = !this.searchTerm ||
        correlativo.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        correlativo.description.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        correlativo.prefix.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesModule = !this.moduleFilter || correlativo.module === this.moduleFilter;

      const matchesStatus = !this.statusFilter ||
        (this.statusFilter === 'active' && correlativo.isActive) ||
        (this.statusFilter === 'inactive' && !correlativo.isActive);

      return matchesSearch && matchesModule && matchesStatus;
    });
    this.currentPage = 1;
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  getPaginatedCorrelativos(): Correlativo[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredCorrelativos.slice(startIndex, endIndex);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredCorrelativos.length / this.itemsPerPage);
  }

  get totalCorrelativos(): number {
    return this.filteredCorrelativos.length;
  }

  get isFormValid(): boolean {
    return this.correlativoForm ? this.correlativoForm.valid : false;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getModuleLabel(module: string): string {
    const moduleObj = this.modules.find(m => m.value === module);
    return moduleObj ? moduleObj.label : module;
  }

  getModuleDescription(module: string): string {
    const moduleObj = this.modules.find(m => m.value === module);
    return moduleObj ? moduleObj.description : '';
  }

  getSeparatorLabel(separator: string): string {
    const sepObj = this.separators.find(s => s.value === separator);
    return sepObj ? sepObj.label : 'Sin separador';
  }

  generatePreview(correlativo: Correlativo): string {
    const numberStr = correlativo.currentNumber.toString().padStart(correlativo.digits, '0');
    return `${correlativo.prefix}${correlativo.separator}${numberStr}`;
  }

  createNewCorrelativo(): void {
    this.currentCorrelativo = {
      id: '',
      name: '',
      description: '',
      prefix: '',
      currentNumber: 1,
      digits: 4,
      separator: '-',
      module: '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.isEditing = false;
    // Aquí podríamos abrir un modal o navegar a un componente de detalle
    this.openCorrelativoModal();
  }

  editCorrelativo(correlativo: Correlativo): void {
    this.currentCorrelativo = { ...correlativo };
    this.isEditing = true;
    this.openCorrelativoModal();
  }

  toggleCorrelativoStatus(correlativo: Correlativo): void {
    correlativo.isActive = !correlativo.isActive;
    correlativo.updatedAt = new Date();
    // Aquí iría la lógica para guardar en el backend
    this.applyFilters();
  }

  deleteCorrelativo(correlativo: Correlativo): void {
    if (confirm(`¿Está seguro de que desea eliminar el correlativo "${correlativo.name}"?`)) {
      this.correlativos = this.correlativos.filter(c => c.id !== correlativo.id);
      this.applyFilters();
    }
  }

  saveCorrelativo(): void {
    if (!this.currentCorrelativo) return;

    if (this.isEditing) {
      const index = this.correlativos.findIndex(c => c.id === this.currentCorrelativo!.id);
      if (index !== -1) {
        this.correlativos[index] = { ...this.currentCorrelativo, updatedAt: new Date() };
      }
    } else {
      this.currentCorrelativo.id = Date.now().toString();
      this.correlativos.push({ ...this.currentCorrelativo });
    }

    this.applyFilters();
    this.closeCorrelativoModal();
  }

  openCorrelativoModal(): void {
    if (this.correlativoModal) {
      const modal = new bootstrap.Modal(this.correlativoModal.nativeElement);
      modal.show();
    }
  }

  closeCorrelativoModal(): void {
    if (this.correlativoModal) {
      const modal = bootstrap.Modal.getInstance(this.correlativoModal.nativeElement);
      if (modal) {
        modal.hide();
      }
    }
    this.currentCorrelativo = null;
    this.isEditing = false;
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  resetCorrelativo(): void {
    this.currentCorrelativo = {
      id: '',
      name: '',
      description: '',
      prefix: '',
      currentNumber: 1,
      digits: 4,
      separator: '-',
      module: '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}
