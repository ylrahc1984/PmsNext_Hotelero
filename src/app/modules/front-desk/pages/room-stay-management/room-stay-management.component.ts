import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkScrollable } from '@angular/cdk/scrolling';

import { ToastService } from 'src/app/core/services/toast.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RoomRackNavigationState } from '../room-rack/models/room-rack-room.model';

type ActiveTab = 'stay' | 'account' | 'operations' | 'timeline';
type OperationKind = 'workflow' | 'financial' | 'document' | 'critical';
type ChargeBucket = 'lodging' | 'extras';
type DocumentFormat = 'pdf' | 'print';
type StayActionId =
  | 'change-room'
  | 'change-departure'
  | 'register-prepayment'
  | 'refresh-charges'
  | 'new-charge'
  | 'transfer-charges'
  | 'print-room-charge'
  | 'print-statement'
  | 'invoice-room'
  | 'check-out';

interface Guest {
  name: string;
  documentType: string;
  document: string;
  nationality: string;
  birthDate: string;
}

interface Charge {
  date: string;
  time: string;
  concept: string;
  reference: string;
  charge: number;
  payment: number;
  balance: number;
}

interface StayOperation {
  id: StayActionId;
  label: string;
  icon: string;
  kind: OperationKind;
  description: string;
  confirmText: string;
  tone?: 'primary' | 'danger';
}

interface OperationGroup {
  title: string;
  actions: StayOperation[];
}

interface TimelineItem {
  time: string;
  title: string;
  detail: string;
}

interface InvoiceClient {
  code: string;
  name: string;
  document: string;
  address: string;
  email?: string;
}

interface InvoicePaymentMethod {
  code: string;
  description: string;
}

interface InvoiceAppliedPayment {
  methodCode: string;
  description: string;
  reference: string;
  amount: number;
  order: number;
}

interface RoomOption {
  number: string;
  type: string;
}

interface ActionModalDraft {
  targetRoom: string;
  targetRoomType: string;
  newCheckOut: string;
  prepaymentAmount: number;
  chargeConcept: string;
  chargeAmount: number;
  chargeBucket: ChargeBucket;
  destinationFolio: string;
  notes: string;
  documentFormat: DocumentFormat;
}

interface InvoicePaymentDraft {
  methodCode: string;
  amount: number | null;
  reference: string;
}

interface RoomStay {
  roomNumber: string;
  roomType: string;
  status: 'OCCUPIED';
  agency: string;
  rate: string;
  reservationNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestsCount: number;
  childrenCount: number;
  masterFolio: string;
  plan: string;
  reservedAt: string;
  observations: string[];
  guests: Guest[];
  lodgingCharges: Charge[];
  extraCharges: Charge[];
  prepaid: number;
}

