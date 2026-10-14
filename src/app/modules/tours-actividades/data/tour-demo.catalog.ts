import { TourActivity, TourGuide, TourGuestRoom, TourSchedule } from '../models/tour-demo.models';
export const TOUR_GUIDES: TourGuide[] = [
  { id: 'guide-ana', name: 'Ana Vargas', languages: ['Español', 'Inglés'], active: true },
  { id: 'guide-marco', name: 'Marco Solís', languages: ['Español', 'Francés'], active: true },
  { id: 'guide-lucia', name: 'Lucía Mora', languages: ['Español', 'Inglés', 'Alemán'], active: true }
];
export const TOUR_ACTIVITIES: TourActivity[] = [
  { id: 'canopy', name: 'Canopy', description: 'Aventura entre las copas del bosque.', image: '🌿', active: true, defaultCapacity: 20, supportedLanguages: ['Español', 'Inglés'] },
  { id: 'tour-diurno', name: 'Tour Diurno', description: 'Recorrido natural con observación de fauna.', image: '☀️', active: true, defaultCapacity: 15, supportedLanguages: ['Español', 'Inglés', 'Francés'] },
  { id: 'tour-nocturno', name: 'Tour Nocturno', description: 'Exploración guiada después del atardecer.', image: '🌙', active: true, defaultCapacity: 12, supportedLanguages: ['Español', 'Inglés'] }
];
export const TOUR_TIMES: Record<string, string[]> = { canopy: ['08:00', '10:00', '13:00', '15:00'], 'tour-diurno': ['09:00', '11:00', '14:00', '16:00'], 'tour-nocturno': ['18:00', '20:00', '22:00'] };
export function buildSchedules(date: string): TourSchedule[] {
  return TOUR_ACTIVITIES.flatMap((activity) =>
    TOUR_TIMES[activity.id].map((startTime, index) => ({
      id: `${activity.id}-${date}-${startTime.replace(':', '')}`,
      activityId: activity.id,
      date,
      startTime,
      endTime: `${String(Number(startTime.slice(0, 2)) + 2).padStart(2, '0')}:${startTime.slice(3)}`,
      capacity: activity.defaultCapacity,
      guideIds: index % 2 === 0 ? ['guide-ana', 'guide-marco'] : ['guide-lucia', 'guide-marco'],
      status: 'ACTIVO' as const
    }))
  );
}
export const DEMO_GUEST_ROOMS: TourGuestRoom[] = [
  { id: 'demo-room-201', mode: 'demo', roomNumber: '201', guestName: 'Familia Ruiz', reservationCode: 'DEMO-26001', adults: 2, children: 2, stayStatus: 'In-house · Demo', sourceReference: 'demo-room-201' },
  { id: 'demo-room-203', mode: 'demo', roomNumber: '203', guestName: 'John Doe', reservationCode: 'DEMO-26002', adults: 2, children: 0, stayStatus: 'In-house · Demo', sourceReference: 'demo-room-203' },
  { id: 'demo-room-205', mode: 'demo', roomNumber: '205', guestName: 'García / Pérez', reservationCode: 'DEMO-26003', adults: 3, children: 0, stayStatus: 'In-house · Demo', sourceReference: 'demo-room-205' },
  { id: 'demo-room-305', mode: 'demo', roomNumber: '305', guestName: 'María González', reservationCode: 'DEMO-26004', adults: 2, children: 1, stayStatus: 'In-house · Demo', sourceReference: 'demo-room-305' },
  { id: 'demo-room-401', mode: 'demo', roomNumber: '401', guestName: 'Sofía Chen', reservationCode: 'DEMO-26005', adults: 2, children: 0, stayStatus: 'In-house · Demo', sourceReference: 'demo-room-401' },
  { id: 'demo-room-402', mode: 'demo', roomNumber: '402', guestName: 'Familia Méndez', reservationCode: 'DEMO-26006', adults: 4, children: 0, stayStatus: 'In-house · Demo', sourceReference: 'demo-room-402' }
];
