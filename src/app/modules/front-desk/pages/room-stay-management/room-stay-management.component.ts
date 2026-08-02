import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Subject, firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { ToastService } from 'src/app/core/services/toast.service';
import {
  differenceInPmsCalendarDays,
  normalizePmsDateDDMMYYYY,
  normalizePmsDateInputDDMMYYYY,
  parsePmsDate,
  toPmsDateInputValue
} from 'src/app/core/utils/pms-date.util';
import { ClienteService, SelectOption } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.service';
import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';
import { MonedaService, MonedaUI } from 'src/app/demo/administracion/monedas/moneda.service';
import { TipoCambio, TipoCambioService } from 'src/app/demo/administracion/tipo-cambio/tipo-cambio.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { Nationality } from '../../settings/nationalities/models/nationality.model';
import { NationalitiesService } from '../../settings/nationalities/services/nationalities.service';
import { PaxType } from '../../settings/pax-types/models/pax-type.model';
import { PaxTypesService } from '../../settings/pax-types/services/pax-types.service';
import { RoomRackNavigationState } from '../room-rack/models/room-rack-room.model';
import { buildRoomChargeUpdatePayload } from '../../shared/room-charges/room-charge-payload.util';
import { RoomChargePdfService } from './printing/room-charge-pdf.service';
import { RoomChargePosPrintService } from './printing/room-charge-pos-print.service';
import { RoomStatementPdfService } from './printing/room-statement-pdf.service';
import { RoomStatementPosService } from './printing/room-statement-pos.service';
import {
  DepartureDateChangePayload,
  PointOfSaleDocumentApi,
  PointOfSalePaymentMethodApi,
  RoomChargePayload,
  RoomChargeAnnulPayload,
  RoomChargeLookupDetail,
  RoomChargeLookupResponse,
  RoomChargePointOfSaleApi,
  RoomChargePriceListApiItem,
  RoomAvailabilityApiRoom,
  RoomInvoicePayload,
  RoomingListUpdatePayload,
  RoomChangePayload,
  RoomCheckoutPayload,
  RoomCheckoutResponse,
  RoomStayCommentsPayload,
  RoomStayApiCharge,
  RoomStayApiData,
  RoomStayManagementService
} from './services/room-stay-management.service';

function pmsDateInputValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value?.trim();
  return !value || normalizePmsDateInputDDMMYYYY(value) ? null : { pmsDate: true };
}

type ActiveTab      = 'stay' | 'account' | 'operations' | 'timeline';
type OperationKind  = 'workflow' | 'financial' | 'document' | 'critical';
type ChargeBucket   = 'lodging' | 'extras';
type DocumentFormat = 'pdf' | 'print';
type StayActionId   =
  | 'change-room'
  | 'change-departure'
  | 'register-prepayment'
  | 'new-charge'
  | 'transfer-charges'
  | 'print-statement'
  | 'invoice-room'
  | 'check-out';

interface Guest {
  name            : string;
  documentType    : string;
  document        : string;
  nationality     : string;
  birthDate       : string;
}

interface Charge {
  id                : string;
  tipCrgHab         : string;
  numCrgHab         : string;
  codRsv            : string;
  numHab            : string;
  date              : string;
  time              : string;
  concept           : string;
  reference         : string;
  charge            : number;
  payment           : number;
  balance           : number;
  invoiceSelected   : boolean;
}

interface StayOperation {
  id              : StayActionId;
  label           : string;
  icon            : string;
  kind            : OperationKind;
  description     : string;
  confirmText     : string;
  tone            ?: 'primary' | 'danger';
}

interface OperationGroup {
  title           : string;
  actions         : StayOperation[];
}

interface TimelineItem {
  time            : string;
  title           : string;
  detail          : string;
}

interface InvoiceClient {
  code            : string;
  name            : string;
  document        : string;
  address         : string;
  email           ?: string;
  enviarCorreo    : boolean;
}

interface InvoicePaymentMethod {
  code            : string;
  description     : string;
  tipo            : string;
  tipPago         : string;
  ndias           : number;
}

interface InvoiceAppliedPayment {
  frmPago         : string;
  tipo            : string;
  numTarjeta      : string;
  moneda          : string;
  monto           : number;
  vencimiento     : string;
  mtoTotal        : number;
  tCambio         : number;
  rateDate        : string;
  orden           : number;
  description     : string;
}

interface RoomOption {
  number          : string;
  type            : string;
}

interface ActionModalDraft {
  targetRoom             : string;
  targetRoomType         : string;
  newCheckOut            : string;
  prepaymentAmount       : number;
  chargeConcept          : string;
  chargeAmount           : number;
  chargeBucket           : ChargeBucket;
  destinationFolio       : string;
  notes                  : string;
  documentFormat         : DocumentFormat;
}

interface InvoicePaymentDraft {
  methodCode              : string;
  moneda                  : string;
  amount                  : number | null;
  numTarjeta              : string;
  vencimiento             : string;
  tCambio                 : number;
}

interface RoomChargeGuestOption {
  name                    : string;
  document                : string;
  documentType            : string;
}

interface RoomChargePointOfSale {
  code          : string;
  name          : string;
  priceList     : string;
  currency      : string;
}

interface RoomChargeDraft {
  guestDocument   : string;
  pointOfSale     : string;
  priceList       : string;
  currency        : string;
  itemSearch      : string;
  comment         : string;
}

interface RoomChargeLine {
  id              : string;
  group           : string;
  category        : string;
  code            : string;
  name            : string;
  quantity        : number;
  price           : number;
  total           : number;
  currency        : string;
  order           : number;
  comment         : string;
}

interface ChargeDetailSelection {
  bucket          : ChargeBucket;
  charge          : Charge;
}

interface ChargeDetailActionState {
  orden           : number;
  action          : 'edit' | 'annul' | 'transfer';
}

interface RoomStay {
  roomNumber            : string;
  roomType              : string;
  roomCategory          : string;
  status                : 'OCCUPIED';
  agency                : string;
  rate                  : string;
  reservationNumber     : string;
  checkIn               : string;
  checkOut              : string;
  nights                : number;
  guestsCount           : number;
  childrenCount         : number;
  masterFolio           : string;
  plan                  : string;
  reservedAt            : string;
  observations          : string[];
  comments              : string;
  guests                : Guest[];
  lodgingCharges        : Charge[];
  extraCharges          : Charge[];
  prepaid               : number;
  operator              ?: string;
}

interface ExtraGuestForm {
  tipDocu           : FormControl<string>;
  numDocu           : FormControl<string>;
  codNacion         : FormControl<string>;
  nombre            : FormControl<string>;
  apellido          : FormControl<string>;
  fecNac            : FormControl<string>;
  sexo              : FormControl<string>;
  estCivil          : FormControl<string>;
  tiPax             : FormControl<string>;
  direccion         : FormControl<string>;
  email             : FormControl<string>;
  motivo            : FormControl<string>;
  procede           : FormControl<string>;
  mdoArribo         : FormControl<string>;
}

interface RoomGuestOption {
  codigo            : string;
  descripcion       : string;
}

const emptyRoomStay: RoomStay = {
  roomNumber            : '',
  roomType              : '',
  roomCategory          : '',
  status                : 'OCCUPIED',
  agency                : '',
  rate                  : '',
  reservationNumber     : '',
  checkIn               : '',
  checkOut              : '',
  nights                : 0,
  guestsCount           : 0,
  childrenCount         : 0,
  masterFolio           : '',
  plan                  : '',
  reservedAt            : '',
  observations          : [],
  comments              : '',
  guests                : [],
  lodgingCharges        : [],
  extraCharges          : [],
  prepaid               : 0
};