const rooms: RoomStay[] = [
  {
    roomNumber: '523',
    roomType: 'Deluxe Room',
    status: 'OCCUPIED',
    agency: 'Tarifa FITS',
    rate: 'Tarifa FITS',
    reservationNumber: 'EE250156799',
    checkIn: '16/06/2026',
    checkOut: '18/06/2026',
    nights: 2,
    guestsCount: 2,
    childrenCount: 0,
    masterFolio: 'TR00005',
    plan: 'DYN',
    reservedAt: '10/06/2026',
    observations: ['Tour Director confirma llegada temprana.', 'Prepagada parcialmente por agencia.', 'Solicita cama adicional y almohadas firmes.'],
    guests: [
      { name: 'Eric Burnett', documentType: 'PAS', document: '523', nationality: 'USA', birthDate: '12/04/1985' },
      { name: 'Danelle Burnett', documentType: 'PAS', document: '523', nationality: 'USA', birthDate: '15/09/1987' }
    ],
    lodgingCharges: [
      { date: '16/06/2026', time: '10:05', concept: 'Room Charge', reference: '523', charge: 120, payment: 0, balance: 120 },
      { date: '16/06/2026', time: '13:20', concept: 'Desayuno', reference: '523', charge: 25, payment: 0, balance: 145 },
      { date: '17/06/2026', time: '10:05', concept: 'Room Charge', reference: '523', charge: 120, payment: 0, balance: 265 },
      { date: '17/06/2026', time: '13:15', concept: 'Almuerzo', reference: '523', charge: 30, payment: 50, balance: 245 }
    ],
    extraCharges: [
      { date: '16/06/2026', time: '15:30', concept: 'Spa', reference: '523', charge: 80, payment: 0, balance: 80 },
      { date: '17/06/2026', time: '18:45', concept: 'Lavanderia', reference: '523', charge: 15, payment: 0, balance: 95 }
    ],
    prepaid: 100
  },
  {
    roomNumber: '401',
    roomType: 'Junior Suite',
    status: 'OCCUPIED',
    agency: 'Corporate Plus',
    rate: 'Business Flex',
    reservationNumber: 'EE250157004',
    checkIn: '15/06/2026',
    checkOut: '19/06/2026',
    nights: 4,
    guestsCount: 1,
    childrenCount: 0,
    masterFolio: 'TR00018',
    plan: 'BAR',
    reservedAt: '08/06/2026',
    observations: ['Cuenta corporativa con credito aprobado.', 'Huesped solicita facturacion separada de extras.', 'Preferencia por piso alto.'],
    guests: [{ name: 'Laura Chen', documentType: 'PAS', document: 'PA-7894112', nationality: 'Panama', birthDate: '04/02/1991' }],
    lodgingCharges: [
      { date: '15/06/2026', time: '16:20', concept: 'Room Charge', reference: 'TR00018', charge: 150, payment: 0, balance: 150 },
      { date: '16/06/2026', time: '07:55', concept: 'Breakfast', reference: 'REST-8752', charge: 22, payment: 0, balance: 172 },
      { date: '16/06/2026', time: '12:40', concept: 'Lunch', reference: 'REST-8791', charge: 38, payment: 0, balance: 210 }
    ],
    extraCharges: [
      { date: '16/06/2026', time: '14:10', concept: 'Spa', reference: 'SPA-188', charge: 70, payment: 0, balance: 280 },
      { date: '16/06/2026', time: '19:00', concept: 'Laundry', reference: 'LND-020', charge: 18, payment: 0, balance: 298 },
      { date: '17/06/2026', time: '08:30', concept: 'Transfer', reference: 'TRF-398', charge: 40, payment: 0, balance: 338 }
    ],
    prepaid: 125
  },
  {
    roomNumber: '612',
    roomType: 'Master Suite',
    status: 'OCCUPIED',
    agency: 'VIP Direct',
    rate: 'Suite Experience',
    reservationNumber: 'EE250157208',
    checkIn: '16/06/2026',
    checkOut: '20/06/2026',
    nights: 4,
    guestsCount: 3,
    childrenCount: 1,
    masterFolio: 'TR00026',
    plan: 'DYN',
    reservedAt: '11/06/2026',
    observations: ['Prepagada por tarjeta AMEX.', 'Solicita amenidad de bienvenida.', 'Cama adicional instalada antes de llegada.'],
    guests: [
      { name: 'Marco Alvarez', documentType: 'PAS', document: 'MX-4421909', nationality: 'Mexico', birthDate: '18/08/1982' },
      { name: 'Sofia Alvarez', documentType: 'PAS', document: 'MX-4421910', nationality: 'Mexico', birthDate: '30/10/1984' },
      { name: 'Mateo Alvarez', documentType: 'PAS', document: 'MX-4421911', nationality: 'Mexico', birthDate: '02/05/2016' }
    ],
    lodgingCharges: [
      { date: '16/06/2026', time: '17:30', concept: 'Room Charge', reference: 'TR00026', charge: 240, payment: 0, balance: 240 },
      { date: '17/06/2026', time: '08:15', concept: 'Breakfast', reference: 'REST-8834', charge: 58, payment: 0, balance: 298 },
      { date: '17/06/2026', time: '13:05', concept: 'Lunch', reference: 'REST-8882', charge: 76, payment: 0, balance: 374 }
    ],
    extraCharges: [
      { date: '17/06/2026', time: '15:30', concept: 'Spa', reference: 'SPA-209', charge: 150, payment: 0, balance: 524 },
      { date: '17/06/2026', time: '18:45', concept: 'Laundry', reference: 'LND-037', charge: 34, payment: 0, balance: 558 },
      { date: '18/06/2026', time: '09:10', concept: 'Transfer', reference: 'TRF-421', charge: 60, payment: 0, balance: 618 }
    ],
    prepaid: 300
  }
];

const initialTimeline: TimelineItem[] = [
  { time: '10:05', title: 'Check In realizado', detail: 'Recepcion confirmo documentos y garantia.' },
  { time: '10:20', title: 'Registro huesped', detail: 'Se completo el registro principal de la habitacion.' },
  { time: '13:15', title: 'Cargo desayuno', detail: 'Consumo cargado desde restaurante.' },
  { time: '15:30', title: 'Cargo Spa', detail: 'Servicio aplicado a folio de extras.' },
  { time: '18:45', title: 'Cargo lavanderia', detail: 'Orden de lavanderia procesada.' }
];

