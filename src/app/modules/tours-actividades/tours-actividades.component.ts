import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { TourDemoService } from './services/tour-demo.service';
import { TourBooking, TourGuestRoom, TourMode, TourScheduleView } from './models/tour-demo.models';

@Component({
  selector: 'app-tours-actividades',
  standalone: true,
  imports: [CommonModule, FormsModule, CdkDrag, CdkDropList],
  templateUrl: './tours-actividades.component.html',
  styleUrls: ['./tours-actividades.component.scss']
})
export class ToursActividadesComponent {
  readonly service = inject(TourDemoService);
  readonly selectedDate = signal(this.toDateInput(new Date()));
  readonly search = signal('');
  readonly statusFilter = signal('TODAS');
  readonly selectedRoom = signal<TourGuestRoom | null>(null);
  readonly selectedSchedule = signal<TourScheduleView | null>(null);
  readonly notice = signal<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  readonly dialog = signal<'reserve' | 'move' | 'cancel' | 'reset' | null>(null);
  readonly draftRoom = signal<TourGuestRoom | null>(null);
  readonly draftSchedule = signal<TourScheduleView | null>(null);
  readonly draftBooking = signal<TourBooking | null>(null);
  readonly participants = signal(1);
  readonly language = signal('Español');
  readonly cancelReason = signal('');

  readonly rooms = computed(() => {
    const query = this.search().trim().toLowerCase(); const filter = this.statusFilter();
    return this.service.getRooms().filter((room) => {
      const matchesQuery = !query || [room.roomNumber, room.guestName, room.reservationCode].some((value) => value.toLowerCase().includes(query));
      const matchesStatus = filter === 'TODAS' || room.stayStatus.toUpperCase().includes(filter);
      return matchesQuery && matchesStatus;
    });
  });
  readonly schedules = computed(() => this.service.getSchedules(this.selectedDate()));
  readonly scheduleDropListIds = computed(() => this.schedules().map((schedule) => this.scheduleDropListId(schedule)));
  readonly visibleBookings = computed(() => this.selectedSchedule() ? this.service.getBookings(this.selectedSchedule()!.id) : []);
  readonly summary = computed(() => { const schedules = this.schedules(); return { tours: schedules.length, participants: schedules.reduce((sum, item) => sum + item.reserved, 0), available: schedules.reduce((sum, item) => sum + item.available, 0), soldOut: schedules.filter((item) => item.availability === 'sold-out').length }; });
  readonly groupedSchedules = computed(() => this.service.activities().map((activity) => ({ activity, schedules: this.schedules().filter((schedule) => schedule.activityId === activity.id) })));

  setMode(mode: TourMode): void { this.service.setMode(mode, this.selectedDate()); this.selectedRoom.set(null); this.selectedSchedule.set(null); this.showNotice(mode === 'demo' ? 'Modo Demo activo.' : 'Modo PMS activo: datos de habitaciones en solo lectura.', 'info'); }
  selectRoom(room: TourGuestRoom): void { this.selectedRoom.set(room); }
  selectSchedule(schedule: TourScheduleView): void { this.selectedSchedule.set(schedule); }
  previousDay(): void { this.shiftDate(-1); }
  nextDay(): void { this.shiftDate(1); }
  today(): void { this.selectedDate.set(this.toDateInput(new Date())); }
  onDateChange(value: string): void { if (value) { this.selectedDate.set(value); this.selectedSchedule.set(null); if (this.service.mode() === 'pms') this.service.loadPmsRooms(value); } }
  dropRoom(event: CdkDragDrop<TourScheduleView>): void { const room = event.item.data as TourGuestRoom; const schedule = event.container.data; if (room && schedule) this.openReserve(room, schedule); }
  scheduleDropListId(schedule: TourScheduleView): string { return `tour-schedule-${schedule.id}`; }
  openReserve(room = this.selectedRoom(), schedule = this.selectedSchedule()): void { if (!room || !schedule) { this.showNotice('Seleccione una habitación y un horario.', 'info'); return; } this.draftRoom.set(room); this.draftSchedule.set(schedule); this.participants.set(1); this.language.set(schedule.activity.supportedLanguages[0]); this.dialog.set('reserve'); }
  confirmReserve(): void { const room = this.draftRoom(); const schedule = this.draftSchedule(); if (!room || !schedule) return; const result = this.service.reserve({ room, schedule, participants: this.participants(), language: this.language() }); if (result.ok === false) { this.showNotice(result.message, 'error'); return; } this.dialog.set(null); this.refreshSelectedSchedule(schedule.id); this.showNotice('Reserva simulada confirmada y cupos actualizados.', 'success'); }
  openMove(booking: TourBooking): void { this.draftBooking.set(booking); this.dialog.set('move'); }
  moveBooking(destinationId: string): void { const booking = this.draftBooking(); const destination = this.schedules().find((item) => item.id === destinationId); if (!booking || !destination) return; const result = this.service.move(booking, destination); if (result.ok === false) { this.showNotice(result.message, 'error'); return; } this.dialog.set(null); this.selectedSchedule.set(destination); this.showNotice('Horario cambiado y ambos cupos fueron actualizados.', 'success'); }
  openCancel(booking: TourBooking): void { this.draftBooking.set(booking); this.cancelReason.set(''); this.dialog.set('cancel'); }
  confirmCancel(): void { const booking = this.draftBooking(); if (!booking) return; const result = this.service.cancel(booking, this.cancelReason()); if (result.ok === false) { this.showNotice(result.message, 'error'); return; } this.dialog.set(null); this.refreshSelectedSchedule(this.selectedSchedule()?.id); this.showNotice('Reserva cancelada mediante autorización simulada.', 'success'); }
  resetDemo(): void { this.dialog.set('reset'); }
  confirmReset(): void { this.service.resetDemo(); this.dialog.set(null); this.selectedSchedule.set(null); this.showNotice('La demostración fue restaurada al escenario inicial.', 'success'); }
  closeDialog(): void { this.dialog.set(null); }
  setSearch(value: string): void { this.search.set(value); }
  setStatusFilter(value: string): void { this.statusFilter.set(value); }
  setParticipants(value: number): void { this.participants.set(Number(value)); }
  setLanguage(value: string): void { this.language.set(value); }
  setCancelReason(value: string): void { this.cancelReason.set(value); }
  statusLabel(status: TourScheduleView['availability']): string { return ({ available: 'Disponible', limited: 'Pocos espacios', 'sold-out': 'Agotado', inactive: 'No disponible' } as Record<string, string>)[status]; }
  formatGuestCount(room: TourGuestRoom): string { return `${room.adults + room.children} huésped${room.adults + room.children === 1 ? '' : 'es'}`; }
  guideNames(schedule: TourScheduleView): string { return schedule.guides.map((guide) => guide.name).join(' · '); }
  trackById(_: number, item: { id: string }): string { return item.id; }
  private refreshSelectedSchedule(id?: string): void { if (id) { const current = this.schedules().find((item) => item.id === id); if (current) this.selectedSchedule.set(current); } }
  private showNotice(text: string, type: 'success' | 'error' | 'info'): void { this.notice.set({ text, type }); window.setTimeout(() => this.notice.set(null), 4200); }
  private shiftDate(days: number): void { const date = new Date(`${this.selectedDate()}T12:00:00`); date.setDate(date.getDate() + days); const next = this.toDateInput(date); this.selectedDate.set(next); this.selectedSchedule.set(null); if (this.service.mode() === 'pms') this.service.loadPmsRooms(next); }
  private toDateInput(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
}