@Component({
  selector: 'app-room-stay-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule, CdkScrollable],
  templateUrl: './room-stay-management.component.html',
  styleUrls: ['./room-stay-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomStayManagementComponent implements OnInit {
  private readonly fb                             = inject(NonNullableFormBuilder);
  private readonly destroyRef                     = inject(DestroyRef);
  private readonly authService                    = inject(AuthService);
  private readonly operationalDateService         = inject(OperationalDateService);
  private readonly roomStayManagementService      = inject(RoomStayManagementService);
  private readonly roomChargePdfService            = inject(RoomChargePdfService);
  private readonly roomChargePosPrintService       = inject(RoomChargePosPrintService);
  private readonly roomStatementPdfService         = inject(RoomStatementPdfService);
  private readonly roomStatementPosService         = inject(RoomStatementPosService);
  private readonly clienteService                 = inject(ClienteService);
  private readonly nationalitiesService           = inject(NationalitiesService);
  private readonly paxTypesService                = inject(PaxTypesService);
  private readonly monedaService                  = inject(MonedaService);
  private readonly tipoCambioService              = inject(TipoCambioService);
  private readonly invoiceBaseCurrency            = 'USD';
  private readonly roomChargeCatalogPageSize      = 8;
  private readonly invoiceClientSearchChanges     = new Subject<string>();
  private requestedRoomNumber                     = '';
  private requestedReservationNumber              = '';
  private invoiceExchangeRateRequestId             = 0;

  private readonly invoiceConsumerFinal: InvoiceClient = {
    code          : '000000000',
    name          : 'CLIENTE EN GENERAL',
    document      : '0000000000',
    address       : 'S/D',
    email         : '',
    enviarCorreo  : false
  };

  readonly activeTab                             = signal<ActiveTab>('stay');
  readonly room                                  = signal<RoomStay>({ ...emptyRoomStay });
  readonly isStayLoading                         = signal(false);
  readonly stayErrorMessage                      = signal('');
  readonly isCommentsEditing                     = signal(false);
  readonly isCommentsSaving                      = signal(false);
  readonly commentsDraft                         = signal('');
  readonly commentsErrorMessage                  = signal('');
  readonly availableRoomOptions                  = signal<RoomOption[]>([]);
  readonly isAvailableRoomsLoading               = signal(false);
  readonly availableRoomsLoaded                  = signal(false);
  readonly isRoomChangeSubmitting                = signal(false);
  readonly isDepartureChangeSubmitting           = signal(false);
  readonly isCheckoutSubmitting                  = signal(false);
  readonly isCriticalStayRefreshing              = signal(false);
  readonly isStatementGenerating                 = signal(false);
  readonly isRoomChargeCatalogLoading            = signal(false);
  readonly isRoomChargeItemsLoading              = signal(false);
  readonly isRoomChargeSubmitting                = signal(false);
  readonly roomChargeDocumentJobs                = signal<Record<string, 'pdf' | 'pos'>>({});
  readonly isChargeDetailOpen                    = signal(false);
  readonly isChargeDetailLoading                 = signal(false);
  readonly chargeDetailErrorMessage              = signal('');
  readonly selectedChargeDetail                  = signal<RoomChargeLookupResponse | null>(null);
  private readonly originalSelectedChargeDetail  = signal<RoomChargeLookupResponse | null>(null);
  readonly selectedChargeDetailSource            = signal<ChargeDetailSelection | null>(null);
  readonly chargeDetailAction                    = signal<ChargeDetailActionState | null>(null);
  readonly isChargeDetailSubmitting              = signal(false);
  readonly showExtraGuestModal                   = signal(false);
  readonly isExtraGuestCatalogLoading            = signal(false);
  readonly isExtraGuestSaving                    = signal(false);
  readonly extraGuestValidationMessage           = signal('');
  readonly extraGuestNationalitySearch           = signal('');
  readonly isExtraGuestNationalitySearchOpen     = signal(false);
  readonly extraGuestDocumentTypes               = signal<RoomGuestOption[]>([]);
  readonly extraGuestNationalities               = signal<Nationality[]>([]);
  readonly extraGuestPaxTypes                    = signal<PaxType[]>([]);
  readonly activeAction                          = signal<StayOperation | null>(null);
  readonly actionDraft                           = signal<ActionModalDraft>(this.buildActionDraft());
  readonly roomChargeDraft                       = signal<RoomChargeDraft>(this.buildRoomChargeDraft());
  readonly roomChargePointOfSales                = signal<RoomChargePointOfSale[]>([]);
  readonly roomChargeItems                       = signal<RoomChargePriceListApiItem[]>([]);
  readonly roomChargeLines                       = signal<RoomChargeLine[]>([]);
  readonly roomChargeCatalogPage                 = signal(1);
  readonly roomChargeValidationMessage           = signal('');
  readonly timeline                              = signal<TimelineItem[]>([]);
  readonly invoiceClientSearch                   = signal('');
  readonly invoiceCatalogClients                 = signal<InvoiceClient[]>([]);
  readonly isInvoiceClientSearchLoading          = signal(false);
  readonly invoiceClientSearchError              = signal('');
  readonly selectedInvoiceClient                 = signal<InvoiceClient | null>(null);
  readonly invoiceAppliedPayments                = signal<InvoiceAppliedPayment[]>([]);
  readonly invoicePaymentDraft                   = signal<InvoicePaymentDraft>({
    methodCode      : '',
    moneda          : this.invoiceBaseCurrency,
    amount          : null,
    numTarjeta      : '00000',
    vencimiento     : '00/00',
    tCambio         : 1
  });
  readonly isInvoicePaymentAmountEditing         = signal(false);
  readonly invoicePaymentAmountText              = signal('');
  readonly invoiceValidationMessage         = signal('');
  readonly invoiceCurrencies                = signal<MonedaUI[]>([]);
  readonly invoiceUsdExchangeRate           = signal<TipoCambio | null>(null);
  readonly invoiceSelectedExchangeRate      = signal<TipoCambio | null>(null);
  readonly invoicePointOfSaleDocuments      = signal<PointOfSaleDocumentApi[]>([]);
  readonly isInvoiceDocumentsLoading        = signal(false);
  readonly invoiceDocumentSelectionError    = signal('');
  readonly isInvoiceCatalogLoading          = signal(false);
  readonly isInvoiceExchangeRateLoading     = signal(false);
  readonly isInvoiceSubmitting              = signal(false);
  readonly roomOptions                      = computed(() =>
    this.availableRoomsLoaded() || this.isAvailableRoomsLoading() ? this.availableRoomOptions() : this.buildRoomOptions(this.room().roomNumber)
  );
  readonly activeActionKind                 = computed(() => this.activeAction()?.kind ?? 'workflow');
  readonly invoicePaymentMethods            = signal<InvoicePaymentMethod[]>([]);
  readonly invoiceCurrencyOptions           = computed(() =>
    this.invoiceCurrencies().length
      ? this.invoiceCurrencies()
      : [
          {
            codMoneda: this.invoiceBaseCurrency,
            moneda: 'DOLAR',
            simbolo: '$',
            activo: 1,
            primario: 0,
            secundario: 1,
            orden: 1
          }
        ]
  );
  readonly filteredExtraGuestNationalities = computed(() => {
    const term = this.normalizeSearchTerm(this.extraGuestNationalitySearch());
    const nationalities = this.extraGuestNationalities();

    if (!term) {
      return nationalities.slice(0, 12);
    }

    return nationalities
      .filter((nationality) =>
        [nationality.CR06_Codigo, nationality.CR06_Descripcion]
          .map((value) => this.normalizeSearchTerm(value))
          .some((value) => value.includes(term))
      )
      .slice(0, 12);
  });

  readonly extraGuestForm: FormGroup<ExtraGuestForm> = this.fb.group({
    tipDocu         : this.fb.control('', { validators: [Validators.required] }),
    numDocu         : this.fb.control('', { validators: [Validators.required, Validators.maxLength(30)] }),
    codNacion       : this.fb.control('', { validators: [Validators.required] }),
    nombre          : this.fb.control('', { validators: [Validators.required, Validators.maxLength(80)] }),
    apellido        : this.fb.control('', { validators: [Validators.required, Validators.maxLength(120)] }),
    fecNac          : this.fb.control('', { validators: [Validators.required, pmsDateInputValidator] }),
    sexo            : this.fb.control(''),
    estCivil        : this.fb.control(''),
    tiPax           : this.fb.control('', { validators: [Validators.required] }),
    direccion       : this.fb.control('', { validators: [Validators.maxLength(220)] }),
    email           : this.fb.control('', { validators: [Validators.email, Validators.maxLength(120)] }),
    motivo          : this.fb.control(''),
    procede         : this.fb.control(''),
    mdoArribo       : this.fb.control('')
  });

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
          id              : 'change-room',
          label           : 'Cambiar Habitacion',
          icon            : 'hotel',
          kind            : 'workflow',
          description     : 'Prepara el cambio operativo de la estancia hacia otra habitacion disponible.',
          confirmText     : 'Preparar cambio',
          tone            : 'primary'
        },
        {
          id              : 'change-departure',
          label           : 'Cambiar Fecha Salida',
          icon            : 'event',
          kind            : 'workflow',
          description     : 'Permite extender o ajustar la salida de la reserva con una vista previa del impacto.',
          confirmText     : 'Actualizar salida'
        },
        {             
          id              : 'register-prepayment',
          label           : 'Registrar Prepago',
          icon            : 'attach_money',
          kind            : 'financial',
          description     : 'Registra un prepago operativo para dejar trazabilidad del abono recibido.',
          confirmText     : 'Registrar prepago'
        }
      ]
    },
    {
      title: 'Gestion de Cargos',
      actions: [
        {
          id              : 'new-charge',
          label           : 'Nuevo Cargo',
          icon            : 'add_circle',
          kind            : 'financial',
          description     : 'Registra un cargo manual y lo agrega al bloque correspondiente del folio.',
          confirmText     : 'Agregar cargo',
          tone            : 'danger'
        },
        {
          id              : 'transfer-charges',
          label           : 'Transferir Cargos',
          icon            : 'compare_arrows',
          kind            : 'financial',
          description     : 'Mueve un monto a otro folio para representar una transferencia operativa.',
          confirmText     : 'Transferir cargos'
        }
      ]
    },
    {
      title: 'Documentos',
      actions: [
        {
          id            : 'print-statement',
          label         : 'Imprimir Estado Cuenta',
          icon          : 'receipt',
          kind          : 'document',
          description   : 'Previsualiza un estado de cuenta resumido antes de imprimir o exportar.',
          confirmText   : 'Emitir estado'
        },
        {               
          id            : 'invoice-room',
          label         : 'Facturar Habitacion',
          icon          : 'description',
          kind          : 'document',
          description   : 'Prepara la emision del documento fiscal de la estancia con un resumen previo.',
          confirmText   : 'Confirmar factura',
          tone          : 'primary'
        }
      ]
    },
    {
      title: 'Salida',
      actions: [
        {
          id            : 'check-out',
          label         : 'Check Out',
          icon          : 'logout',
          kind          : 'critical',
          description   : 'Abre una confirmacion operativa de salida con saldo y alertas antes de ejecutar.',
          confirmText   : 'Confirmar salida',
          tone          : 'danger'
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

  readonly lodgingSubtotal          = computed(() => this.sumCharges(this.room().lodgingCharges));
  readonly extrasSubtotal           = computed(() => this.sumCharges(this.room().extraCharges));
  readonly hasPendingExtraCharges   = computed(() => this.extrasSubtotal() > 0.009);
  readonly hasPendingLodgingCharges = computed(() => this.lodgingSubtotal() > 0.009);
  readonly totalToCharge            = computed(() => this.lodgingSubtotal() + this.extrasSubtotal());
  readonly lodgingInvoiceSubtotal   = computed(() => this.sumSelectedCharges(this.room().lodgingCharges));
  readonly extrasInvoiceSubtotal    = computed(() => this.sumSelectedCharges(this.room().extraCharges));
  readonly totalToInvoice           = computed(() => this.lodgingInvoiceSubtotal() + this.extrasInvoiceSubtotal());
  readonly currentBalance           = computed(() => this.totalToCharge() - this.room().prepaid);
  readonly headerBalance            = computed(() => this.currentBalance());
  readonly modalHighlights          = computed(() => {
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
      code        : `HSP-${index + 1}`,
      name        : guest.name,
      document    : guest.document,
      address     : `Habitacion ${this.room().roomNumber}`,
      email       : '',
      enviarCorreo: false
    }));

    return [
      this.invoiceConsumerFinal,
      {
        code        : `RSV-${this.room().reservationNumber}`,
        name        : `${this.room().agency} / ${this.room().reservationNumber}`,
        document    : this.room().reservationNumber,
        address     : `Reserva de habitacion ${this.room().roomNumber}`,
        email       : '',
        enviarCorreo: false
      },
      ...guestClients
    ];
  });
  readonly filteredInvoiceClients = computed(() => {
    const term = this.normalizeSearchTerm(this.invoiceClientSearch());
    const localClients = this.invoiceClients();

    if (!term) {
      return localClients.slice(0, 4);
    }

    const matches = [...localClients, ...this.invoiceCatalogClients()].filter((client) =>
      [client.name, client.code, client.document].some((field) => this.normalizeSearchTerm(field).includes(term))
    );

    return [...new Map(matches.map((client) => [client.code, client])).values()].slice(0, 8);
  });
  readonly invoiceClient       = computed(() => this.selectedInvoiceClient() ?? this.invoiceConsumerFinal);
  readonly selectedInvoiceDocument = computed(() => {
    const documents = this.invoicePointOfSaleDocuments();
    const principal = documents.find((document) => document.MPV31_Principal === 1) ?? documents[0] ?? null;
    const prefix = this.invoiceClient().enviarCorreo ? 'F' : 'T';
    const matches = documents.filter((document) => document.MPV31_CodDocu.startsWith(prefix));

    return matches.find((document) => document.MPV31_Principal === 1) ?? matches[0] ?? principal;
  });
  readonly selectedInvoiceDocumentIsInvoice = computed(() =>
    this.cleanText(this.selectedInvoiceDocument()?.MPV31_CodDocu).toUpperCase().startsWith('F')
  );
  readonly selectedInvoiceDocumentLabel = computed(() =>
    this.selectedInvoiceDocumentIsInvoice() ? 'Factura Electronica' : 'Tiquete Electronico'
  );
  readonly invoiceSubtotal     = computed(() => this.roundCurrency(this.totalToInvoice() / 1.18));
  readonly invoiceTaxes        = computed(() => this.roundCurrency(this.totalToInvoice() - this.invoiceSubtotal()));
  readonly invoiceTip          = computed(() => 0);
  readonly invoiceTotal        = computed(() => this.roundCurrency(this.invoiceSubtotal() + this.invoiceTaxes() + this.invoiceTip()));
  readonly invoicePaid         = computed(() =>
    this.roundCurrency(this.invoiceAppliedPayments().reduce((sum, payment) => sum + payment.mtoTotal, 0))
  );
  readonly invoicePending                = computed(() => this.roundCurrency(Math.max(this.invoiceTotal() - this.invoicePaid(), 0)));
  readonly invoiceChange                 = computed(() => this.roundCurrency(Math.max(this.invoicePaid() - this.invoiceTotal(), 0)));
  readonly invoiceCanConfirm             = computed(() => this.invoiceAppliedPayments().length > 0 && this.invoicePaid() >= this.invoiceTotal());
  readonly invoiceDraftConvertedAmount   = computed(() => {
    const draft = this.invoicePaymentDraft();
    return this.roundCurrency(this.convertPaymentToInvoiceCurrency(Number(draft.amount || 0), draft.moneda, draft.tCambio));
  });
  readonly invoicePaymentAmountDisplay = computed(() =>
    this.isInvoicePaymentAmountEditing()
      ? this.invoicePaymentAmountText()
      : this.formatInvoicePaymentAmount(this.invoicePaymentDraft().amount)
  );
  readonly invoiceDraftExchangeRateLabel = computed(() => {
    const currency = this.cleanText(this.invoicePaymentDraft().moneda).toUpperCase();
    const rate = this.getInvoiceDraftExchangeRate(this.invoicePaymentDraft());

    if (!currency || currency === this.invoiceBaseCurrency) {
      return 'El pago se aplicará directamente en USD, sin conversión.';
    }

    return rate > 0
      ? `1 USD = ${this.formatExchangeRate(rate)} ${currency}`
      : `Tipo de cambio de ${currency} no disponible.`;
  });
  readonly roomChargeGuests = computed<RoomChargeGuestOption[]>(() =>
    this.room().guests.map((guest, index) => ({
      name: guest.name,
      document: guest.document,
      documentType: guest.documentType || `H${index + 1}`
    }))
  );
  readonly selectedRoomChargeGuest = computed(() => {
    const draft = this.roomChargeDraft();
    return this.roomChargeGuests().find((guest) => guest.document === draft.guestDocument) ?? this.roomChargeGuests()[0] ?? null;
  });
  readonly selectedRoomChargePointOfSale = computed(() => {
    const draft = this.roomChargeDraft();
    return this.roomChargePointOfSales().find((pointOfSale) => pointOfSale.code === draft.pointOfSale) ?? null;
  });
  readonly filteredRoomChargeItems = computed(() => {
    const term = this.normalizeSearchTerm(this.roomChargeDraft().itemSearch);
    const items = this.roomChargeItems();

    if (!term) {
      return items;
    }

    return items.filter((item) =>
        [
          item.MPV05_CodProducto,
          item.MPV05_DesProducto,
          item.MPV05_NomCorto,
          item.MPV00_NomCategoria,
          item.MPV01_CodGrupo
        ]
          .map((value) => this.normalizeSearchTerm(value))
          .some((value) => value.includes(term))
      );
  });
  readonly roomChargeCatalogTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRoomChargeItems().length / this.roomChargeCatalogPageSize))
  );
  readonly paginatedRoomChargeItems = computed(() => {
    const totalPages  = this.roomChargeCatalogTotalPages();
    const safePage    = Math.min(Math.max(this.roomChargeCatalogPage(), 1), totalPages);
    const startIndex  = (safePage - 1) * this.roomChargeCatalogPageSize;

    return this.filteredRoomChargeItems().slice(startIndex, startIndex + this.roomChargeCatalogPageSize);
  });
  readonly roomChargeTotal = computed(() =>
    this.roundCurrency(this.roomChargeLines().reduce((sum, line) => sum + line.total, 0))
  );
  readonly selectedChargeDetailTotal = computed(() =>
    this.roundCurrency((this.selectedChargeDetail()?.detalles ?? []).reduce((sum, detail) => sum + Number(detail.total ?? 0), 0))
  );
  readonly hasChargeDetailChanges = computed(() =>
    this.chargeDetailFingerprint(this.selectedChargeDetail()) !== this.chargeDetailFingerprint(this.originalSelectedChargeDetail())
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly toastService: ToastService
  ) {
    const roomNumber = this.route.snapshot.paramMap.get('roomNumber') ?? '';
    const navigationRoom = this.getNavigationRoom();

    this.requestedRoomNumber = roomNumber;
    this.requestedReservationNumber = navigationRoom?.RSV ?? '';

    if (navigationRoom) {
      this.room.set(this.buildRoomFromRackData(navigationRoom, roomNumber));
      return;
    }

    this.room.set(this.buildRoomFromNumber(roomNumber));
  }

  ngOnInit(): void {
    this.loadOperationalDate();
    this.setupInvoiceClientSearch();
    this.loadRoomStay();
  }

  setActiveTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  startCommentsEditing(): void {
    if (this.isCommentsSaving()) {
      return;
    }

    this.commentsDraft.set(this.room().comments);
    this.commentsErrorMessage.set('');
    this.isCommentsEditing.set(true);
  }

  cancelCommentsEditing(): void {
    if (this.isCommentsSaving()) {
      return;
    }

    this.commentsDraft.set(this.room().comments);
    this.commentsErrorMessage.set('');
    this.isCommentsEditing.set(false);
  }

  updateCommentsDraft(value: string): void {
    this.commentsDraft.set(value);
    this.commentsErrorMessage.set('');
  }

  saveStayComments(): void {
    if (this.isCommentsSaving()) {
      return;
    }

    const room = this.room();
    const codReserva = this.cleanText(room.reservationNumber);
    const roomNumber = this.cleanText(room.roomNumber);
    const payload: RoomStayCommentsPayload = {
      comentarios: this.cleanText(this.commentsDraft()),
      operador: this.getOperador()
    };

    if (!codReserva || !roomNumber) {
      this.commentsErrorMessage.set('No se pudo identificar la reserva o la habitación para guardar el comentario.');
      return;
    }

    this.isCommentsSaving.set(true);
    this.commentsErrorMessage.set('');

    this.roomStayManagementService
      .updateStayComments(codReserva, roomNumber, payload)
      .pipe(
        finalize(() => this.isCommentsSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.room.update((currentRoom) => ({ ...currentRoom, comments: payload.comentarios }));
          this.commentsDraft.set(payload.comentarios);
          this.isCommentsEditing.set(false);
          this.toastService.success(
            payload.comentarios ? 'Comentario actualizado correctamente.' : 'Comentario eliminado correctamente.',
            3500,
            'Comentarios'
          );
        },
        error: (error: unknown) => {
          console.error('No se pudo actualizar el comentario de la estancia.', error);
          this.commentsErrorMessage.set('No se pudo guardar el comentario. Intente nuevamente.');
        }
      });
  }

  backToRoomRack(): void {
    void this.router.navigate(['/front-desk/room-rack']);
  }

  private refreshRoomRackAfterCheckout(): void {
    void this.router.navigate(['/front-desk/room-rack'], {
      replaceUrl: true,
      state: {
        refreshRoomRack: true,
        checkoutCompleted: true,
        checkedOutRoom: this.room().roomNumber
      }
    });
  }

  openActionModal(action: StayOperation): void {
    if (action.id === 'transfer-charges') {
      this.toastService.info(
        'La transferencia de cargos no está disponible hasta contar con el proceso correspondiente en el backend.',
        4500,
        'Transferencia de cargos'
      );
      return;
    }

    if (this.actionRequiresOperationalDate(action.id) && !this.todayDisplayDate()) {
      const message = this.operationalDateService.loading()
        ? 'La fecha operativa todavía se está cargando.'
        : 'No se puede ejecutar esta operación sin una fecha operativa válida.';
      this.toastService.warning(message, 4000, 'Fecha operativa');
      return;
    }

    if (action.id !== 'change-room') {
      this.availableRoomsLoaded.set(false);
      this.availableRoomOptions.set([]);
    }

    this.actionDraft.set(this.buildActionDraft(action.id));

    if (action.id === 'change-room') {
      this.loadAvailableRoomsForChange();
    }

    if (action.id === 'invoice-room') {
      this.resetInvoiceDraft();
      this.loadInvoiceCatalogs();
    }

    if (action.id === 'new-charge') {
      this.resetRoomChargeDraft();
      this.loadRoomChargePointOfSales();
    }
    this.activeAction.set(action);
  }

  closeActionModal(): void {
    this.invoiceValidationMessage.set('');
    this.roomChargeValidationMessage.set('');
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

  canExecuteActiveAction(): boolean {
    const actionId = this.activeAction()?.id;

    if (actionId && this.actionRequiresOperationalDate(actionId) && !this.todayDisplayDate()) {
      return false;
    }

    if (this.isActionSelected('change-room')) {
      return (
        this.availableRoomsLoaded() &&
        !this.isAvailableRoomsLoading() &&
        !this.isRoomChangeSubmitting() &&
        this.roomOptions().length > 0
      );
    }

    if (this.isActionSelected('change-departure')) {
      return !this.departureDateValidationMessage() && !this.isDepartureChangeSubmitting();
    }

    if (this.isActionSelected('new-charge')) {
      return (
        Boolean(this.selectedRoomChargeGuest()) &&
        Boolean(this.roomChargeDraft().pointOfSale) &&
        this.roomChargeLines().length > 0 &&
        this.roomChargeTotal() > 0 &&
        !this.isRoomChargeSubmitting()
      );
    }

    if (this.isActionSelected('invoice-room')) {
      return (
        !this.isInvoiceSubmitting() &&
        !this.isCriticalStayRefreshing() &&
        !this.isInvoiceExchangeRateLoading()
      );
    }

    if (this.isActionSelected('print-statement')) {
      return !this.isStatementGenerating();
    }

    if (this.isActionSelected('check-out')) {
      return !this.isCheckoutSubmitting() && !this.isCriticalStayRefreshing();
    }

    return true;
  }

  executeActiveAction(): void {
    const action = this.activeAction();

    if (!action) {
      return;
    }

    if (!this.canExecuteActiveAction()) {
      const message = action.id === 'change-room'
        ? 'Espera a que carguen las habitaciones disponibles.'
        : 'Completa los datos requeridos antes de continuar.';
      this.toastService.info(message, 3000, 'Estancia');
      return;
    }

    let shouldClose = true;

    switch (action.id) {
      case 'change-room':
        shouldClose = false;
        void this.confirmRoomChange();
        break;
      case 'change-departure':
        shouldClose = false;
        void this.submitDepartureChange();
        break;
      case 'register-prepayment':
        this.applyPrepaymentRegistration();
        break;
      case 'new-charge':
        shouldClose = false;
        void this.submitRoomCharge();
        break;
      case 'transfer-charges':
        this.toastService.info(
          'La transferencia de cargos permanece deshabilitada hasta contar con soporte en el backend.',
          4000,
          'Transferencia de cargos'
        );
        break;
      case 'print-statement':
        shouldClose = false;
        void this.generateRoomStatement();
        break;
      case 'invoice-room':
        shouldClose = false;
        void this.submitRoomInvoice();
        break;
      case 'check-out':
        shouldClose = false;
        void this.submitCheckOut();
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
    return item.id;
  }

  formatHeaderDate(date: string): string {
    return normalizePmsDateDDMMYYYY(date) || '-';
  }

  formatCurrency(amount: number): string {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  onInvoiceClientSearchChange(value: string): void {
    this.invoiceClientSearch.set(value);
    this.invoiceClientSearchChanges.next(value);

    if (this.selectedInvoiceClient()?.name !== value) {
      this.selectedInvoiceClient.set(null);
    }
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
    if (patch.moneda !== undefined) {
      const currency = this.cleanText(patch.moneda).toUpperCase() || this.invoiceBaseCurrency;
      this.invoiceValidationMessage.set('');
      this.invoicePaymentDraft.update((currentDraft) => ({
        ...currentDraft,
        ...patch,
        moneda: currency,
        amount: currency === this.invoiceBaseCurrency ? this.invoicePending() : null,
        tCambio: currency === this.invoiceBaseCurrency ? 1 : 0
      }));
      this.loadInvoiceExchangeRateForCurrency(currency);
      return;
    }

    this.invoicePaymentDraft.update((currentDraft) => ({ ...currentDraft, ...patch }));
  }

  onInvoicePaymentAmountFocus(): void {
    this.isInvoicePaymentAmountEditing.set(true);
    this.invoicePaymentAmountText.set(
      this.formatInvoicePaymentAmount(this.invoicePaymentDraft().amount)
    );
  }

  onInvoicePaymentAmountChange(value: string | number | null | undefined): void {
    const formattedValue = this.normalizeInvoicePaymentAmountText(value);
    const numericValue = this.parseInvoicePaymentAmount(formattedValue);

    this.invoicePaymentAmountText.set(formattedValue);
    this.invoicePaymentDraft.update((draft) => ({
      ...draft,
      amount: numericValue
    }));
  }

  onInvoicePaymentAmountBlur(): void {
    const amount = this.invoicePaymentDraft().amount;
    this.invoicePaymentDraft.update((draft) => ({
      ...draft,
      amount: amount === null ? null : this.roundCurrency(amount)
    }));
    this.isInvoicePaymentAmountEditing.set(false);
    this.invoicePaymentAmountText.set('');
  }

  toggleChargeInvoiceSelection(bucket: ChargeBucket, chargeId: string, selected: boolean): void {
    this.room.update((currentRoom) => {
      const updateCharges = (charges: Charge[]) =>
        charges.map((charge) => (charge.id === chargeId ? { ...charge, invoiceSelected: selected } : charge));

      return {
        ...currentRoom,
        lodgingCharges: bucket === 'lodging' ? updateCharges(currentRoom.lodgingCharges) : currentRoom.lodgingCharges,
        extraCharges: bucket === 'extras' ? updateCharges(currentRoom.extraCharges) : currentRoom.extraCharges
      };
    });

    this.resetInvoicePaymentsForSelectionChange();
  }

  addInvoicePayment(): void {
    const draft = this.invoicePaymentDraft();
    const method = this.invoicePaymentMethods().find((item) => item.code === draft.methodCode);
    const moneda = this.cleanText(draft.moneda).toUpperCase();
    const amount = this.roundCurrency(Number(draft.amount || 0));
    const exchangeRate = this.getInvoiceDraftExchangeRate(draft);
    const convertedAmount = this.roundCurrency(this.convertPaymentToInvoiceCurrency(amount, moneda, exchangeRate));

    this.invoiceValidationMessage.set('');

    if (this.isInvoiceExchangeRateLoading()) {
      this.invoiceValidationMessage.set('Espera a que termine la consulta del tipo de cambio.');
      return;
    }

    if (!method) {
      this.invoiceValidationMessage.set('Selecciona una forma de pago.');
      return;
    }

    if (!moneda) {
      this.invoiceValidationMessage.set('Selecciona la moneda del pago.');
      return;
    }

    if (amount <= 0) {
      this.invoiceValidationMessage.set('El monto debe ser mayor a 0.');
      return;
    }

    if (moneda !== this.invoiceBaseCurrency && exchangeRate <= 0) {
      this.invoiceValidationMessage.set('No se pudo determinar el tipo de cambio para la moneda seleccionada.');
      return;
    }

    this.invoiceAppliedPayments.update((payments) => [
      ...payments,
      {
        frmPago: method.code,
        tipo: method.tipo || method.tipPago,
        numTarjeta: this.cleanText(draft.numTarjeta),
        moneda,
        monto: amount,
        vencimiento: this.cleanText(draft.vencimiento),
        mtoTotal: convertedAmount,
        tCambio: exchangeRate,
        rateDate: this.todayDisplayDate(),
        orden: payments.length + 1,
        description: method.description,
      }
    ]);

    const nextPendingAmount = this.roundCurrency(
      this.convertPaymentFromInvoiceCurrency(this.invoicePending(), moneda, exchangeRate)
    );

    this.invoicePaymentDraft.set({
      methodCode: draft.methodCode,
      moneda,
      amount: nextPendingAmount > 0 ? nextPendingAmount : null,
      numTarjeta: '00000',
      vencimiento: '00/00',
      tCambio: exchangeRate
    });
  }

  removeInvoicePayment(order: number): void {
    this.invoiceAppliedPayments.update((payments) =>
      payments
        .filter((payment) => payment.orden !== order)
        .map((payment, index) => ({ ...payment, orden: index + 1 }))
    );
    this.invoicePaymentDraft.update((draft) => ({
      ...draft,
      amount: this.roundCurrency(
        this.convertPaymentFromInvoiceCurrency(
          this.invoicePending(),
          draft.moneda,
          this.getInvoiceDraftExchangeRate(draft)
        )
      )
    }));
  }

  viewInvoiceChargeDetail(): void {
    this.activeTab.set('account');
    this.toastService.info('Se abrio el detalle financiero de la estancia.', 3000, 'Facturacion');
  }

  viewChargeDetail(bucket: ChargeBucket, charge: Charge): void {
    const numCrgHab = this.cleanText(charge.numCrgHab || charge.reference);

    if (!numCrgHab) {
      this.toastService.warning('El cargo no tiene un numero de documento para consultar.', 3500, 'Cargos');
      return;
    }

    this.selectedChargeDetailSource.set({ bucket, charge });
    this.selectedChargeDetail.set(null);
    this.originalSelectedChargeDetail.set(null);
    this.chargeDetailErrorMessage.set('');
    this.chargeDetailAction.set(null);
    this.isChargeDetailSubmitting.set(false);
    this.isChargeDetailOpen.set(true);
    this.isChargeDetailLoading.set(true);

    this.roomStayManagementService
      .getRoomChargeDetailByNumber(numCrgHab)
      .pipe(
        finalize(() => this.isChargeDetailLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (detail) => {
          this.originalSelectedChargeDetail.set(this.cloneRoomChargeDetail(detail));
          this.selectedChargeDetail.set(this.cloneRoomChargeDetail(detail));
        },
        error: (error) => {
          console.error('No se pudo consultar el detalle del cargo.', error);
          this.chargeDetailErrorMessage.set('No se pudo consultar el detalle del cargo. Revise la conexion con el API.');
        }
      });
  }

  async printRoomChargePdf(charge: Charge): Promise<void> {
    const numCrgHab = this.cleanText(charge.numCrgHab || charge.reference);
    if (!numCrgHab) {
      this.toastService.warning('El cargo no tiene un numero de documento para generar el PDF.', 4000, 'Cargos');
      return;
    }
    if (this.isRoomChargeDocumentBusy(charge)) {
      return;
    }

    this.setRoomChargeDocumentJob(charge, 'pdf');

    try {
      const result = await this.roomChargePdfService.openByOperation(numCrgHab);
      this.toastService.success(
        result === 'opened'
          ? 'El comprobante PDF se abrio en una nueva pestana.'
          : 'El navegador bloqueo la vista previa; el PDF fue descargado.',
        4500,
        'Cargo a habitacion'
      );
    } catch (error: unknown) {
      console.error('No se pudo generar el PDF del cargo de habitacion.', error);
      this.toastService.warning(this.documentErrorMessage(error, 'No se pudo generar el PDF del cargo.'), 5000, 'Cargo a habitacion');
    } finally {
      this.setRoomChargeDocumentJob(charge, null);
    }
  }

  async printRoomChargePos(charge: Charge): Promise<void> {
    const tipCrgHab = this.cleanText(charge.tipCrgHab) || 'CHB';
    const numCrgHab = this.cleanText(charge.numCrgHab || charge.reference);

    if (!numCrgHab) {
      this.toastService.warning('El cargo no tiene un numero de documento para imprimir.', 4000, 'Cargos');
      return;
    }
    if (this.isRoomChargeDocumentBusy(charge)) {
      return;
    }

    this.setRoomChargeDocumentJob(charge, 'pos');

    try {
      await this.roomChargePosPrintService.printByOperation(
        tipCrgHab,
        numCrgHab,
        'TIQUETE',
        'REIMPRESION'
      );
      this.toastService.success('Cargo enviado a la impresora TIQUETE.', 4000, 'Cargo a habitacion');
    } catch (error: unknown) {
      console.error('No se pudo imprimir el cargo de habitacion en TIQUETE.', error);
      this.toastService.warning(this.documentErrorMessage(error, 'No se pudo imprimir el cargo en TIQUETE.'), 5000, 'Cargo a habitacion');
    } finally {
      this.setRoomChargeDocumentJob(charge, null);
    }
  }

  isRoomChargeDocumentBusy(charge: Charge, job?: 'pdf' | 'pos'): boolean {
    const activeJob = this.roomChargeDocumentJobs()[this.roomChargeDocumentKey(charge)];
    return job ? activeJob === job : Boolean(activeJob);
  }

  closeChargeDetailModal(): void {
    this.isChargeDetailOpen.set(false);
    this.isChargeDetailLoading.set(false);
    this.isChargeDetailSubmitting.set(false);
    this.chargeDetailErrorMessage.set('');
    this.selectedChargeDetail.set(null);
    this.originalSelectedChargeDetail.set(null);
    this.selectedChargeDetailSource.set(null);
    this.chargeDetailAction.set(null);
  }

  async requestCloseChargeDetailModal(): Promise<void> {
    if (!this.hasChargeDetailChanges()) {
      this.closeChargeDetailModal();
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Hay cambios sin guardar',
      text: 'Los cambios realizados en el detalle se perderan al cerrar.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cerrar y descartar',
      cancelButtonText: 'Continuar editando',
      reverseButtons: true,
      focusCancel: true,
      customClass: { container: 'next-confirm-container' }
    });

    if (confirmation.isConfirmed) {
      this.closeChargeDetailModal();
    }
  }

  async refreshSelectedChargeDetail(): Promise<void> {
    const source = this.selectedChargeDetailSource();

    if (!source) {
      return;
    }

    if (this.hasChargeDetailChanges()) {
      const confirmation = await Swal.fire({
        title: 'Descartar cambios',
        text: 'Se volvera a consultar el cargo y se perderan los cambios locales.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Actualizar y descartar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        focusCancel: true,
        customClass: { container: 'next-confirm-container' }
      });

      if (!confirmation.isConfirmed) {
        return;
      }
    }

    this.viewChargeDetail(source.bucket, source.charge);
  }

  trackByChargeDetail(_: number, item: RoomChargeLookupDetail): string {
    return `${item.numCrgHab}-${item.orden}-${item.codConsumo}`;
  }

  chargeBucketLabel(bucket: ChargeBucket | undefined): string {
    return bucket === 'extras' ? 'Cargos Extras' : 'Cargos de la Estancia';
  }

  formatDetailDate(value: string | null | undefined): string {
    return this.formatApiDate(value) || '-';
  }

  formatDetailTime(value: string | null | undefined): string {
    return this.formatApiTime(value) || '-';
  }

  canMutateChargeDetail(detail: RoomChargeLookupDetail): boolean {
    const estado = this.cleanText(detail.estado).toUpperCase();
    const cierre = this.cleanText(this.selectedChargeDetail()?.encabezado?.cierre).toUpperCase();

    return estado !== 'ANU' && estado !== '1' && cierre !== '1' && cierre !== 'S';
  }

  async editChargeDetailLine(detail: RoomChargeLookupDetail): Promise<void> {
    if (!this.canMutateChargeDetail(detail)) {
      this.toastService.info('Este item no se puede editar porque esta cerrado o anulado.', 3500, 'Cargos');
      return;
    }

    this.chargeDetailAction.set({ orden: detail.orden, action: 'edit' });
    const result = await Swal.fire({
      title: 'Editar item del cargo',
      html: `
        <div style="display:grid;gap:12px;text-align:left">
          <label style="display:grid;gap:6px;font-weight:700">Descripcion
            <input id="charge-detail-name" class="swal2-input" value="${this.escapeHtml(detail.nomConsumo)}" style="margin:0;width:100%">
          </label>
          <label style="display:grid;gap:6px;font-weight:700">Cantidad
            <input id="charge-detail-quantity" type="number" min="0" step="1" class="swal2-input" value="${Number(detail.cantidad || 0)}" style="margin:0;width:100%">
          </label>
          <label style="display:grid;gap:6px;font-weight:700">Precio
            <input id="charge-detail-price" type="number" min="0" step="0.01" class="swal2-input" value="${Number(detail.precio || 0)}" style="margin:0;width:100%">
          </label>
          <label style="display:grid;gap:6px;font-weight:700">Comentario
            <textarea id="charge-detail-comment" class="swal2-textarea" style="margin:0;width:100%">${this.escapeHtml(detail.comentario)}</textarea>
          </label>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Aplicar al borrador',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: { container: 'next-confirm-container' },
      preConfirm: () => {
        const name = this.cleanText((document.getElementById('charge-detail-name') as HTMLInputElement | null)?.value);
        const quantity = Number((document.getElementById('charge-detail-quantity') as HTMLInputElement | null)?.value);
        const price = Number((document.getElementById('charge-detail-price') as HTMLInputElement | null)?.value);
        const comment = this.cleanText((document.getElementById('charge-detail-comment') as HTMLTextAreaElement | null)?.value);

        if (!name) {
          Swal.showValidationMessage('La descripcion es requerida.');
          return null;
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
          Swal.showValidationMessage('La cantidad debe ser mayor a 0.');
          return null;
        }

        if (!Number.isFinite(price) || price < 0) {
          Swal.showValidationMessage('El precio no es valido.');
          return null;
        }

        return { name, quantity, price, comment };
      }
    });

    this.chargeDetailAction.set(null);

    if (!result.isConfirmed || !result.value) {
      return;
    }

    this.updateSelectedChargeDetailLine(detail, {
      nomConsumo: result.value.name,
      cantidad: result.value.quantity,
      precio: result.value.price,
      total: this.roundCurrency(result.value.quantity * result.value.price),
      comentario: result.value.comment
    });
    this.toastService.info('Cambio preparado. Presione Guardar cambios para actualizar el cargo.', 4000, 'Cargos');
  }

  async transferChargeDetailLine(detail: RoomChargeLookupDetail): Promise<void> {
    if (!this.canMutateChargeDetail(detail)) {
      this.toastService.info('Este item no se puede trasladar porque esta cerrado o anulado.', 3500, 'Cargos');
      return;
    }

    this.chargeDetailAction.set({ orden: detail.orden, action: 'transfer' });
    const result = await Swal.fire({
      title: 'Trasladar item',
      input: 'text',
      inputLabel: 'Habitacion destino',
      inputPlaceholder: 'Ej. 711',
      inputValue: '',
      showCancelButton: true,
      confirmButtonText: 'Aplicar al borrador',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: { container: 'next-confirm-container' },
      inputValidator: (value) => {
        if (!this.cleanText(value)) {
          return 'Indique la habitacion destino.';
        }

        if (this.cleanText(value) === this.cleanText(detail.numHab)) {
          return 'La habitacion destino debe ser distinta.';
        }

        return null;
      }
    });

    this.chargeDetailAction.set(null);

    if (!result.isConfirmed) {
      return;
    }

    this.updateSelectedChargeDetailLine(detail, {
      numHab: this.cleanText(result.value),
      comentario: [detail.comentario, `Traslado preparado hacia habitacion ${this.cleanText(result.value)}.`].filter(Boolean).join(' | ')
    });
    this.toastService.info('Traslado preparado. Presione Guardar cambios para actualizar el cargo.', 4000, 'Cargos');
  }

  async annulChargeDetailLine(detail: RoomChargeLookupDetail): Promise<void> {
    if (!this.canMutateChargeDetail(detail)) {
      this.toastService.info('Este item ya esta cerrado o anulado.', 3500, 'Cargos');
      return;
    }

    if ((this.selectedChargeDetail()?.detalles.length ?? 0) <= 1) {
      this.toastService.info('El cargo debe conservar al menos un item. Para eliminarlo utilice Anular cargo completo.', 4000, 'Cargos');
      return;
    }

    this.chargeDetailAction.set({ orden: detail.orden, action: 'annul' });
    const confirmation = await Swal.fire({
      title: 'Anular item',
      text: `Se marcara como anulado "${detail.nomConsumo}" por ${this.formatCurrency(Number(detail.total || 0))}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Anular item',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: { container: 'next-confirm-container' }
    });

    this.chargeDetailAction.set(null);

    if (!confirmation.isConfirmed) {
      return;
    }

    this.selectedChargeDetail.update((currentDetail) => {
      if (!currentDetail) {
        return currentDetail;
      }

      return {
        ...currentDetail,
        detalles: currentDetail.detalles.filter((item) =>
          !(item.orden === detail.orden && item.codConsumo === detail.codConsumo)
        )
      };
    });
    this.toastService.warning('Item retirado del borrador. Presione Guardar cambios para actualizar el cargo.', 4000, 'Cargos');
  }

  async annulCharge(bucket: ChargeBucket, requestedCharge: Charge): Promise<void> {
    const refreshedRoom = await this.refreshStayForCriticalOperation('anular el cargo');
    if (!refreshedRoom) {
      return;
    }

    const refreshedCharges = bucket === 'lodging' ? refreshedRoom.lodgingCharges : refreshedRoom.extraCharges;
    const charge = refreshedCharges.find(
      (item) => this.chargeBusinessKey(item) === this.chargeBusinessKey(requestedCharge)
    );

    if (!charge) {
      this.toastService.warning(
        'El cargo cambió o ya no está disponible. Se actualizó la estancia para mostrar la información vigente.',
        5000,
        'Cargos'
      );
      return;
    }

    const payloadBase = this.buildAnnulRoomChargePayload(bucket, charge, '');

    if (!payloadBase) {
      this.toastService.warning('El cargo no tiene la informacion necesaria para anularse.', 4000, 'Cargos');
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Anular cargo',
      text: `Se anulara el cargo "${charge.concept}" por ${this.formatCurrency(charge.charge)}.${this.hasChargeDetailChanges() ? ' Los cambios sin guardar se descartaran.' : ''}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, anular',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: { container: 'next-confirm-container' }
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    const reasonResult = await Swal.fire({
      title: 'Motivo de anulacion',
      input: 'textarea',
      inputLabel: 'Indica el motivo de la anulacion',
      inputPlaceholder: 'Ej. Cargo duplicado, consumo no reconocido...',
      inputAttributes: {
        maxlength: '250',
        rows: '4'
      },
      showCancelButton: true,
      confirmButtonText: 'Aplicar anulacion',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: { container: 'next-confirm-container' },
      inputValidator: (value) => {
        const reason = this.cleanText(value);

        if (reason.length < 5) {
          return 'El motivo debe tener al menos 5 caracteres.';
        }

        return null;
      }
    });

    if (!reasonResult.isConfirmed) {
      return;
    }

    const payload = this.buildAnnulRoomChargePayload(bucket, charge, reasonResult.value);

    if (!payload) {
      this.toastService.warning('No se pudo preparar la anulacion del cargo.', 4000, 'Cargos');
      return;
    }

    this.roomStayManagementService
      .annulRoomCharge(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (this.isFailedApiResponse(response)) {
            this.toastService.warning(response.message || 'No se pudo anular el cargo.', 4000, 'Cargos');
            return;
          }

          this.applyAnnulledCharge(bucket, charge, payload.motivo);
        },
        error: (error) => {
          console.error('No se pudo anular el cargo de habitacion.', error);
          this.toastService.warning('No se pudo anular el cargo de habitacion.', 4000, 'Cargos');
        }
      });
  }

  private applyAnnulledCharge(bucket: ChargeBucket, charge: Charge, reason: string): void {
    this.room.update((currentRoom) => {
      const nextLodgingCharges = bucket === 'lodging'
        ? currentRoom.lodgingCharges.filter((item) => item.id !== charge.id)
        : currentRoom.lodgingCharges;
      const nextExtraCharges = bucket === 'extras'
        ? currentRoom.extraCharges.filter((item) => item.id !== charge.id)
        : currentRoom.extraCharges;

      return {
        ...currentRoom,
        lodgingCharges: nextLodgingCharges,
        extraCharges: nextExtraCharges,
        observations: [`Cargo anulado: ${charge.concept} (${this.formatCurrency(charge.charge)}). Motivo: ${reason}`, ...currentRoom.observations]
      };
    });

    this.resetInvoicePaymentsForSelectionChange();
    this.addTimelineEntry('Cargo anulado', `${charge.concept} fue anulado por ${this.formatCurrency(charge.charge)}. Motivo: ${reason}`);
    this.toastService.success('Cargo de habitacion anulado correctamente.', 4000, 'Cargos');

    if (this.isChargeDetailOpen()) {
      this.closeChargeDetailModal();
    }
  }

  private updateSelectedChargeDetailLine(
    detail: RoomChargeLookupDetail,
    patch: Partial<RoomChargeLookupDetail>
  ): void {
    this.selectedChargeDetail.update((currentDetail) => {
      if (!currentDetail) {
        return currentDetail;
      }

      return {
        ...currentDetail,
        detalles: currentDetail.detalles.map((item) =>
          item.orden === detail.orden && item.codConsumo === detail.codConsumo
            ? { ...item, ...patch }
            : item
        )
      };
    });
  }

  async saveChargeDetailChanges(): Promise<void> {
    if (!this.hasChargeDetailChanges() || this.isChargeDetailSubmitting()) {
      return;
    }

    const payload = this.buildUpdateRoomChargePayload();

    if (!payload) {
      this.toastService.warning('No se pudo preparar la actualizacion. Verifique el encabezado y los items del cargo.', 4500, 'Cargos');
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Guardar cambios del cargo',
      text: `Se actualizara el cargo ${payload.numCrgHab} con ${payload.detalle.length} item(s) por ${this.formatCurrency(payload.mtoTotal)}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Si, actualizar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: true,
      customClass: { container: 'next-confirm-container' }
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    this.isChargeDetailSubmitting.set(true);

    this.roomStayManagementService
      .updateRoomCharge(payload)
      .pipe(
        finalize(() => this.isChargeDetailSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (this.isFailedApiResponse(response)) {
            this.toastService.warning(response.message || 'No se pudo actualizar el cargo de habitacion.', 4500, 'Cargos');
            return;
          }

          this.toastService.success('Cargo de habitacion actualizado correctamente.', 4000, 'Cargos');
          this.closeChargeDetailModal();
          this.loadRoomStay();
        },
        error: (error) => {
          console.error('No se pudo actualizar el cargo de habitacion.', error);
          this.toastService.warning('No se pudo actualizar el cargo de habitacion.', 4500, 'Cargos');
        }
      });
  }

  private buildUpdateRoomChargePayload(): RoomChargePayload | null {
    const chargeDetail = this.selectedChargeDetail();
    const source = this.selectedChargeDetailSource();

    if (!chargeDetail || !source || !chargeDetail.detalles.length) {
      return null;
    }

    return buildRoomChargeUpdatePayload(
      chargeDetail.encabezado,
      chargeDetail.detalles,
      this.getOperador(),
      {
        tipCrgHab: source.charge.tipCrgHab,
        numCrgHab: source.charge.numCrgHab || source.charge.reference,
        codRsv: source.charge.codRsv || this.room().reservationNumber,
        numHab: source.charge.numHab || this.room().roomNumber,
        moneda: this.invoiceBaseCurrency
      }
    );
  }

  private cloneRoomChargeDetail(detail: RoomChargeLookupResponse): RoomChargeLookupResponse {
    return {
      encabezado: { ...detail.encabezado },
      detalles: detail.detalles.map((item) => ({ ...item }))
    };
  }

  private chargeDetailFingerprint(detail: RoomChargeLookupResponse | null): string {
    return detail ? JSON.stringify(detail) : '';
  }

  private buildAnnulRoomChargePayload(bucket: ChargeBucket, charge: Charge, reason: string): RoomChargeAnnulPayload | null {
    const numHab = bucket === 'lodging' ? this.cleanText(this.room().masterFolio) : this.cleanText(this.room().roomNumber);

    const payload: RoomChargeAnnulPayload = {
      tipCrgHab     : 'CHB',
      numCrgHab     : this.cleanText(charge.numCrgHab || charge.reference),
      codRsv        : this.cleanText(charge.codRsv || this.room().reservationNumber),
      numHab        : numHab,
      motivo        : this.cleanText(reason),
      operador      : this.getOperador()
    };

    const hasRequiredChargeData = Boolean(payload.tipCrgHab && payload.numCrgHab && payload.codRsv && payload.numHab && payload.operador);

    if (!hasRequiredChargeData) {
      return null;
    }

    return payload;
  }

  updateRoomChargeDraft(patch: Partial<RoomChargeDraft>): void {
    this.roomChargeValidationMessage.set('');
    this.roomChargeDraft.update((currentDraft) => ({ ...currentDraft, ...patch }));

    if (patch.itemSearch !== undefined) {
      this.roomChargeCatalogPage.set(1);
    }
  }

  setRoomChargeCatalogPage(page: number): void {
    const nextPage = Math.min(Math.max(Math.trunc(Number(page) || 1), 1), this.roomChargeCatalogTotalPages());
    this.roomChargeCatalogPage.set(nextPage);
  }

  onRoomChargePointOfSaleChange(pointOfSaleCode: string): void {
    const selectedPointOfSale = this.roomChargePointOfSales().find((pointOfSale) => pointOfSale.code === pointOfSaleCode);

    this.roomChargeLines.set([]);
    this.roomChargeItems.set([]);
    this.roomChargeCatalogPage.set(1);
    this.updateRoomChargeDraft({
      pointOfSale     : pointOfSaleCode,
      priceList       : selectedPointOfSale?.priceList ?? '',
      currency        : selectedPointOfSale?.currency ?? this.invoiceBaseCurrency,
      itemSearch      : ''
    });

    if (selectedPointOfSale?.priceList) {
      this.loadRoomChargePriceListItems(selectedPointOfSale.priceList);
    }
  }

  addRoomChargeItem(item: RoomChargePriceListApiItem): void {
    const code = this.cleanText(item.MPV05_CodProducto);

    if (!code) {
      return;
    }

    this.roomChargeLines.update((lines) => {
      const existingLine = lines.find((line) => line.code === code);

      if (existingLine) {
        return lines.map((line) => (line.code === code ? this.recalculateRoomChargeLine({ ...line, quantity: line.quantity + 1 }) : line));
      }

      const currency = this.cleanText(item.MPV05_Moneda) || this.roomChargeDraft().currency || this.invoiceBaseCurrency;
      const line: RoomChargeLine = {
        id            : `${code}|${Date.now()}|${lines.length}`,
        group         : this.cleanText(item.MPV01_CodGrupo),
        category      : this.cleanText(item.MPV01_CodCategoria || item.MPV00_NomCategoria),
        code          ,
        name          : this.cleanText(item.MPV05_DesProducto || item.MPV05_NomCorto || code),
        quantity      : 1,
        price         : this.roundCurrency(Number(item.MPV05_PrecioTotal ?? 0)),
        total         : this.roundCurrency(Number(item.MPV05_PrecioTotal ?? 0)),
        currency      ,
        order         : lines.length + 1,
        comment       : ''
      };

      return [...lines, line];
    });

    this.updateRoomChargeDraft({ itemSearch: '' });
  }

  updateRoomChargeLine(lineId: string, patch: Partial<RoomChargeLine>): void {
    this.roomChargeValidationMessage.set('');
    this.roomChargeLines.update((lines) =>
      lines.map((line) => (line.id === lineId ? this.recalculateRoomChargeLine({ ...line, ...patch }) : line))
    );
  }

  removeRoomChargeLine(lineId: string): void {
    this.roomChargeLines.update((lines) =>
      lines.filter((line) => line.id !== lineId).map((line, index) => ({ ...line, order: index + 1 }))
    );
  }

  openAddGuestModal(): void {
    this.extraGuestValidationMessage.set('');
    this.resetExtraGuestForm();
    this.showExtraGuestModal.set(true);
    this.loadExtraGuestCatalogs();
  }

  closeExtraGuestModal(): void {
    if (this.isExtraGuestSaving()) {
      return;
    }

    this.showExtraGuestModal.set(false);
    this.extraGuestValidationMessage.set('');
    this.extraGuestNationalitySearch.set('');
    this.isExtraGuestNationalitySearchOpen.set(false);
    this.extraGuestForm.markAsUntouched();
  }

  openExtraGuestNationalitySearch(): void {
    this.isExtraGuestNationalitySearchOpen.set(true);
  }

  onExtraGuestNationalitySearchChange(value: string): void {
    this.extraGuestNationalitySearch.set(value);
    this.extraGuestForm.controls.codNacion.setValue('');
    this.extraGuestForm.controls.codNacion.markAsDirty();
    this.isExtraGuestNationalitySearchOpen.set(true);
  }

  closeExtraGuestNationalitySearch(): void {
    setTimeout(() => this.isExtraGuestNationalitySearchOpen.set(false), 120);
  }

  selectExtraGuestNationality(nationality: Nationality): void {
    this.extraGuestForm.controls.codNacion.setValue(nationality.CR06_Codigo);
    this.extraGuestForm.controls.codNacion.markAsDirty();
    this.extraGuestForm.controls.codNacion.markAsTouched();
    this.extraGuestNationalitySearch.set(nationality.CR06_Descripcion);
    this.isExtraGuestNationalitySearchOpen.set(false);
  }

  isExtraGuestFieldInvalid(field: keyof ExtraGuestForm): boolean {
    const control = this.extraGuestForm.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  getExtraGuestFieldError(field: keyof ExtraGuestForm): string {
    const control = this.extraGuestForm.controls[field];

    if (control.errors?.['required']) return 'Campo requerido';
    if (control.errors?.['pmsDate']) return 'Ingresa una fecha válida en formato dd/mm/yyyy';
    if (control.errors?.['email']) return 'Correo invalido';
    if (control.errors?.['maxlength']) return 'Longitud maxima excedida';

    return '';
  }

  normalizeExtraGuestBirthDate(): void {
    const control = this.extraGuestForm.controls.fecNac;
    const normalized = normalizePmsDateInputDDMMYYYY(control.value);

    if (normalized) {
      control.setValue(normalized);
    }
    control.markAsTouched();
  }

  async saveExtraGuest(): Promise<void> {
    const operationalDate = this.todayDisplayDate();
    if (!operationalDate) {
      this.extraGuestValidationMessage.set('No se puede agregar el huesped sin una fecha operativa valida.');
      return;
    }
    if (this.extraGuestForm.invalid) {
      this.extraGuestForm.markAllAsTouched();
      this.extraGuestValidationMessage.set('Completa los campos obligatorios del huesped.');
      return;
    }

    const payload = this.buildExtraGuestPayload();

    if (!payload) {
      this.extraGuestValidationMessage.set('Faltan datos de reserva o habitacion para agregar el huesped.');
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Agregar huesped',
      text: `Se agregara ${payload.nombre} ${payload.apellido} a la habitacion ${payload.numHabita}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Si, guardar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    this.isExtraGuestSaving.set(true);
    this.extraGuestValidationMessage.set('');

    this.roomStayManagementService
      .createRoomingListGuest(payload)
      .pipe(
        finalize(() => this.isExtraGuestSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (this.isFailedApiResponse(response)) {
            this.extraGuestValidationMessage.set(response.message || 'No se pudo agregar el huesped.');
            return;
          }

          this.applyExtraGuest(payload);
          this.showExtraGuestModal.set(false);
          this.toastService.success('Huesped agregado correctamente.', 4000, 'Rooming list');
          this.loadRoomStay();
        },
        error: (error) => {
          console.error('No se pudo agregar el huesped.', error);
          this.extraGuestValidationMessage.set('No se pudo agregar el huesped.');
        }
      });
  }

  private resetRoomChargeDraft(): void {
    const firstGuest = this.roomChargeGuests()[0];
    const firstPointOfSale = this.roomChargePointOfSales()[0];

    this.roomChargeDraft.set({
      guestDocument: firstGuest?.document ?? '',
      pointOfSale: firstPointOfSale?.code ?? '',
      priceList: firstPointOfSale?.priceList ?? '',
      currency: firstPointOfSale?.currency ?? this.invoiceBaseCurrency,
      itemSearch: '',
      comment: ''
    });
    this.roomChargeItems.set([]);
    this.roomChargeLines.set([]);
    this.roomChargeCatalogPage.set(1);
    this.roomChargeValidationMessage.set('');
  }

  private resetExtraGuestForm(): void {
    this.extraGuestForm.reset({
      tipDocu           : this.extraGuestDocumentTypes()[0]?.codigo ?? '',
      numDocu           : '',
      codNacion         : '',
      nombre            : '',
      apellido          : '',
      fecNac            : '',
      sexo              : '',
      estCivil          : '',
      tiPax             : this.extraGuestPaxTypes()[0]?.CR03_CodTipo ?? '',
      direccion         : '',
      email             : '',
      motivo            : '',
      procede           : '',
      mdoArribo         : ''
    });
    this.extraGuestNationalitySearch.set('');
    this.isExtraGuestNationalitySearchOpen.set(false);
  }

  private loadExtraGuestCatalogs(): void {
    if (this.extraGuestDocumentTypes().length && this.extraGuestNationalities().length && this.extraGuestPaxTypes().length) {
      this.applyExtraGuestCatalogDefaults();
      return;
    }

    this.isExtraGuestCatalogLoading.set(true);

    forkJoin({
      documentTypes: this.clienteService.getTipoIdentificacionOptions().pipe(
        catchError((error) => {
          console.error('No se pudieron cargar los tipos de documento.', error);
          return of([] as SelectOption[]);
        })
      ),
      nationalities: this.nationalitiesService.getNationalities().pipe(
        catchError((error) => {
          console.error('No se pudieron cargar las nacionalidades.', error);
          return of([] as Nationality[]);
        })
      ),
      paxTypes: this.paxTypesService.getPaxTypes().pipe(
        catchError((error) => {
          console.error('No se pudieron cargar los tipos de pax.', error);
          return of([] as PaxType[]);
        })
      )
    })
      .pipe(
        finalize(() => this.isExtraGuestCatalogLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ documentTypes, nationalities, paxTypes }) => {
        this.extraGuestDocumentTypes.set(
          documentTypes.map((item) => ({
            codigo: this.cleanText(item.value),
            descripcion: this.cleanText(item.label)
          }))
        );
        this.extraGuestNationalities.set(nationalities);
        this.extraGuestPaxTypes.set(paxTypes);
        this.applyExtraGuestCatalogDefaults();
      });
  }

  private applyExtraGuestCatalogDefaults(): void {
    if (!this.extraGuestForm.controls.tipDocu.value) {
      this.extraGuestForm.controls.tipDocu.setValue(this.extraGuestDocumentTypes()[0]?.codigo ?? '');
    }

    if (!this.extraGuestForm.controls.tiPax.value) {
      this.extraGuestForm.controls.tiPax.setValue(this.extraGuestPaxTypes()[0]?.CR03_CodTipo ?? '');
    }
  }

  private buildExtraGuestPayload(): RoomingListUpdatePayload | null {
    const raw          = this.extraGuestForm.getRawValue();
    const room         = this.room();
    const operador     = this.getOperador();
    const codRsv       = this.cleanText(room.reservationNumber);
    const numHabita    = this.cleanText(room.roomNumber);

    if (!codRsv || !numHabita) {
      return null;
    }

    return {
      proceso       : 6,
      idOpe         : operador,
      codRsv        ,
      numHabita     ,
      codNacion     : this.cleanText(raw.codNacion),
      tipDocu       : this.cleanText(raw.tipDocu),
      numDocu       : this.cleanText(raw.numDocu),
      nombre        : this.cleanText(raw.nombre),
      apellido      : this.cleanText(raw.apellido),
      fecNac        : normalizePmsDateInputDDMMYYYY(raw.fecNac),
      sexo          : this.cleanText(raw.sexo),
      estCivil      : this.cleanText(raw.estCivil),
      tiPax         : this.cleanText(raw.tiPax),
      direccion     : this.cleanText(raw.direccion),
      email         : this.cleanText(raw.email),
      motivo        : this.cleanText(raw.motivo),
      procede       : this.cleanText(raw.procede),
      mdoArribo     : this.cleanText(raw.mdoArribo),
      orden         : this.room().guests.length + 1,
      operador          
    };
  }

  private applyExtraGuest(payload: RoomingListUpdatePayload): void {
    const guest: Guest = {
      name            : [payload.nombre, payload.apellido].map((item) => this.cleanText(item)).filter(Boolean).join(' ') || 'S/D',
      documentType    : payload.tipDocu || 'S/D',
      document        : payload.numDocu || 'S/D',
      nationality     : payload.codNacion || 'S/D',
      birthDate       : payload.fecNac
    };

    this.room.update((currentRoom) => ({
      ...currentRoom,
      guestsCount: currentRoom.guestsCount + 1,
      guests: [...currentRoom.guests, guest],
      observations: [`Huesped agregado al rooming list: ${guest.name}.`, ...currentRoom.observations]
    }));

    this.addTimelineEntry('Huesped agregado', `${guest.name} fue agregado a la habitacion ${payload.numHabita}.`);
  }

  private loadRoomChargePointOfSales(): void {
    this.isRoomChargeCatalogLoading.set(true);
    this.roomChargePointOfSales.set([]);
    this.roomChargeItems.set([]);
    this.roomChargeCatalogPage.set(1);

    this.roomStayManagementService
      .getRoomChargePointOfSales('PF')
      .pipe(
        catchError((error) => {
          console.error('No se pudieron cargar los puntos de venta.', error);
          this.toastService.warning('No se pudieron cargar los puntos de venta del operador.', 3500, 'Cargo habitacion');
          return of([] as RoomChargePointOfSaleApi[]);
        }),
        finalize(() => this.isRoomChargeCatalogLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((pointOfSales) => {
        const mappedPointOfSales = pointOfSales
          .map((pointOfSale) => this.mapRoomChargePointOfSale(pointOfSale))
          .filter((pointOfSale) => pointOfSale.code.length > 0);

        this.roomChargePointOfSales.set(mappedPointOfSales);

        const selectedPointOfSale = mappedPointOfSales[0];
        this.roomChargeDraft.update((draft) => ({
          ...draft,
          pointOfSale: selectedPointOfSale?.code ?? '',
          priceList: selectedPointOfSale?.priceList ?? '',
          currency: selectedPointOfSale?.currency ?? draft.currency
        }));

        if (selectedPointOfSale?.priceList) {
          this.loadRoomChargePriceListItems(selectedPointOfSale.priceList);
        } else if (!mappedPointOfSales.length) {
          this.roomChargeValidationMessage.set('No hay puntos de venta asignados para este operador.');
        }
      });
  }

  private loadRoomChargePriceListItems(priceList: string): void {
    const normalizedPriceList = this.cleanText(priceList);

    if (!normalizedPriceList) {
      this.roomChargeItems.set([]);
      this.roomChargeCatalogPage.set(1);
      this.roomChargeValidationMessage.set('El punto de venta no tiene lista de precios configurada.');
      return;
    }

    this.isRoomChargeItemsLoading.set(true);

    this.roomStayManagementService
      .getRoomChargePriceListItems(normalizedPriceList)
      .pipe(
        catchError((error) => {
          console.error('No se pudo cargar la lista de precios del punto de venta.', error);
          this.toastService.warning('No se pudo cargar la lista de precios del punto de venta.', 3500, 'Cargo habitacion');
          return of([] as RoomChargePriceListApiItem[]);
        }),
        finalize(() => this.isRoomChargeItemsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((items) => {
        this.roomChargeItems.set(items);
        this.roomChargeCatalogPage.set(1);

        if (!items.length) {
          this.roomChargeValidationMessage.set('La lista de precios no tiene consumos disponibles.');
        }
      });
  }

  private mapRoomChargePointOfSale(pointOfSale: RoomChargePointOfSaleApi): RoomChargePointOfSale {
    const pointOfSaleCode = this.cleanText(pointOfSale.MPV10_CodPntVenta || pointOfSale.MPV07_CodPntVenta);
    const priceList = this.cleanText(
      pointOfSale.MPV04_CodLstPrecio || pointOfSale.MPV10_CodLstPrecio || pointOfSale.MPV07_CodLstPrecio
    );

    return {
      code: pointOfSaleCode,
      name: this.cleanText(pointOfSale.MPV07_NomPntVenta) || pointOfSaleCode,
      priceList,
      currency: this.cleanText(pointOfSale.MPV04_Moneda).toUpperCase() || this.invoiceBaseCurrency
    };
  }

  private recalculateRoomChargeLine(line: RoomChargeLine): RoomChargeLine {
    const quantity = Math.max(Number(line.quantity || 0), 0);
    const price = this.roundCurrency(Math.max(Number(line.price || 0), 0));

    return {
      ...line,
      quantity,
      price,
      total: this.roundCurrency(quantity * price)
    };
  }

  private async submitRoomCharge(): Promise<void> {
    if (!this.todayDisplayDate()) {
      this.roomChargeValidationMessage.set('No se puede registrar el cargo sin una fecha operativa válida.');
      return;
    }

    const payload = this.buildRoomChargePayload();

    if (!payload) {
      this.roomChargeValidationMessage.set('Completa huesped, punto de venta y al menos un consumo con monto mayor a 0.');
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Confirmar cargo de habitacion',
      text: `Se registrara un cargo por ${this.formatCurrency(payload.mtoTotal)} a la habitacion ${payload.numHab}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Si, registrar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    this.isRoomChargeSubmitting.set(true);
    this.roomChargeValidationMessage.set('');

    this.roomStayManagementService
      .createRoomCharge(payload)
      .pipe(
        finalize(() => this.isRoomChargeSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (this.isFailedApiResponse(response)) {
            this.roomChargeValidationMessage.set(response.message || 'No se pudo registrar el cargo de habitacion.');
            return;
          }

          this.applySubmittedRoomCharge(payload);
          this.closeActionModal();
          this.loadRoomStay();
        },
        error: (error) => {
          console.error('No se pudo registrar el cargo de habitacion.', error);
          this.roomChargeValidationMessage.set('No se pudo registrar el cargo de habitacion.');
          this.toastService.warning('No se pudo registrar el cargo de habitacion.', 4000, 'Cargo habitacion');
        }
      });
  }

  private buildRoomChargePayload(): RoomChargePayload | null {
    const room             = this.room();
    const draft            = this.roomChargeDraft();
    const guest            = this.selectedRoomChargeGuest();
    const pointOfSale      = this.selectedRoomChargePointOfSale();
    const operator         = this.getOperador();
    const fecha            = this.todayDisplayDate();
    const hora             = this.currentTimeLabel();
    const currency         = this.cleanText(pointOfSale?.currency || draft.currency || this.roomChargeLines()[0]?.currency || this.invoiceBaseCurrency);
    const validLines       = this.roomChargeLines().filter((line) => line.quantity > 0 && line.price >= 0 && line.total > 0);

    if (
      !fecha ||
      !guest ||
      !draft.pointOfSale ||
      !room.reservationNumber ||
      !room.roomNumber ||
      !validLines.length ||
      this.roomChargeTotal() <= 0
    ) {
      return null;
    }

    return {
      proceso       : 1,
      tipCrgHab     : 'CH',
      numCrgHab     : '',
      codRsv        : this.cleanText(room.reservationNumber),
      numHab        : this.cleanText(room.roomNumber),
      pntVenta      : this.cleanText(draft.pointOfSale),
      fecha         ,
      hora          ,
      numDocu       : this.cleanText(guest.document),
      nombrePax     : this.cleanText(guest.name),
      mtoTotal      : this.roomChargeTotal(),
      moneda        : currency,
      cierre        : 0,
      numCierre     : 0,
      operador      : operator,
      detalle       : validLines.map((line, index) => ({
        codRsv        : this.cleanText(room.reservationNumber),
        numHab        : this.cleanText(room.roomNumber),
        pntVenta      : this.cleanText(draft.pointOfSale),
        fecha         ,
        hora          ,
        grupo         : this.cleanText(line.group),
        categoria     : this.cleanText(line.category),
        codConsumo    : this.cleanText(line.code),
        nomConsumo    : this.cleanText(line.name),
        cantidad      : Number(line.quantity || 0),
        precio        : this.roundCurrency(Number(line.price || 0)),
        total         : this.roundCurrency(Number(line.total || 0)),
        moneda        : this.cleanText(line.currency || currency),
        tipNPedido    : '',
        numNPedido    : '',
        codMozo       : '',
        incluido      : 0,
        exonerado     : 0,
        orden         : index + 1,
        comentario    : this.cleanText(line.comment || draft.comment),
        operador      : operator
      }))
    };
  }

  private applySubmittedRoomCharge(payload: RoomChargePayload): void {
    const numCrgHab = this.cleanText(payload.numCrgHab) || this.cleanText(payload.pntVenta);
    const charge: Charge = {
      id                : this.buildChargeId(numCrgHab, payload.fecha, payload.hora, this.room().extraCharges.length),
      tipCrgHab         : this.cleanText(payload.tipCrgHab) || 'CH',
      numCrgHab         ,
      codRsv            : this.cleanText(payload.codRsv),
      numHab            : this.cleanText(payload.numHab),
      date              : payload.fecha,
      time              : payload.hora,
      concept           : payload.detalle.length === 1 ? payload.detalle[0].nomConsumo : `Cargo habitacion ${payload.pntVenta}`,
      reference         : numCrgHab,
      charge            : payload.mtoTotal,
      payment           : 0,
      balance           : this.totalToCharge() + payload.mtoTotal,
      invoiceSelected   : true
    };

    this.room.update((currentRoom) => ({
      ...currentRoom,
      extraCharges: [charge, ...currentRoom.extraCharges],
      observations: [
        `Cargo de habitacion registrado a ${payload.nombrePax} por ${this.formatCurrency(payload.mtoTotal)}.`,
        ...currentRoom.observations
      ]
    }));

    this.addTimelineEntry('Cargo de habitacion', `${payload.detalle.length} consumo(s) registrados desde ${payload.pntVenta}.`);
    this.toastService.success('Cargo de habitacion registrado correctamente.', 4000, 'Cargo habitacion');
  }

  private loadAvailableRoomsForChange(): void {
    const room = this.room();
    const category = this.cleanText(room.roomCategory);

    if (!room.checkIn || !room.checkOut || !category) {
      this.availableRoomsLoaded.set(true);
      this.availableRoomOptions.set([]);
      this.toastService.warning('No hay datos suficientes para consultar disponibilidad.', 3500, 'Habitaciones');
      return;
    }

    this.isAvailableRoomsLoading.set(true);
    this.availableRoomsLoaded.set(false);
    this.availableRoomOptions.set([]);

    this.roomStayManagementService
      .getAvailableRooms(room.checkIn, room.checkOut, category)
      .pipe(
        catchError((error) => {
          console.error('No se pudo cargar la disponibilidad de habitaciones.', error);
          this.toastService.warning('No se pudo cargar habitaciones disponibles.', 3500, 'Habitaciones');
          return of([] as RoomAvailabilityApiRoom[]);
        }),
        finalize(() => this.isAvailableRoomsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((availableRooms) => {
        const options = availableRooms
          .filter((item) => Number(item.cantidadDisponible ?? 0) > 0)
          .map((item) => this.mapAvailableRoomOption(item));

        this.availableRoomOptions.set(options);
        this.availableRoomsLoaded.set(true);

        const firstOption = options[0];
        if (firstOption) {
          this.updateActionDraft({
            targetRoom: firstOption.number,
            targetRoomType: firstOption.type
          });
        } else {
          this.toastService.info('No hay habitaciones disponibles para la categoria y fechas seleccionadas.', 3500, 'Habitaciones');
        }
      });
  }

  private mapAvailableRoomOption(room: RoomAvailabilityApiRoom): RoomOption {
    const description = this.cleanText(room.descripcion) || this.cleanText(room.cateHab) || 'Habitacion';
    const type = this.cleanText(room.tipoHab);

    return {
      number: this.cleanText(room.numHab),
      type: type ? `${description} / ${type}` : description
    };
  }

  private loadRoomStay(): void {
    const roomNumber = this.requestedRoomNumber || this.room().roomNumber;

    if (!roomNumber) {
      return;
    }

    this.isStayLoading.set(true);
    this.stayErrorMessage.set('');

    this.roomStayManagementService
      .getRoomStay(roomNumber, this.requestedReservationNumber)
      .pipe(
        catchError((error) => {
          console.error('No se pudo cargar la estancia de la habitacion.', error);
          this.stayErrorMessage.set('No se pudo cargar la informacion real de la estancia.');
          this.toastService.warning('Se mantiene la informacion disponible del Room Rack.', 3500, 'Estancia');
          return of(null);
        }),
        finalize(() => this.isStayLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((stay) => {
        if (!stay) {
          return;
        }

        this.room.set(this.mapApiStayToRoomStay(stay));
        this.requestedReservationNumber = stay.codReserva;
      });
  }

  private mapApiStayToRoomStay(stay: RoomStayApiData): RoomStay {
    const checkIn = this.formatApiDate(stay.fechaIng);
    const checkOut = this.formatApiDate(stay.fechaSal);
    const observations = [stay.observacion]
      .map((item) => this.cleanText(item))
      .filter((item) => item.length > 0);

    return {
      roomNumber            : this.cleanText(stay.numHabita) || this.room().roomNumber,
      roomType              : [stay.catHabi, stay.tipHabi].map((item) => this.cleanText(item)).filter(Boolean).join(' / ') || this.room().roomType,
      roomCategory          : this.cleanText(stay.catHabi) || this.room().roomCategory,
      status                : 'OCCUPIED',
      agency                : this.cleanText(stay.nombreAgencia) || this.cleanText(stay.codAgencia) || 'S/D',
      rate                  : this.cleanText(stay.codTarifa) || 'S/D',
      reservationNumber     : this.cleanText(stay.codReserva) || this.room().reservationNumber,
      checkIn               ,
      checkOut              ,
      nights                : Number(stay.noches ?? 0),
      guestsCount           : Number(stay.numPax ?? stay.roomingList?.length ?? 0),
      childrenCount         : Number(stay.numChild ?? 0),
      masterFolio           : this.cleanText(stay.folio) || 'S/F',
      plan                  : this.cleanText(stay.codPlan) || 'S/D',
      reservedAt            : '',
      observations          ,
      comments              : this.cleanText(stay.comentarios),
      guests                : Array.isArray(stay.roomingList)
        ? stay.roomingList
            .slice()
            .sort((left, right) => Number(left.orden ?? 0) - Number(right.orden ?? 0))
            .map((guest) => ({
              name            : [guest.nombre, guest.apellidos].map((item) => this.cleanText(item)).filter(Boolean).join(' ') || 'S/D',
              documentType    : this.cleanText(guest.tipDocu) || 'S/D',
              document        : this.cleanText(guest.numDocu) || this.cleanText(guest.numInterno) || 'S/D',
              nationality     : this.cleanText(guest.nacionalidad) || 'S/D',
              birthDate       : this.formatApiDate(guest.fecNaci)
            }))
        : [],
      lodgingCharges        : this.mapApiCharges(stay.cargosFolioMaster),
      extraCharges          : this.mapApiCharges(stay.cargosExtras),
      prepaid               : 0,
      operator              :
        this.cleanText(stay.roomingList?.[0]?.operador) ||
        this.cleanText(stay.cargosFolioMaster?.[0]?.operador) ||
        this.cleanText(stay.cargosExtras?.[0]?.operador) ||
        this.room().operator
    };
  }

  private mapApiCharges(charges: RoomStayApiCharge[] | null | undefined): Charge[] {
    let balance = 0;

    if (!Array.isArray(charges)) {
      return [];
    }

    return charges.map((charge, index) => {
      const amount      = Number(charge.totCargo ?? 0);
      balance           += amount;
      const date        = this.formatApiDate(charge.fecCargo);
      const time        = this.formatApiTime(charge.horaCargo);
      const reference   = this.cleanText(charge.numCrgHab) || this.cleanText(charge.folio);
      const apiCharge   = charge as RoomStayApiCharge & { tipCrgHab?: string; tipoCrgHab?: string; tipCargo?: string };

      return {
        id                : this.buildChargeId(reference, date, time, index),
        tipCrgHab         : this.cleanText(apiCharge.tipCrgHab) || this.cleanText(apiCharge.tipoCrgHab) || this.cleanText(apiCharge.tipCargo) || 'CHB',
        numCrgHab         : this.cleanText(charge.numCrgHab) || reference,
        codRsv            : this.cleanText(charge.codReserva) || this.cleanText(this.room().reservationNumber),
        numHab            : this.cleanText(charge.numHab) || this.cleanText(this.room().roomNumber),
        date              ,
        time              ,
        concept           : this.cleanText(charge.nombreHuesped) || 'Cargo',
        reference         ,
        charge            : amount,
        payment           : 0,
        balance           ,
        invoiceSelected   : true
      };
    });
  }

  private formatApiTime(value: string | null | undefined): string {
    const [hour, minute] = this.cleanText(value).split(':');

    if (!hour || !minute) {
      return this.cleanText(value);
    }

    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  private formatApiDate(value: string | null | undefined): string {
    return normalizePmsDateDDMMYYYY(value);
  }

  private cleanText(value: string | number | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private roomChargeDocumentKey(charge: Charge): string {
    return this.cleanText(charge.numCrgHab || charge.reference || charge.id);
  }

  private setRoomChargeDocumentJob(charge: Charge, job: 'pdf' | 'pos' | null): void {
    const key = this.roomChargeDocumentKey(charge);
    this.roomChargeDocumentJobs.update((jobs) => {
      const next = { ...jobs };
      if (job) {
        next[key] = job;
      } else {
        delete next[key];
      }
      return next;
    });
  }

  private documentErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }
    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }
    return fallback;
  }

  private normalizeSearchTerm(value: string | number | null | undefined): string {
    return this.cleanText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private sumCharges(charges: Charge[]): number {
    return charges.reduce((total, item) => total + item.charge - item.payment, 0);
  }

  private sumSelectedCharges(charges: Charge[]): number {
    return this.sumCharges(charges.filter((charge) => charge.invoiceSelected));
  }

  private getSelectedInvoiceCharges(): Charge[] {
    const room = this.room();

    return [...room.lodgingCharges, ...room.extraCharges].filter((charge) => charge.invoiceSelected);
  }

  private chargeBusinessKey(charge: Charge): string {
    return [
      this.cleanText(charge.tipCrgHab).toUpperCase(),
      this.cleanText(charge.numCrgHab || charge.reference)
    ].join('|');
  }

  private invoiceChargeSnapshot(charges: Charge[]): string {
    return charges
      .map((charge) => `${this.chargeBusinessKey(charge)}|${this.roundCurrency(charge.charge)}|${this.roundCurrency(charge.payment)}`)
      .sort()
      .join('||');
  }

  private applyInvoiceSelection(selectedChargeKeys: ReadonlySet<string>): void {
    this.room.update((currentRoom) => {
      const applySelection = (charges: Charge[]) =>
        charges.map((charge) => ({
          ...charge,
          invoiceSelected: selectedChargeKeys.has(this.chargeBusinessKey(charge))
        }));

      return {
        ...currentRoom,
        lodgingCharges: applySelection(currentRoom.lodgingCharges),
        extraCharges: applySelection(currentRoom.extraCharges)
      };
    });
  }

  private async refreshStayForCriticalOperation(operationLabel: string): Promise<RoomStay | null> {
    if (this.isCriticalStayRefreshing()) {
      return null;
    }

    const currentRoom = this.room();
    const roomNumber = this.cleanText(this.requestedRoomNumber || currentRoom.roomNumber);
    const reservationNumber = this.cleanText(this.requestedReservationNumber || currentRoom.reservationNumber);

    if (!roomNumber) {
      this.toastService.warning('No se pudo identificar la habitación que debe actualizarse.', 4000, 'Estancia');
      return null;
    }

    this.isCriticalStayRefreshing.set(true);

    try {
      const stay = await firstValueFrom(
        this.roomStayManagementService.getRoomStay(roomNumber, reservationNumber)
      );

      if (!stay) {
        throw new Error('El backend no devolvió la estancia solicitada.');
      }

      const refreshedRoom = this.mapApiStayToRoomStay(stay);
      const refreshedReservation = this.cleanText(refreshedRoom.reservationNumber);
      const reservationChanged = Boolean(
        reservationNumber &&
        refreshedReservation &&
        reservationNumber !== refreshedReservation
      );

      this.room.set(refreshedRoom);
      this.requestedRoomNumber = refreshedRoom.roomNumber;
      this.requestedReservationNumber = refreshedReservation;
      this.stayErrorMessage.set('');

      if (reservationChanged) {
        this.toastService.warning(
          'La habitación ahora pertenece a otra reserva. La operación fue cancelada y la vista fue actualizada.',
          5500,
          'Estancia'
        );
        return null;
      }

      return refreshedRoom;
    } catch (error) {
      console.error(`No se pudo actualizar la estancia antes de ${operationLabel}.`, error);
      this.toastService.warning(
        `No se pudo actualizar la estancia antes de ${operationLabel}. La operación fue cancelada.`,
        5000,
        'Estancia'
      );
      return null;
    } finally {
      this.isCriticalStayRefreshing.set(false);
    }
  }

  private buildChargeId(reference: string, date: string, time: string, index: number): string {
    return [reference || 'SIN-REF', date || 'SIN-FECHA', time || 'SIN-HORA', index].join('|');
  }

  private resetInvoicePaymentsForSelectionChange(): void {
    this.invoiceAppliedPayments.set([]);
    this.invoiceValidationMessage.set('');
    this.invoicePaymentDraft.update((draft) => ({
      ...draft,
      amount: this.roundCurrency(this.convertPaymentFromInvoiceCurrency(this.invoiceTotal(), draft.moneda, this.getInvoiceDraftExchangeRate(draft)))
    }));
  }

  private resetInvoiceDraft(): void {
    const defaultMethod = this.invoicePaymentMethods()[0]?.code ?? '';
    const defaultCurrency = this.getDefaultInvoiceCurrency();

    this.selectedInvoiceClient.set(null);
    this.invoiceClientSearch.set('');
    this.invoiceClientSearchChanges.next('');
    this.invoiceCatalogClients.set([]);
    this.invoiceClientSearchError.set('');
    this.isInvoiceClientSearchLoading.set(false);
    this.invoiceAppliedPayments.set([]);
    this.invoiceUsdExchangeRate.set(null);
    this.invoiceSelectedExchangeRate.set(null);
    this.invoiceValidationMessage.set('');
    this.invoicePaymentDraft.set({
      methodCode      : defaultMethod,
      moneda          : defaultCurrency,
      amount          : this.invoiceTotal(),
      numTarjeta      : '00000',
      vencimiento     : '00/00',
      tCambio         : defaultCurrency === this.invoiceBaseCurrency ? 1 : 0
    });

    this.loadInvoiceExchangeRateForCurrency(defaultCurrency);
  }

  private setupInvoiceClientSearch(): void {
    this.invoiceClientSearchChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => {
          const query = this.cleanText(value);
          this.invoiceClientSearchError.set('');

          if (query.length < 2) {
            this.invoiceCatalogClients.set([]);
            this.isInvoiceClientSearchLoading.set(false);
            return of(null);
          }

          this.isInvoiceClientSearchLoading.set(true);

          return this.clienteService.getClientes(1, 8, query).pipe(
            catchError((error) => {
              console.error('No se pudieron buscar los clientes para facturación.', error);
              this.invoiceClientSearchError.set('No se pudieron consultar los clientes.');
              return of({ data: [] as ClienteUI[], totalRegistros: 0, paginaActual: 1, pageSize: 8, totalPages: 1 });
            }),
            finalize(() => this.isInvoiceClientSearchLoading.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.invoiceCatalogClients.set(response?.data?.map((client) => this.mapInvoiceClient(client)) ?? []);
      });
  }

  private mapInvoiceClient(client: ClienteUI): InvoiceClient {
    return {
      code: this.cleanText(client.codigo),
      name: this.cleanText(client.nombre) || 'CLIENTE SIN NOMBRE',
      document: this.cleanText(client.ruc),
      address: this.cleanText(client.direccion) || 'S/D',
      email: this.cleanText(client.email || client.emailPrincipal),
      enviarCorreo: client.enviarCorreo === true
    };
  }

  private loadInvoiceCatalogs(): void {
    this.isInvoiceCatalogLoading.set(true);

    this.roomStayManagementService
      .getPointOfSalePaymentMethods('PF')
      .pipe(
        catchError((error) => {
          console.error('No se pudo cargar formas de pago de punto de venta.', error);
          this.toastService.warning('No se pudieron cargar las formas de pago.', 3500, 'Facturacion');
          return of([] as PointOfSalePaymentMethodApi[]);
        }),
        finalize(() => this.isInvoiceCatalogLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((methods) => {
        const mappedMethods = methods.map((method) => this.mapInvoicePaymentMethod(method));
        this.invoicePaymentMethods.set(mappedMethods);

        const currentMethod = this.invoicePaymentDraft().methodCode;
        if (!currentMethod || !mappedMethods.some((method) => method.code === currentMethod)) {
          this.updateInvoicePaymentDraft({ methodCode: mappedMethods[0]?.code ?? '' });
        }
      });

    this.loadInvoicePointOfSaleDocuments();

    if (!this.invoiceCurrencies().length) {
      this.monedaService
        .getAll()
        .pipe(
          catchError((error) => {
            console.error('No se pudo cargar monedas.', error);
            this.toastService.warning('No se pudo cargar el catalogo de monedas.', 3500, 'Facturacion');
            return of([] as MonedaUI[]);
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((currencies) => {
          const activeCurrencies = currencies
            .filter((currency) => Number(currency.activo ?? 0) !== 0)
            .sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0));

          this.invoiceCurrencies.set(activeCurrencies);

          const defaultCurrency = this.getDefaultInvoiceCurrency();
          const draft = this.invoicePaymentDraft();
          if (!draft.moneda || !this.invoiceCurrencyOptions().some((currency) => currency.codMoneda === draft.moneda)) {
            this.updateInvoicePaymentDraft({ moneda: defaultCurrency, tCambio: defaultCurrency === this.invoiceBaseCurrency ? 1 : 0 });
          }
        });
    }
  }

  private loadInvoicePointOfSaleDocuments(): void {
    this.isInvoiceDocumentsLoading.set(true);
    this.invoiceDocumentSelectionError.set('');
    this.invoicePointOfSaleDocuments.set([]);

    this.roomStayManagementService
      .getPointOfSaleDocuments('PF')
      .pipe(
        catchError((error) => {
          console.error('No se pudieron cargar los documentos del punto de venta PF.', error);
          this.invoiceDocumentSelectionError.set('No se pudieron cargar los tipos de documento.');
          return of([] as PointOfSaleDocumentApi[]);
        }),
        finalize(() => this.isInvoiceDocumentsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((documents) => {
        this.invoicePointOfSaleDocuments.set(
          documents.map((document) => ({
            ...document,
            MPV31_CodPntVenta: this.cleanText(document.MPV31_CodPntVenta).toUpperCase(),
            MPV31_CodDocu: this.cleanText(document.MPV31_CodDocu).toUpperCase(),
            MPV31_Descripcion: this.cleanText(document.MPV31_Descripcion),
            MPV31_Principal: Number(document.MPV31_Principal || 0),
            MPV31_Operador: this.cleanText(document.MPV31_Operador)
          }))
        );

        if (!this.selectedInvoiceDocument() && !this.invoiceDocumentSelectionError()) {
          this.invoiceDocumentSelectionError.set('No hay documentos configurados para el punto de venta PF.');
        }
      });
  }

  private mapInvoicePaymentMethod(method: PointOfSalePaymentMethodApi): InvoicePaymentMethod {
    return {
      code            : this.cleanText(method.CA05_Codigo),
      description     : this.cleanText(method.CA05_Descripcion) || this.cleanText(method.CA05_Codigo),
      tipo            : this.cleanText(method.CA05_Tipo),
      tipPago         : this.cleanText(method.CA05_TipPago),
      ndias           : Number(method.CA05_NDias ?? 0)
    };
  }

  private loadInvoiceExchangeRateForCurrency(currency: string): void {
    const moneda = this.cleanText(currency).toUpperCase();
    const operationalDate = this.todayDisplayDate();

    if (!operationalDate) {
      this.invoiceValidationMessage.set('No se puede consultar el tipo de cambio sin una fecha operativa válida.');
      return;
    }

    const selectedCurrency = moneda || this.invoiceBaseCurrency;
    const requestId = ++this.invoiceExchangeRateRequestId;
    const selectedCurrencyRequest =
      selectedCurrency === this.invoiceBaseCurrency || selectedCurrency === 'COL'
        ? of([] as TipoCambio[])
        : this.tipoCambioService.fetchTipoCambio(operationalDate, selectedCurrency.toLowerCase()).pipe(
            catchError((error) => {
              console.error(`No se pudo cargar el tipo de cambio de ${selectedCurrency}.`, error);
              return of([] as TipoCambio[]);
            })
          );

    this.isInvoiceExchangeRateLoading.set(true);

    forkJoin({
      usdItems: this.tipoCambioService.fetchTipoCambio(operationalDate, this.invoiceBaseCurrency.toLowerCase()).pipe(
        catchError((error) => {
          console.error('No se pudo cargar el tipo de cambio de USD.', error);
          return of([] as TipoCambio[]);
        })
      ),
      selectedItems: selectedCurrencyRequest
    })
      .pipe(
        finalize(() => {
          if (requestId === this.invoiceExchangeRateRequestId) {
            this.isInvoiceExchangeRateLoading.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ usdItems, selectedItems }) => {
        if (requestId !== this.invoiceExchangeRateRequestId) {
          return;
        }

        const usdQuote = usdItems[0] ?? null;
        const selectedQuote = selectedCurrency === this.invoiceBaseCurrency
          ? usdQuote
          : selectedCurrency === 'COL'
            ? this.buildLocalCurrencyQuote(operationalDate)
            : selectedItems[0] ?? null;
        const exchangeRate = this.calculateInvoicePaymentExchangeRate(
          selectedCurrency,
          usdQuote,
          selectedQuote
        );

        this.invoiceUsdExchangeRate.set(usdQuote);
        this.invoiceSelectedExchangeRate.set(selectedQuote);
        this.invoicePaymentDraft.update((draft) => ({
          ...draft,
          moneda: selectedCurrency,
          amount: exchangeRate > 0
            ? this.roundCurrency(this.convertPaymentFromInvoiceCurrency(this.invoicePending(), selectedCurrency, exchangeRate))
            : null,
          tCambio: exchangeRate
        }));

        if (!usdQuote) {
          this.invoiceValidationMessage.set(
            selectedCurrency === this.invoiceBaseCurrency
              ? 'No se pudo mostrar el tipo de cambio de USD para la fecha operativa.'
              : 'No se pudo obtener el tipo de cambio de USD requerido para convertir el pago.'
          );
        } else if (selectedCurrency !== this.invoiceBaseCurrency && exchangeRate <= 0) {
          this.invoiceValidationMessage.set(`No hay un tipo de cambio válido para recibir pagos en ${selectedCurrency}.`);
        }
      });
  }

  private async validateInvoiceExchangeRatesBeforeSubmit(): Promise<boolean> {
    const payments = this.invoiceAppliedPayments();
    const draftCurrency = this.cleanText(this.invoicePaymentDraft().moneda).toUpperCase();
    const requestedCurrencies = [
      ...new Set(
        [...payments.map((payment) => payment.moneda), draftCurrency]
          .map((currency) => this.cleanText(currency).toUpperCase())
          .filter((currency) => currency && currency !== this.invoiceBaseCurrency && currency !== 'COL')
      )
    ];

    this.isInvoiceExchangeRateLoading.set(true);
    const requestId = ++this.invoiceExchangeRateRequestId;

    try {
      const operationalDate = normalizePmsDateDDMMYYYY(
        await firstValueFrom(this.operationalDateService.refresh())
      );
      if (!operationalDate) {
        throw new Error('El backend no devolvió una fecha operativa válida.');
      }

      const responses = await firstValueFrom(
        forkJoin([
          this.tipoCambioService.fetchTipoCambio(operationalDate, this.invoiceBaseCurrency.toLowerCase()),
          ...requestedCurrencies.map((currency) =>
            this.tipoCambioService.fetchTipoCambio(operationalDate, currency.toLowerCase())
          )
        ])
      );
      const usdQuote = responses[0]?.[0] ?? null;
      const quoteByCurrency = new Map<string, TipoCambio>();

      requestedCurrencies.forEach((currency, index) => {
        const quote = responses[index + 1]?.[0];
        if (quote) {
          quoteByCurrency.set(currency, quote);
        }
      });

      this.invoiceUsdExchangeRate.set(usdQuote);

      const invalidPayment = payments.find((payment) => {
        const currency = this.cleanText(payment.moneda).toUpperCase();
        if (currency === this.invoiceBaseCurrency) {
          return false;
        }

        const quote = currency === 'COL'
          ? this.buildLocalCurrencyQuote(operationalDate)
          : quoteByCurrency.get(currency) ?? null;
        const currentRate = this.calculateInvoicePaymentExchangeRate(currency, usdQuote, quote);

        return (
          currentRate <= 0 ||
          Math.abs(currentRate - Number(payment.tCambio || 0)) > 0.000001 ||
          normalizePmsDateDDMMYYYY(payment.rateDate) !== operationalDate
        );
      });

      const selectedQuote = draftCurrency === this.invoiceBaseCurrency
        ? usdQuote
        : draftCurrency === 'COL'
          ? this.buildLocalCurrencyQuote(operationalDate)
          : quoteByCurrency.get(draftCurrency) ?? null;
      const draftRate = this.calculateInvoicePaymentExchangeRate(draftCurrency, usdQuote, selectedQuote);

      this.invoiceSelectedExchangeRate.set(selectedQuote);

      if (invalidPayment) {
        this.invoiceAppliedPayments.set([]);
        this.invoicePaymentDraft.update((draft) => ({
          ...draft,
          amount: draftRate > 0
            ? this.roundCurrency(this.convertPaymentFromInvoiceCurrency(this.invoiceTotal(), draftCurrency, draftRate))
            : null,
          tCambio: draftRate
        }));
        this.invoiceValidationMessage.set(
          'La fecha operativa o el tipo de cambio cambió. Las formas de pago fueron limpiadas; vuelva a agregarlas con la tasa vigente.'
        );
        return false;
      }

      this.invoicePaymentDraft.update((draft) => ({ ...draft, tCambio: draftRate }));
      return true;
    } catch (error) {
      console.error('No se pudo revalidar el tipo de cambio antes de facturar.', error);
      this.invoiceValidationMessage.set(
        'No se pudo validar el tipo de cambio vigente. La facturación fue bloqueada para evitar una conversión incorrecta.'
      );
      return false;
    } finally {
      if (requestId === this.invoiceExchangeRateRequestId) {
        this.isInvoiceExchangeRateLoading.set(false);
      }
    }
  }

  private buildLocalCurrencyQuote(operationalDate: string): TipoCambio {
    return {
      fecha: toPmsDateInputValue(operationalDate),
      monedaBase: 'COL',
      monedaReferencia: 'COL',
      compra: 1,
      venta: 1
    };
  }

  private calculateInvoicePaymentExchangeRate(
    currency: string,
    usdQuote: TipoCambio | null,
    paymentQuote: TipoCambio | null
  ): number {
    const paymentCurrency = this.cleanText(currency).toUpperCase();
    if (!paymentCurrency || paymentCurrency === this.invoiceBaseCurrency) {
      return 1;
    }

    const usdSellingRate = Number(usdQuote?.venta ?? 0);
    const paymentBuyingRate = paymentCurrency === 'COL'
      ? 1
      : Number(paymentQuote?.compra ?? 0);

    if (
      !Number.isFinite(usdSellingRate) ||
      usdSellingRate <= 0 ||
      !Number.isFinite(paymentBuyingRate) ||
      paymentBuyingRate <= 0
    ) {
      return 0;
    }

    return this.roundExchangeRate(usdSellingRate / paymentBuyingRate);
  }

  private getDefaultInvoiceCurrency(): string {
    const currencies = this.invoiceCurrencyOptions();
    const usdCurrency = currencies.find((currency) => this.cleanText(currency.codMoneda).toUpperCase() === this.invoiceBaseCurrency);

    return this.cleanText(usdCurrency?.codMoneda || currencies[0]?.codMoneda || this.invoiceBaseCurrency).toUpperCase();
  }

  private getInvoiceDraftExchangeRate(draft: InvoicePaymentDraft): number {
    const moneda = this.cleanText(draft.moneda).toUpperCase();

    if (!moneda || moneda === this.invoiceBaseCurrency) {
      return 1;
    }

    const rate = Number(draft.tCambio ?? 0);
    return Number.isFinite(rate) && rate > 0 ? rate : 0;
  }

  private convertPaymentToInvoiceCurrency(amount: number, currency: string, rate: number): number {
    const paymentCurrency = this.cleanText(currency).toUpperCase();

    if (!amount || !paymentCurrency) {
      return 0;
    }

    if (paymentCurrency === this.invoiceBaseCurrency) {
      return amount;
    }

    return rate > 0 ? amount / rate : 0;
  }

  private convertPaymentFromInvoiceCurrency(amount: number, currency: string, rate: number): number {
    const paymentCurrency = this.cleanText(currency).toUpperCase();

    if (!amount || !paymentCurrency) {
      return 0;
    }

    if (paymentCurrency === this.invoiceBaseCurrency) {
      return amount;
    }

    return rate > 0 ? amount * rate : 0;
  }

  private buildActionDraft(actionId?: StayActionId): ActionModalDraft {
    const room = this.room();
    const roomOptions = this.buildRoomOptions(room.roomNumber);
    const firstOption = actionId === 'change-room' ? null : roomOptions[0];
    const currentBalance = this.sumCharges(room.lodgingCharges) + this.sumCharges(room.extraCharges) - room.prepaid;

    return {
      targetRoom                : firstOption?.number ?? room.roomNumber,
      targetRoomType            : firstOption?.type ?? room.roomType,
      newCheckOut               : normalizePmsDateDDMMYYYY(room.checkOut),
      prepaymentAmount          : Math.max(Math.round(currentBalance * 0.35), 25),
      chargeConcept             : actionId === 'new-charge' ? 'Cargo operativo manual' : 'Ajuste operativo',
      chargeAmount              : 45,
      chargeBucket              : actionId === 'new-charge' ? 'extras' : 'lodging',
      destinationFolio          : `${room.masterFolio}-AUX`,
      notes                     : '',
      documentFormat            : 'pdf'
    };
  }

  private buildRoomChargeDraft(): RoomChargeDraft {
    const firstGuest = this.room().guests[0];

    return {
      guestDocument     : firstGuest?.document ?? '',
      pointOfSale       : '',
      priceList         : '',
      currency          : this.invoiceBaseCurrency,
      itemSearch        : '',
      comment           : ''
    };
  }

  private buildRoomOptions(_currentRoomNumber: string): RoomOption[] {
    return [];
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

  private async confirmRoomChange(): Promise<void> {
    const payload = this.buildRoomChangePayload();

    if (!payload) {
      this.toastService.warning('Faltan datos para preparar el cambio de habitacion.', 3500, 'Habitaciones');
      return;
    }

    if (payload.oldHab === payload.newHab) {
      this.toastService.info('Selecciona una habitacion distinta a la actual.', 3000, 'Habitaciones');
      return;
    }

    this.isRoomChangeSubmitting.set(true);

    const confirmation = await Swal.fire({
      title: 'Confirmar cambio de habitacion',
      text: `Se cambiara la reserva ${payload.codReserva} de la habitacion ${payload.oldHab} a la ${payload.newHab}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Si, cambiar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (!confirmation.isConfirmed) {
      this.isRoomChangeSubmitting.set(false);
      return;
    }

    this.roomStayManagementService
      .changeRoom(payload)
      .pipe(
        finalize(() => this.isRoomChangeSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (this.isFailedApiResponse(response)) {
            this.toastService.warning(response.message || 'No se pudo preparar el cambio de habitacion.', 4000, 'Habitaciones');
            return;
          }

          this.applyRoomChange();
          this.requestedRoomNumber = payload.newHab;
          this.closeActionModal();
          this.router.navigate(['/front-desk/room-rack']);
        },
        error: (error) => {
          console.error('No se pudo preparar el cambio de habitacion.', error);
          this.toastService.warning('No se pudo preparar el cambio de habitacion.', 4000, 'Habitaciones');
        }
      });
  }

  private buildRoomChangePayload(): RoomChangePayload | null {
    const room = this.room();
    const draft = this.actionDraft();
    const payload: RoomChangePayload = {
      codReserva    : this.cleanText(room.reservationNumber),
      oldHab        : this.cleanText(room.roomNumber),
      newHab        : this.cleanText(draft.targetRoom),
      folio         : this.cleanText(room.masterFolio),
      operador      : this.getOperador()
    };

    return Object.values(payload).every((value) => value.length > 0) ? payload : null;
  }

  private getOperador(): string {
    const user = this.authService.getCurrentUser();
    return this.cleanText(user?.usuario || user?.nombre || this.room().operator || 'SISTEMA');
  }

  private isFailedApiResponse(response: unknown): response is { success: false; message?: string } {
    return (
      typeof response === 'object' &&
      response !== null &&
      Object.prototype.hasOwnProperty.call(response, 'success') &&
      (response as { success?: boolean }).success === false
    );
  }

  private async submitDepartureChange(): Promise<void> {
    if (this.isDepartureChangeSubmitting()) {
      return;
    }

    this.isDepartureChangeSubmitting.set(true);

    try {
      await firstValueFrom(this.operationalDateService.refresh());
    } catch (error) {
      console.error('No se pudo actualizar la fecha operativa antes de cambiar la salida.', error);
      this.toastService.warning(
        'No se pudo validar la fecha operativa actual. El cambio de salida fue bloqueado.',
        4500,
        'Fecha operativa'
      );
      this.isDepartureChangeSubmitting.set(false);
      return;
    }

    const validationMessage = this.departureDateValidationMessage();
    if (validationMessage) {
      this.toastService.warning(validationMessage, 4000, 'Reserva');
      this.isDepartureChangeSubmitting.set(false);
      return;
    }

    const payload = this.buildDepartureDateChangePayload();
    if (!payload) {
      this.toastService.warning('Faltan datos para actualizar la fecha de salida.', 3500, 'Reserva');
      this.isDepartureChangeSubmitting.set(false);
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Confirmar cambio de salida',
      text: `Se actualizara la salida de la reserva ${payload.codReserva} para el ${payload.fechaSalida}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Si, actualizar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (!confirmation.isConfirmed) {
      this.isDepartureChangeSubmitting.set(false);
      return;
    }

    this.executeDepartureChange(payload);
  }

  private executeDepartureChange(payload: DepartureDateChangePayload): void {
    this.isDepartureChangeSubmitting.set(true);

    this.roomStayManagementService
      .changeDepartureDate(payload)
      .pipe(
        finalize(() => this.isDepartureChangeSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (this.isFailedApiResponse(response)) {
            this.toastService.warning(response.message || 'No se pudo actualizar la fecha de salida.', 4000, 'Reserva');
            return;
          }

          this.applyDepartureChange();
          this.closeActionModal();
          this.loadRoomStay();
        },
        error: (error) => {
          console.error('No se pudo actualizar la fecha de salida.', error);
          this.toastService.warning('No se pudo actualizar la fecha de salida.', 4000, 'Reserva');
        }
      });
  }

  private buildDepartureDateChangePayload(): DepartureDateChangePayload | null {
    const room = this.room();
    const fechaSalida = this.formatInputDateForApi(this.actionDraft().newCheckOut);
    const payload: DepartureDateChangePayload = {
      codReserva: this.cleanText(room.reservationNumber),
      habitacion: this.cleanText(room.roomNumber),
      fechaSalida,
      operador: this.getOperador()
    };

    return Object.values(payload).every((value) => value.length > 0) ? payload : null;
  }

  private applyDepartureChange(): void {
    const draft = this.actionDraft();
    const formattedCheckOut = this.formatInputDateForApi(draft.newCheckOut);

    if (!formattedCheckOut) {
      this.toastService.warning('La fecha de salida no tiene un formato valido.', 3500, 'Reserva');
      return;
    }

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
      id                  : this.buildChargeId(this.room().masterFolio, this.todayDisplayDate(), this.currentTimeLabel(), this.room().lodgingCharges.length),
      tipCrgHab           : 'CH',
      numCrgHab           : this.cleanText(this.room().masterFolio),
      codRsv              : this.cleanText(this.room().reservationNumber),
      numHab              : this.cleanText(this.room().roomNumber),
      date                : this.todayDisplayDate(),
      time                : this.currentTimeLabel(),
      concept             : 'Sincronizacion de folio',
      reference           : this.room().masterFolio,
      charge              : 0,
      payment             : 0,
      balance             : this.totalToCharge(),
      invoiceSelected     : false
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
        id: this.buildChargeId(
          draft.chargeBucket === 'lodging' ? this.room().masterFolio : `EXT-${this.room().roomNumber}`,
          this.todayDisplayDate(),
          this.currentTimeLabel(),
          draft.chargeBucket === 'lodging' ? this.room().lodgingCharges.length : this.room().extraCharges.length
        ),
        tipCrgHab   : 'CH',
        numCrgHab   : draft.chargeBucket === 'lodging' ? this.cleanText(this.room().masterFolio) : `EXT-${this.cleanText(this.room().roomNumber)}`,
        codRsv      : this.cleanText(this.room().reservationNumber),
        numHab      : this.cleanText(this.room().roomNumber),
        date        : this.todayDisplayDate(),
        time        : this.currentTimeLabel(),
        concept     : draft.chargeConcept,
        reference           : draft.chargeBucket === 'lodging' ? this.room().masterFolio : `EXT-${this.room().roomNumber}`,
        charge              : draft.chargeAmount,
        payment             : 0,
        balance             : currentBalance,
        invoiceSelected     : true
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

  private async generateRoomStatement(): Promise<void> {
    if (this.isStatementGenerating()) {
      return;
    }

    const room = this.room();
    const roomNumber = this.cleanText(room.roomNumber);
    const reservationNumber = this.cleanText(room.reservationNumber);
    const format = this.actionDraft().documentFormat;

    if (!roomNumber || !reservationNumber) {
      this.toastService.warning(
        'La habitación o la reserva no están disponibles para generar el Estado de Cuenta.',
        4500,
        'Estado de Cuenta'
      );
      return;
    }

    this.isStatementGenerating.set(true);

    try {
      if (format === 'print') {
        await this.roomStatementPosService.print(roomNumber, reservationNumber, 'TIQUETE');
        this.toastService.success(
          'Estado de Cuenta enviado a la impresora TIQUETE.',
          4000,
          'Estado de Cuenta'
        );
      } else {
        const result = await this.roomStatementPdfService.open(roomNumber, reservationNumber);
        this.toastService.success(
          result === 'opened'
            ? 'El Estado de Cuenta se abrió en una nueva pestaña.'
            : 'El navegador bloqueó la vista previa; el PDF fue descargado.',
          4500,
          'Estado de Cuenta'
        );
      }

      this.addTimelineEntry(
        'Estado de Cuenta generado',
        `Documento informativo generado en formato ${format === 'print' ? 'POS' : 'PDF'}.`
      );
      this.closeActionModal();
    } catch (error) {
      console.error('No se pudo generar el Estado de Cuenta.', error);
      this.toastService.warning(
        this.documentErrorMessage(error, 'No se pudo generar el Estado de Cuenta.'),
        5500,
        'Estado de Cuenta'
      );
    } finally {
      this.isStatementGenerating.set(false);
    }
  }

  private async submitRoomInvoice(): Promise<void> {
    if (!this.todayDisplayDate()) {
      this.invoiceValidationMessage.set('No se puede facturar sin una fecha operativa válida.');
      return;
    }

    const selectedCharges = this.getSelectedInvoiceCharges();
    const chargesWithoutDocument = selectedCharges.filter((charge) => !this.cleanText(charge.numCrgHab || charge.reference));

    if (!selectedCharges.length) {
      this.invoiceValidationMessage.set('Selecciona al menos un cargo para facturar.');
      return;
    }

    if (chargesWithoutDocument.length) {
      this.invoiceValidationMessage.set('Uno o mas cargos seleccionados no tienen numero de cargo de habitacion.');
      return;
    }

    if (!this.selectedInvoiceDocument()) {
      this.invoiceValidationMessage.set('No hay un tipo de documento configurado para el punto de venta PF.');
      return;
    }

    if (!this.invoiceCanConfirm()) {
      this.invoiceValidationMessage.set(
        this.invoiceAppliedPayments().length === 0
          ? 'Agrega al menos una forma de pago para confirmar la facturacion.'
          : 'El total pagado debe cubrir el total de la cuenta.'
      );

      return;
    }

    if (!(await this.validateInvoiceExchangeRatesBeforeSubmit())) {
      return;
    }

    const selectedChargeKeys = new Set(selectedCharges.map((charge) => this.chargeBusinessKey(charge)));
    const selectedChargeSnapshot = this.invoiceChargeSnapshot(selectedCharges);
    const refreshedRoom = await this.refreshStayForCriticalOperation('facturar la habitación');

    if (!refreshedRoom) {
      this.invoiceValidationMessage.set('No se pudo actualizar la estancia antes de facturar.');
      return;
    }

    this.applyInvoiceSelection(selectedChargeKeys);
    const refreshedSelectedCharges = this.getSelectedInvoiceCharges();

    if (this.invoiceChargeSnapshot(refreshedSelectedCharges) !== selectedChargeSnapshot) {
      this.resetInvoicePaymentsForSelectionChange();
      this.invoiceValidationMessage.set(
        'Los cargos cambiaron desde que se abrió la factura. La estancia fue actualizada; revise la selección y las formas de pago.'
      );
      return;
    }

    const payload = this.buildRoomInvoicePayload(refreshedSelectedCharges);

    console.log('[RoomStayManagement] POST /facturacion-fdesk payload', payload);

    this.isInvoiceSubmitting.set(true);
    this.invoiceValidationMessage.set('');

    this.roomStayManagementService
      .invoiceRoom(payload)
      .pipe(
        finalize(() => this.isInvoiceSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (this.isFailedApiResponse(response)) {
            this.invoiceValidationMessage.set(response.message || 'No se pudo facturar la habitacion.');
            return;
          }

          this.applyRoomInvoiceAction(payload);
          this.closeActionModal();
          this.loadRoomStay();
        },
        error: (error) => {
          console.error('No se pudo facturar la habitacion.', error);
          this.invoiceValidationMessage.set('No se pudo facturar la habitacion. Revise la conexion con el API.');
          this.toastService.warning('No se pudo facturar la habitacion.', 4000, 'Documentos');
        }
      });
  }

  private buildRoomInvoicePayload(selectedCharges: Charge[]): RoomInvoicePayload {
    const room = this.room();
    const billedClient = this.invoiceClient();
    const payments = this.invoiceAppliedPayments();
    const firstPayment = payments[0];
    const fecha = this.todayDisplayDate();
    const operador = this.getOperador();
    const moneda = this.invoiceBaseCurrency;
    const pntVenta = 'PF';

    return {
      proceso       : 1,
      tipDocu       : this.cleanText(this.selectedInvoiceDocument()?.MPV31_CodDocu),
      serieDocu     : '',
      numDocu       : 'GENERA',
      codCliente    : this.cleanText(billedClient.code),
      rucClie       : this.cleanText(billedClient.document) || '0000000000',
      nomClie       : this.cleanText(billedClient.name) || 'CLIENTE EN GENERAL',
      direccion     : this.cleanText(billedClient.address) || 'S/D',
      numInterno    : '',
      codReserva    : this.cleanText(room.reservationNumber),
      habita        : this.cleanText(room.roomNumber),
      master        : this.cleanText(room.masterFolio),
      fechaDocu     : fecha,
      fechaPago     : fecha,
      fechaVen      : fecha,
      subTotal      : this.invoiceSubtotal(),
      descuento     : 0,
      neto          : this.invoiceSubtotal(),
      impuesto      : this.invoiceTaxes(),
      exonera       : 0,
      totDocumento  : this.invoiceTotal(),
      totPago       : this.invoicePaid(),
      totPropina    : this.invoiceTip(),
      pntVenta,
      codVendedor   : operador,
      moneda,
      tCambio       : 1,
      estado        : 'P',
      formaPago     : this.cleanText(firstPayment?.frmPago),
      numCuenta     : 0,
      tipo          : firstPayment ? 'CONTADO' : '',
      tipNdp        : '',
      numeroNdp     : '',
      operador,
      detDocumento  : selectedCharges.map((charge, index) => ({
        orden         : index + 1,
        fecha         : this.normalizeInvoiceDetailDate(charge.date, fecha),
        grupo         : '',
        codConsumo    : '',
        nomConsumo    : '',
        cantidad      : 0,
        precio        : 0,
        subTotal      : 0,
        porDescuento  : 0,
        descuento     : 0,
        neto          : 0,
        impuest       : 0,
        total         : 0,
        tipNPedido    : this.cleanText(charge.tipCrgHab),
        numNPedido    : this.cleanText(charge.numCrgHab || charge.reference),
        codMozo       : '',
        pntVenta      : '',
        almacen       : '',
        incluido      : '',
        moneda        : '',
        operador      : ''
      })),
      frmPago       : payments.map((payment, index) => ({
        orden       : index + 1,
        frmPago     : this.cleanText(payment.frmPago),
        tipo        : this.cleanText(payment.tipo),
        numTarjeta  : this.cleanText(payment.numTarjeta),
        moneda      : this.cleanText(payment.moneda),
        monto       : this.roundCurrency(payment.monto),
        vencimiento : this.cleanText(payment.vencimiento),
        mtoTotal    : this.roundCurrency(payment.mtoTotal),
        tCambio     : this.roundExchangeRate(payment.tCambio)
      }))
    };
  }

  private normalizeInvoiceDetailDate(value: string | null | undefined, fallback: string): string {
    return normalizePmsDateDDMMYYYY(value) || normalizePmsDateDDMMYYYY(fallback);
  }

  private applyRoomInvoiceAction(payload: RoomInvoicePayload): void {
    const billedClient = this.invoiceClient();

    this.room.update((currentRoom) => ({
      ...currentRoom,
      observations: [
        `Facturacion confirmada para ${billedClient.name} por ${this.formatCurrency(payload.totDocumento)}.`,
        ...currentRoom.observations
      ]
    }));

    this.addTimelineEntry(
      'Facturacion confirmada',
      `Documento enviado para ${billedClient.name} con ${payload.frmPago.length} forma(s) de pago.`
    );
    this.toastService.success('Facturacion de habitacion confirmada correctamente.', 4000, 'Documentos');
  }

  private async submitCheckOut(): Promise<void> {
    const operationalDate = this.todayDisplayDate();

    if (!operationalDate) {
      this.toastService.warning(
        'No se puede procesar el Check Out sin una fecha operativa válida.',
        4500,
        'Check Out'
      );
      return;
    }

    const room = await this.refreshStayForCriticalOperation('procesar el Check Out');
    if (!room) {
      return;
    }

    if (this.hasPendingExtraCharges()) {
      this.toastService.warning(
        `Debe cancelar los Cargos Extras pendientes (${this.formatCurrency(this.extrasSubtotal())}) antes del Check Out.`,
        5000,
        'Check Out'
      );
      return;
    }

    if (this.hasPendingLodgingCharges()) {
      const confirmation = await Swal.fire({
        title: 'Cargos de estancia pendientes',
        html: `La estancia mantiene cargos por <strong>${this.escapeHtml(this.formatCurrency(this.lodgingSubtotal()))}</strong>. Estos cargos no bloquean el Check Out. ¿Desea continuar?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, procesar Check Out',
        cancelButtonText: 'Volver',
        confirmButtonColor: '#dc3545',
        reverseButtons: true
      });

      if (!confirmation.isConfirmed) {
        return;
      }
    }

    const operador = this.cleanText(this.authService.getCurrentUser()?.usuario || room.operator);
    if (!operador) {
      this.toastService.warning('No se pudo identificar el operador autenticado.', 4000, 'Check Out');
      return;
    }

    const payload: RoomCheckoutPayload = {
      proceso: 1,
      fecCheckout: operationalDate,
      codReserva: this.cleanText(room.reservationNumber),
      numHabitacion: this.cleanText(room.roomNumber),
      folio: 'N',
      operador
    };

    if (!payload.codReserva || !payload.numHabitacion) {
      this.toastService.warning('La reserva o la habitación no están disponibles para procesar el Check Out.', 4500, 'Check Out');
      return;
    }

    this.isCheckoutSubmitting.set(true);
    this.roomStayManagementService.checkoutRoom(payload)
      .pipe(
        finalize(() => this.isCheckoutSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: RoomCheckoutResponse) => {
          this.closeActionModal();
          this.addTimelineEntry('Check Out realizado', response.mensaje || 'Checkout realizado exitosamente');
          void Swal.fire({
            title: 'Check Out completado',
            text: response.mensaje || 'Checkout realizado exitosamente',
            icon: 'success',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#198754'
          }).then(() => this.refreshRoomRackAfterCheckout());
        },
        error: (error) => {
          console.error('No se pudo procesar el Check Out.', error);
          const apiMessage = error?.error?.mensaje || error?.error?.message || error?.message;
          void Swal.fire({
            title: 'No se pudo realizar el Check Out',
            text: apiMessage || 'Revise la conexión con el API e inténtelo nuevamente.',
            icon: 'error',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#dc3545'
          });
        }
      });
  }

  private addTimelineEntry(title: string, detail: string): void {
    this.timeline.update((currentTimeline) => [{ time: this.currentTimeLabel(), title, detail }, ...currentTimeline]);
  }

  private currentTimeLabel(): string {
    return new Intl.DateTimeFormat('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  }

  todayDisplayDate(): string {
    return normalizePmsDateDDMMYYYY(this.operationalDateService.operationalDate());
  }

  private loadOperationalDate(): void {
    this.operationalDateService
      .ensureLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (error) => {
          console.error('No se pudo cargar la fecha operativa para gestionar la estancia.', error);
          this.toastService.warning(
            'No se pudo obtener la fecha operativa. Las operaciones financieras permanecerán bloqueadas.',
            5000,
            'Fecha operativa'
          );
        }
      });
  }

  private actionRequiresOperationalDate(actionId: StayActionId): boolean {
    return (
      actionId === 'change-departure' ||
      actionId === 'new-charge' ||
      actionId === 'transfer-charges' ||
      actionId === 'print-statement' ||
      actionId === 'invoice-room' ||
      actionId === 'check-out'
    );
  }

  departureDateValidationMessage(): string {
    const selectedDate = normalizePmsDateInputDDMMYYYY(this.actionDraft().newCheckOut);
    const operationalDate = this.todayDisplayDate();

    if (!selectedDate) {
      return 'Selecciona una fecha de salida válida.';
    }

    if (!operationalDate) {
      return 'No hay una fecha operativa válida para comprobar la salida.';
    }

    const daysFromOperationalDate = differenceInPmsCalendarDays(operationalDate, selectedDate);
    if (daysFromOperationalDate === null) {
      return 'No fue posible comparar la fecha de salida con la fecha operativa.';
    }

    if (daysFromOperationalDate < 0) {
      return `La fecha de salida no puede ser anterior a la fecha operativa ${operationalDate}.`;
    }

    if (selectedDate === normalizePmsDateDDMMYYYY(this.room().checkOut)) {
      return 'Selecciona una fecha de salida distinta a la actual.';
    }

    return '';
  }

  private formatInputDateForApi(date: string): string {
    return normalizePmsDateInputDDMMYYYY(date);
  }

  normalizeDepartureDateInput(): void {
    const normalized = normalizePmsDateInputDDMMYYYY(this.actionDraft().newCheckOut);
    if (normalized) {
      this.updateActionDraft({ newCheckOut: normalized });
    }
  }

  private escapeHtml(value: string | number | null | undefined): string {
    return this.cleanText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
    return parsePmsDate(date);
  }

  private roundCurrency(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  private formatInvoicePaymentAmount(amount: number | null): string {
    if (amount === null || !Number.isFinite(Number(amount))) {
      return '';
    }

    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(amount));
  }

  private normalizeInvoicePaymentAmountText(value: string | number | null | undefined): string {
    const rawValue = this.cleanText(value).replace(/,/g, '').replace(/[^\d.]/g, '');
    if (!rawValue) {
      return '';
    }

    const hasDecimalPoint = rawValue.includes('.');
    const [rawInteger = '', ...decimalParts] = rawValue.split('.');
    const integerDigits = rawInteger.replace(/^0+(?=\d)/, '') || '0';
    const decimalDigits = decimalParts.join('').slice(0, 2);
    const groupedInteger = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return hasDecimalPoint
      ? `${groupedInteger}.${decimalDigits}`
      : groupedInteger;
  }

  private parseInvoicePaymentAmount(value: string): number | null {
    const normalizedValue = value.replace(/,/g, '');
    if (!normalizedValue || normalizedValue === '.') {
      return null;
    }

    const amount = Number(normalizedValue);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  }

  private roundExchangeRate(rate: number): number {
    return Math.round((rate + Number.EPSILON) * 1_000_000) / 1_000_000;
  }

  private formatExchangeRate(rate: number): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(rate);
  }

  private getNavigationRoom(): RoomRackNavigationState | null {
    const currentNavigationState = this.router.getCurrentNavigation()?.extras.state?.['roomRackRoom'] as
      | RoomRackNavigationState
      | undefined;
    const historyNavigationState = history.state?.roomRackRoom as RoomRackNavigationState | undefined;

    return currentNavigationState ?? historyNavigationState ?? null;
  }

  private buildRoomFromRackData(roomData: RoomRackNavigationState, fallbackRoomNumber: string): RoomStay {
    const roomNumber           = String(roomData.CR05_NumHab || fallbackRoomNumber);
    const fallback             = this.buildRoomFromNumber(roomNumber);
    const roomType             = roomData.CR05_Descripcion || roomData.CR05_TipoHab || roomData.CR05_CateHab || fallback.roomType;
    const guestsCount          = Number(roomData.CR05_NumPax) || fallback.guestsCount;
    const rate                 = roomData.CR05_CateHab || roomData.CR05_TipoHab || fallback.rate;
    const reservationNumber    = roomData.RSV || fallback.reservationNumber;

    return {
      ...fallback,
      roomNumber,
      roomType,
      roomCategory: roomData.CR05_CateHab || fallback.roomCategory,
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
    return {
      ...emptyRoomStay,
      roomNumber
    };
  }
}