@Component({
  selector: 'app-room-stay-management',
  standalone: true,
  imports: [CommonModule, SharedModule, CdkScrollable],
  templateUrl: './room-stay-management.component.html',
  styleUrls: ['./room-stay-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomStayManagementComponent {
  private readonly invoiceConsumerFinal: InvoiceClient = {
    code: '000000000',
    name: 'CLIENTE EN GENERAL',
    document: '0000000000',
    address: 'S/D',
    email: ''
  };

  readonly activeTab = signal<ActiveTab>('stay');
  readonly room = signal<RoomStay>(rooms[0]);
  readonly activeAction = signal<StayOperation | null>(null);
  readonly actionDraft = signal<ActionModalDraft>(this.buildActionDraft());
  readonly timeline = signal<TimelineItem[]>(initialTimeline);
  readonly invoiceClientSearch = signal('');
  readonly selectedInvoiceClient = signal<InvoiceClient | null>(null);
  readonly invoiceAppliedPayments = signal<InvoiceAppliedPayment[]>([]);
  readonly invoicePaymentDraft = signal<InvoicePaymentDraft>({
    methodCode: 'cash',
    amount: null,
    reference: ''
  });
  readonly invoiceValidationMessage = signal('');
  readonly roomOptions = computed(() => this.buildRoomOptions(this.room().roomNumber));
  readonly activeActionKind = computed(() => this.activeAction()?.kind ?? 'workflow');
  readonly invoicePaymentMethods = signal<InvoicePaymentMethod[]>([
    { code: 'cash', description: 'EFECTIVO' },
    { code: 'card', description: 'TARJETA' },
    { code: 'transfer', description: 'TRANSFERENCIA' },
    { code: 'bonus', description: 'PAGO CON BONO' }
  ]);

  readonly tabs: { id: ActiveTab; label: string }[] = [
    { id: 'stay', label: 'Estancia' },
    { id: 'account', label: 'Cuenta' },
    { id: 'operations', label: 'Operaciones' },
    { id: 'timeline', label: 'Timeline' }
  ];

  readonly operationGroups: OperationGroup[] = [
    {
      title: 'Gestion de Estancia',
      actions: [
        {
          id: 'change-room',
          label: 'Cambiar Habitacion',
          icon: 'hotel',
          kind: 'workflow',
          description: 'Prepara el cambio operativo de la estancia hacia otra habitacion disponible.',
          confirmText: 'Preparar cambio',
          tone: 'primary'
        },
        {
          id: 'change-departure',
          label: 'Cambiar Fecha Salida',
          icon: 'event',
          kind: 'workflow',
          description: 'Permite extender o ajustar la salida de la reserva con una vista previa del impacto.',
          confirmText: 'Actualizar salida'
        },
        {
          id: 'register-prepayment',
          label: 'Registrar Prepago',
          icon: 'attach_money',
          kind: 'financial',
          description: 'Registra un prepago operativo para dejar trazabilidad del abono recibido.',
          confirmText: 'Registrar prepago'
        }
      ]
    },
    {
      title: 'Gestion de Cargos',
      actions: [
        {
          id: 'refresh-charges',
          label: 'Actualizar Cargos',
          icon: 'sync',
          kind: 'financial',
          description: 'Simula una sincronizacion operativa de cargos para refrescar el folio activo.',
          confirmText: 'Actualizar folio'
        },
        {
          id: 'new-charge',
          label: 'Nuevo Cargo',
          icon: 'add_circle',
          kind: 'financial',
          description: 'Registra un cargo manual y lo agrega al bloque correspondiente del folio.',
          confirmText: 'Agregar cargo',
          tone: 'danger'
        },
        {
          id: 'transfer-charges',
          label: 'Transferir Cargos',
          icon: 'compare_arrows',
          kind: 'financial',
          description: 'Mueve un monto a otro folio para representar una transferencia operativa.',
          confirmText: 'Transferir cargos'
        }
      ]
    },
    {
      title: 'Documentos',
      actions: [
        {
          id: 'print-room-charge',
          label: 'Imprimir Cargo Habitacion',
          icon: 'print',
          kind: 'document',
          description: 'Genera una salida documental del cargo de habitacion con datos de la estancia.',
          confirmText: 'Generar documento'
        },
        {
          id: 'print-statement',
          label: 'Imprimir Estado Cuenta',
          icon: 'receipt',
          kind: 'document',
          description: 'Previsualiza un estado de cuenta resumido antes de imprimir o exportar.',
          confirmText: 'Emitir estado'
        },
        {
          id: 'invoice-room',
          label: 'Facturar Habitacion',
          icon: 'description',
          kind: 'document',
          description: 'Prepara la emision del documento fiscal de la estancia con un resumen previo.',
          confirmText: 'Preparar factura',
          tone: 'primary'
        }
      ]
    },
    {
      title: 'Salida',
      actions: [
        {
          id: 'check-out',
          label: 'Check Out',
          icon: 'logout',
          kind: 'critical',
          description: 'Abre una confirmacion operativa de salida con saldo y alertas antes de ejecutar.',
          confirmText: 'Confirmar salida',
          tone: 'danger'
        }
      ]
    }
  ];

  readonly stayFields = computed(() => {
    const room = this.room();

    return [
      { label: 'Agencia', value: room.agency },
      { label: 'Tarifa', value: room.rate },
      { label: 'Numero reserva', value: room.reservationNumber },
      { label: 'Check In', value: room.checkIn },
      { label: 'Check Out', value: room.checkOut },
      { label: 'Noches', value: room.nights },
      { label: 'Folio Master', value: room.masterFolio },
      { label: 'Plan', value: room.plan },
      { label: 'Reservada', value: room.reservedAt }
    ];
  });

  readonly lodgingSubtotal = computed(() => this.sumCharges(this.room().lodgingCharges));
  readonly extrasSubtotal = computed(() => this.sumCharges(this.room().extraCharges));
  readonly totalToCharge = computed(() => this.lodgingSubtotal() + this.extrasSubtotal());
  readonly currentBalance = computed(() => this.totalToCharge() - this.room().prepaid);
  readonly headerBalance = computed(() => this.lodgingSubtotal());
  readonly modalHighlights = computed(() => {
    const room = this.room();

    return [
      { label: 'Habitacion', value: room.roomNumber },
      { label: 'Reserva', value: room.reservationNumber },
      { label: 'Folio', value: room.masterFolio },
      { label: 'Saldo actual', value: this.currentBalance().toLocaleString('en-US', { style: 'currency', currency: 'USD' }) }
    ];
  });
  readonly invoiceClients = computed<InvoiceClient[]>(() => {
    const guestClients = this.room().guests.map((guest, index) => ({
      code: `HSP-${index + 1}`,
      name: guest.name,
      document: guest.document,
      address: `Habitacion ${this.room().roomNumber}`,
      email: ''
    }));

    return [
      this.invoiceConsumerFinal,
      {
        code: `RSV-${this.room().reservationNumber}`,
        name: `${this.room().agency} / ${this.room().reservationNumber}`,
        document: this.room().reservationNumber,
        address: `Reserva de habitacion ${this.room().roomNumber}`,
        email: ''
      },
      ...guestClients
    ];
  });
  readonly filteredInvoiceClients = computed(() => {
    const term = this.invoiceClientSearch().trim().toLowerCase();

    if (!term) {
      return this.invoiceClients().slice(0, 4);
    }

    return this.invoiceClients().filter((client) =>
      [client.name, client.code, client.document].some((field) => field.toLowerCase().includes(term))
    );
  });
  readonly invoiceClient = computed(() => this.selectedInvoiceClient() ?? this.invoiceConsumerFinal);
  readonly invoiceSubtotal = computed(() => this.roundCurrency(this.totalToCharge() / 1.18));
  readonly invoiceTaxes = computed(() => this.roundCurrency(this.totalToCharge() - this.invoiceSubtotal()));
  readonly invoiceTip = computed(() => 0);
  readonly invoiceTotal = computed(() => this.roundCurrency(this.invoiceSubtotal() + this.invoiceTaxes() + this.invoiceTip()));
  readonly invoicePaid = computed(() =>
    this.roundCurrency(this.invoiceAppliedPayments().reduce((sum, payment) => sum + payment.amount, 0))
  );
  readonly invoicePending = computed(() => this.roundCurrency(Math.max(this.invoiceTotal() - this.invoicePaid(), 0)));
  readonly invoiceChange = computed(() => this.roundCurrency(Math.max(this.invoicePaid() - this.invoiceTotal(), 0)));
  readonly invoiceCanConfirm = computed(() => this.invoiceAppliedPayments().length > 0 && this.invoicePaid() >= this.invoiceTotal());

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly toastService: ToastService
  ) {
    const roomNumber = this.route.snapshot.paramMap.get('roomNumber') ?? rooms[0].roomNumber;
    const navigationRoom = this.getNavigationRoom();

    if (navigationRoom) {
      this.room.set(this.buildRoomFromRackData(navigationRoom, roomNumber));
      return;
    }

    const selectedRoom = rooms.find((item) => item.roomNumber === roomNumber);
    this.room.set(selectedRoom ?? this.buildRoomFromNumber(roomNumber));
  }

  setActiveTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  backToRoomRack(): void {
    this.router.navigate(['/front-desk/room-rack']);
  }

  openActionModal(action: StayOperation): void {
    this.actionDraft.set(this.buildActionDraft(action.id));
    if (action.id === 'invoice-room') {
      this.resetInvoiceDraft();
    }
    this.activeAction.set(action);
  }

  closeActionModal(): void {
    this.invoiceValidationMessage.set('');
    this.activeAction.set(null);
  }

  updateActionDraft(patch: Partial<ActionModalDraft>): void {
    this.actionDraft.update((currentDraft) => ({ ...currentDraft, ...patch }));
  }

  onTargetRoomChange(targetRoom: string): void {
    const selectedRoom = this.roomOptions().find((option) => option.number === targetRoom);

    this.updateActionDraft({
      targetRoom,
      targetRoomType: selectedRoom?.type ?? this.actionDraft().targetRoomType
    });
  }

  executeActiveAction(): void {
    const action = this.activeAction();

    if (!action) {
      return;
    }

    let shouldClose = true;

    switch (action.id) {
      case 'change-room':
        this.applyRoomChange();
        break;
      case 'change-departure':
        this.applyDepartureChange();
        break;
      case 'register-prepayment':
        this.applyPrepaymentRegistration();
        break;
      case 'refresh-charges':
        this.applyChargeRefresh();
        break;
      case 'new-charge':
        this.applyNewCharge();
        break;
      case 'transfer-charges':
        this.applyChargeTransfer();
        break;
      case 'print-room-charge':
        this.applyDocumentAction('Cargo de habitacion preparado');
        break;
      case 'print-statement':
        this.applyDocumentAction('Estado de cuenta preparado');
        break;
      case 'invoice-room':
        shouldClose = this.applyRoomInvoiceAction();
        break;
      case 'check-out':
        this.applyCheckOutFlow();
        break;
      default:
        break;
    }

    if (shouldClose) {
      this.closeActionModal();
    }
  }

  isActionSelected(actionId: StayActionId): boolean {
    return this.activeAction()?.id === actionId;
  }

  trackByLabel(_: number, item: { label: string }): string {
    return item.label;
  }

  trackByCharge(_: number, item: Charge): string {
    return `${item.date}-${item.time}-${item.reference}`;
  }

  formatHeaderDate(date: string): string {
    const [day, month, year] = date.split('/');
    const monthName = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][Number(month) - 1] ?? month;
    return `${Number(day)} ${monthName} ${year}`;
  }

  formatCurrency(amount: number): string {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  onInvoiceClientSearchChange(value: string): void {
    this.invoiceClientSearch.set(value);
  }

  selectInvoiceClient(client: InvoiceClient): void {
    this.selectedInvoiceClient.set(client);
    this.invoiceClientSearch.set(client.name);
  }

  clearInvoiceClient(): void {
    this.selectedInvoiceClient.set(null);
    this.invoiceClientSearch.set('');
  }

  updateInvoicePaymentDraft(patch: Partial<InvoicePaymentDraft>): void {
    this.invoicePaymentDraft.update((currentDraft) => ({ ...currentDraft, ...patch }));
  }

  addInvoicePayment(): void {
    const draft = this.invoicePaymentDraft();
    const method = this.invoicePaymentMethods().find((item) => item.code === draft.methodCode);
    const amount = this.roundCurrency(Number(draft.amount || 0));

    this.invoiceValidationMessage.set('');

    if (!method) {
      this.invoiceValidationMessage.set('Selecciona una forma de pago.');
      return;
    }

    if (amount <= 0) {
      this.invoiceValidationMessage.set('El monto debe ser mayor a 0.');
      return;
    }

    this.invoiceAppliedPayments.update((payments) => [
      ...payments,
      {
        methodCode: method.code,
        description: method.description,
        reference: draft.reference.trim(),
        amount,
        order: payments.length + 1
      }
    ]);

    this.invoicePaymentDraft.set({
      methodCode: draft.methodCode,
      amount: this.invoicePending() > 0 ? this.invoicePending() : null,
      reference: ''
    });
  }

  removeInvoicePayment(order: number): void {
    this.invoiceAppliedPayments.update((payments) =>
      payments
        .filter((payment) => payment.order !== order)
        .map((payment, index) => ({ ...payment, order: index + 1 }))
    );
  }

  viewInvoiceChargeDetail(): void {
    this.activeTab.set('account');
    this.toastService.info('Se abrio el detalle financiero de la estancia.', 3000, 'Facturacion');
  }

  private sumCharges(charges: Charge[]): number {
    return charges.reduce((total, item) => total + item.charge - item.payment, 0);
  }

  private resetInvoiceDraft(): void {
    this.selectedInvoiceClient.set(null);
    this.invoiceClientSearch.set('');
    this.invoiceAppliedPayments.set([]);
    this.invoiceValidationMessage.set('');
    this.invoicePaymentDraft.set({
      methodCode: 'cash',
      amount: this.invoiceTotal(),
      reference: ''
    });
  }

  private buildActionDraft(actionId?: StayActionId): ActionModalDraft {
    const room = this.room();
    const roomOptions = this.buildRoomOptions(room.roomNumber);
    const firstOption = roomOptions[0];
    const currentBalance = this.sumCharges(room.lodgingCharges) + this.sumCharges(room.extraCharges) - room.prepaid;

    return {
      targetRoom: firstOption?.number ?? room.roomNumber,
      targetRoomType: firstOption?.type ?? room.roomType,
      newCheckOut: this.toInputDate(room.checkOut),
      prepaymentAmount: Math.max(Math.round(currentBalance * 0.35), 25),
      chargeConcept: actionId === 'new-charge' ? 'Cargo operativo manual' : 'Ajuste operativo',
      chargeAmount: 45,
      chargeBucket: actionId === 'new-charge' ? 'extras' : 'lodging',
      destinationFolio: `${room.masterFolio}-AUX`,
      notes: '',
      documentFormat: 'pdf'
    };
  }

  private buildRoomOptions(currentRoomNumber: string): RoomOption[] {
    const seed = Number(currentRoomNumber) || 100;
    const roomTypes = ['Standard Room', 'Junior Suite', 'Deluxe Room', 'Master Suite'];

    return [1, 2, 3].map((offset) => {
      const nextRoomNumber = String(seed + offset);

      return {
        number: nextRoomNumber,
        type: roomTypes[(seed + offset) % roomTypes.length]
      };
    });
  }

  private applyRoomChange(): void {
    const draft = this.actionDraft();

    this.room.update((currentRoom) => ({
      ...currentRoom,
      roomNumber: draft.targetRoom,
      roomType: draft.targetRoomType,
      observations: [
        `Cambio de habitacion preparado hacia ${draft.targetRoom} (${draft.targetRoomType}).`,
        ...currentRoom.observations
      ]
    }));

    this.addTimelineEntry('Cambio de habitacion', `Se preparo el traslado a la habitacion ${draft.targetRoom}.`);
    this.toastService.success(`Cambio de habitacion preparado para ${draft.targetRoom}.`, 4000, 'Estancia');
  }

  private applyDepartureChange(): void {
    const draft = this.actionDraft();
    const formattedCheckOut = this.fromInputDate(draft.newCheckOut);

    this.room.update((currentRoom) => ({
      ...currentRoom,
      checkOut: formattedCheckOut,
      nights: this.calculateNights(currentRoom.checkIn, formattedCheckOut),
      observations: [`Salida ajustada para ${formattedCheckOut}.`, ...currentRoom.observations]
    }));

    this.addTimelineEntry('Salida reprogramada', `Nueva fecha de salida: ${formattedCheckOut}.`);
    this.toastService.info(`La salida fue actualizada a ${formattedCheckOut}.`, 4000, 'Reserva');
  }

  private applyPrepaymentRegistration(): void {
    const draft = this.actionDraft();

    this.room.update((currentRoom) => ({
      ...currentRoom,
      prepaid: currentRoom.prepaid + draft.prepaymentAmount,
      observations: [
        `Prepago registrado por ${this.formatCurrency(draft.prepaymentAmount)}. ${draft.notes || 'Pendiente conciliacion operativa.'}`,
        ...currentRoom.observations
      ]
    }));

    this.addTimelineEntry('Prepago registrado', `Abono manual por ${this.formatCurrency(draft.prepaymentAmount)} aplicado a la estancia.`);
    this.toastService.success('Prepago registrado en la estancia.', 4000, 'Caja');
  }

  private applyChargeRefresh(): void {
    const refreshCharge: Charge = {
      date: this.todayDisplayDate(),
      time: this.currentTimeLabel(),
      concept: 'Sincronizacion de folio',
      reference: this.room().masterFolio,
      charge: 0,
      payment: 0,
      balance: this.totalToCharge()
    };

    this.room.update((currentRoom) => ({
      ...currentRoom,
      lodgingCharges: [refreshCharge, ...currentRoom.lodgingCharges],
      observations: ['Folio operativo sincronizado manualmente desde acciones.', ...currentRoom.observations]
    }));

    this.addTimelineEntry('Cargos actualizados', 'Se ejecuto una sincronizacion operativa del folio.');
    this.toastService.info('Folio sincronizado correctamente.', 3500, 'Cargos');
  }

  private applyNewCharge(): void {
    const draft = this.actionDraft();
    const currentBalance = this.totalToCharge() + draft.chargeAmount;
    const newCharge: Charge = {
      date: this.todayDisplayDate(),
      time: this.currentTimeLabel(),
      concept: draft.chargeConcept,
      reference: draft.chargeBucket === 'lodging' ? this.room().masterFolio : `EXT-${this.room().roomNumber}`,
      charge: draft.chargeAmount,
      payment: 0,
      balance: currentBalance
    };

    this.room.update((currentRoom) => ({
      ...currentRoom,
      lodgingCharges: draft.chargeBucket === 'lodging' ? [newCharge, ...currentRoom.lodgingCharges] : currentRoom.lodgingCharges,
      extraCharges: draft.chargeBucket === 'extras' ? [newCharge, ...currentRoom.extraCharges] : currentRoom.extraCharges,
      observations: [
        `Cargo manual agregado: ${draft.chargeConcept} por ${this.formatCurrency(draft.chargeAmount)}.`,
        ...currentRoom.observations
      ]
    }));

    this.addTimelineEntry('Nuevo cargo manual', `${draft.chargeConcept} agregado al folio por ${this.formatCurrency(draft.chargeAmount)}.`);
    this.toastService.success('Cargo manual agregado al folio.', 4000, 'Cargos');
  }

  private applyChargeTransfer(): void {
    const draft = this.actionDraft();
    const transferCharge: Charge = {
      date: this.todayDisplayDate(),
      time: this.currentTimeLabel(),
      concept: `Transferencia a ${draft.destinationFolio}`,
      reference: draft.destinationFolio,
      charge: 0,
      payment: draft.chargeAmount,
      balance: Math.max(this.totalToCharge() - draft.chargeAmount, 0)
    };

    this.room.update((currentRoom) => ({
      ...currentRoom,
      extraCharges: [transferCharge, ...currentRoom.extraCharges],
      observations: [
        `Transferencia operativa por ${this.formatCurrency(draft.chargeAmount)} hacia ${draft.destinationFolio}.`,
        ...currentRoom.observations
      ]
    }));

    this.addTimelineEntry('Transferencia de cargos', `Monto enviado al folio ${draft.destinationFolio}.`);
    this.toastService.warning('Transferencia operativa registrada.', 4000, 'Folio');
  }

  private applyDocumentAction(title: string): void {
    const action = this.activeAction();
    const draft = this.actionDraft();

    this.addTimelineEntry(title, `${action?.label ?? 'Documento'} en formato ${draft.documentFormat.toUpperCase()} listo para salida.`);
    this.toastService.info(`${title} en formato ${draft.documentFormat.toUpperCase()}.`, 3500, 'Documentos');
  }

  private applyRoomInvoiceAction(): boolean {
    if (!this.invoiceCanConfirm()) {
      this.invoiceValidationMessage.set(
        this.invoiceAppliedPayments().length === 0
          ? 'Agrega al menos una forma de pago para confirmar la facturacion.'
          : 'El total pagado debe cubrir el total de la cuenta.'
      );

      return false;
    }

    const billedClient = this.invoiceClient();

    this.room.update((currentRoom) => ({
      ...currentRoom,
      observations: [
        `Facturacion preparada para ${billedClient.name} por ${this.formatCurrency(this.invoiceTotal())}.`,
        ...currentRoom.observations
      ]
    }));

    this.addTimelineEntry(
      'Facturacion preparada',
      `Documento listo para ${billedClient.name} con ${this.invoiceAppliedPayments().length} forma(s) de pago.`
    );
    this.toastService.success('Facturacion de habitacion preparada correctamente.', 4000, 'Documentos');

    return true;
  }

  private applyCheckOutFlow(): void {
    this.room.update((currentRoom) => ({
      ...currentRoom,
      observations: [
        `Proceso de check out iniciado con saldo pendiente de ${this.formatCurrency(this.currentBalance())}.`,
        ...currentRoom.observations
      ]
    }));

    this.addTimelineEntry('Check out en preparacion', 'Se genero la verificacion final de cargos y documentos.');
    this.activeTab.set('timeline');
    this.toastService.warning('Se inicio el flujo previo de Check Out.', 4500, 'Salida');
  }

  private addTimelineEntry(title: string, detail: string): void {
    this.timeline.update((currentTimeline) => [{ time: this.currentTimeLabel(), title, detail }, ...currentTimeline]);
  }

  private currentTimeLabel(): string {
    return new Intl.DateTimeFormat('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  }

  private todayDisplayDate(): string {
    const now = new Date();
    const day = `${now.getDate()}`.padStart(2, '0');
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const year = now.getFullYear();

    return `${day}/${month}/${year}`;
  }

  private toInputDate(date: string): string {
    const [day, month, year] = date.split('/');

    if (!day || !month || !year) {
      return '';
    }

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  private fromInputDate(date: string): string {
    const [year, month, day] = date.split('-');

    if (!year || !month || !day) {
      return this.room().checkOut;
    }

    return `${day}/${month}/${year}`;
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    const checkInDate = this.parseDisplayDate(checkIn);
    const checkOutDate = this.parseDisplayDate(checkOut);

    if (!checkInDate || !checkOutDate) {
      return this.room().nights;
    }

    const diffInMs = checkOutDate.getTime() - checkInDate.getTime();
    const diffInDays = Math.round(diffInMs / 86400000);

    return diffInDays > 0 ? diffInDays : this.room().nights;
  }

  private parseDisplayDate(date: string): Date | null {
    const [day, month, year] = date.split('/').map(Number);

    if (!day || !month || !year) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  private roundCurrency(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  private getNavigationRoom(): RoomRackNavigationState | null {
    const currentNavigationState = this.router.getCurrentNavigation()?.extras.state?.['roomRackRoom'] as
      | RoomRackNavigationState
      | undefined;
    const historyNavigationState = history.state?.roomRackRoom as RoomRackNavigationState | undefined;

    return currentNavigationState ?? historyNavigationState ?? null;
  }

  private buildRoomFromRackData(roomData: RoomRackNavigationState, fallbackRoomNumber: string): RoomStay {
    const roomNumber = String(roomData.CR05_NumHab || fallbackRoomNumber);
    const fallback = this.buildRoomFromNumber(roomNumber);
    const roomType = roomData.CR05_Descripcion || roomData.CR05_TipoHab || roomData.CR05_CateHab || fallback.roomType;
    const guestsCount = Number(roomData.CR05_NumPax) || fallback.guestsCount;
    const rate = roomData.CR05_CateHab || roomData.CR05_TipoHab || fallback.rate;
    const reservationNumber = roomData.RSV || fallback.reservationNumber;

    return {
      ...fallback,
      roomNumber,
      roomType,
      agency: roomData.CR05_CodGrp || fallback.agency,
      rate,
      reservationNumber,
      guestsCount,
      observations: this.buildRackObservations(roomData, roomType, guestsCount, reservationNumber)
    };
  }

  private buildRackObservations(
    roomData: RoomRackNavigationState,
    roomType: string,
    guestsCount: number,
    reservationNumber: string
  ): string[] {
    return [
      `Tipo asignado: ${roomType}.`,
      `Estado actual en rack: ${this.mapRackStatus(roomData.CR05_EstHab)}.`,
      `Condicion de limpieza: ${this.mapRackCleanStatus(roomData.CR05_Clean)}.`,
      `Capacidad/Pax registrados: ${guestsCount}.`,
      reservationNumber ? `Reserva asociada: ${reservationNumber}.` : '',
      roomData.CR05_Anexo ? `Anexo o ubicacion operativa: ${roomData.CR05_Anexo}.` : '',
      roomData.CR05_Activo ? `Habitacion ${roomData.CR05_Activo === 'S' ? 'activa' : 'inactiva'} en el inventario.` : ''
    ].filter((item) => item.length > 0);
  }

  private mapRackStatus(status: string): string {
    switch (status) {
      case 'O':
        return 'Ocupada';
      case 'D':
        return 'Disponible';
      case 'B':
        return 'Bloqueada';
      default:
        return status || 'No definido';
    }
  }

  private mapRackCleanStatus(status: string): string {
    switch (status) {
      case 'S':
        return 'Sucia';
      case 'L':
        return 'Limpia';
      default:
        return status || 'No definida';
    }
  }

  private buildRoomFromNumber(roomNumber: string): RoomStay {
    const seed = Number(roomNumber) || 1;
    const template = rooms[seed % rooms.length];
    const roomTypes = ['Standard Room', 'Junior Suite', 'Deluxe Room', 'Master Suite'];
    const baseCharge = 90 + (seed % 5) * 25;
    const prepaid = seed % 2 === 0 ? 80 : 120;

    return {
      ...template,
      roomNumber,
      roomType: roomTypes[seed % roomTypes.length],
      reservationNumber: `EE25015${String(seed).padStart(4, '0')}`,
      masterFolio: `TR${String(seed).padStart(5, '0')}`,
      nights: 2 + (seed % 3),
      guestsCount: 1 + (seed % 3),
      childrenCount: seed % 2,
      prepaid,
      observations: [
        `Habitacion ${roomNumber} con informacion mock operativa.`,
        seed % 2 === 0 ? 'Prepagada parcialmente por agencia.' : 'Solicita cama adicional segun disponibilidad.',
        'Pendiente validar preferencias al cierre del turno.'
      ],
      guests: template.guests.map((guest, index) => ({
        ...guest,
        documentType: guest.documentType,
        document: `${guest.document}-${roomNumber}-${index + 1}`
      })),
      lodgingCharges: [
        { date: '16/06/2026', time: '15:05', concept: 'Room Charge', reference: `TR-${roomNumber}`, charge: baseCharge, payment: 0, balance: baseCharge },
        { date: '17/06/2026', time: '08:40', concept: 'Breakfast', reference: `BF-${roomNumber}`, charge: 24 + (seed % 4) * 3, payment: 0, balance: baseCharge + 24 },
        { date: '17/06/2026', time: '13:15', concept: 'Lunch', reference: `LN-${roomNumber}`, charge: 36 + (seed % 5) * 4, payment: 0, balance: baseCharge + 60 }
      ],
      extraCharges: [
        { date: '17/06/2026', time: '15:30', concept: 'Spa', reference: `SPA-${roomNumber}`, charge: 60 + (seed % 4) * 15, payment: 0, balance: baseCharge + 120 },
        { date: '17/06/2026', time: '18:45', concept: 'Laundry', reference: `LND-${roomNumber}`, charge: 18 + (seed % 3) * 5, payment: 0, balance: baseCharge + 145 },
        { date: '18/06/2026', time: '09:10', concept: 'Transfer', reference: `TRF-${roomNumber}`, charge: 25 + (seed % 4) * 5, payment: 0, balance: baseCharge + 180 }
      ]
    };
  }
}
