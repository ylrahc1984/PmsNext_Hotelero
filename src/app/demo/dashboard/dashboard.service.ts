import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Weather } from './models/weather.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly weatherUrl = 'http://localhost:5000/api/pronostico-tiempo';

  private readonly weatherSubject = new BehaviorSubject<Weather | null>(null);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly errorSubject = new BehaviorSubject<string | null>(null);
  private readonly citySubject = new BehaviorSubject<string>('San Jose');

  readonly weather$ = this.weatherSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();
  readonly city$ = this.citySubject.asObservable();

  private requestVersion = 0;

  constructor(private http: HttpClient) {}

  getWeather(ciudad: string): Observable<Weather> {
    const normalizedCity = this.normalizeCity(ciudad);
    const params = new HttpParams().set('ciudad', normalizedCity);

    return this.http.get<unknown>(this.weatherUrl, { params }).pipe(
      map((response) => this.mapWeatherResponse(response, normalizedCity))
    );
  }

  loadWeather(ciudad: string, force = false): void {
    const normalizedCity = this.normalizeCity(ciudad);
    if (!force && normalizedCity === this.citySubject.value && this.weatherSubject.value) {
      return;
    }

    const currentRequest = ++this.requestVersion;
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    this.getWeather(normalizedCity).subscribe({
      next: (weather) => {
        if (currentRequest !== this.requestVersion) {
          return;
        }
        this.citySubject.next(normalizedCity);
        this.weatherSubject.next(weather);
        this.loadingSubject.next(false);
      },
      error: (error) => {
        if (currentRequest !== this.requestVersion) {
          return;
        }
        console.error('Error cargando clima del dashboard:', error);
        this.errorSubject.next('No se pudo cargar el clima actual.');
        this.loadingSubject.next(false);
      }
    });
  }

  changeCity(ciudad: string): void {
    this.loadWeather(ciudad);
  }

  reload(): void {
    this.loadWeather(this.citySubject.value, true);
  }

  private mapWeatherResponse(response: unknown, ciudad: string): Weather {
    const source = Array.isArray(response) ? response[0] ?? {} : (response ?? {});
    const data = source as Record<string, unknown>;

    const main = this.asRecord(data['main']);
    const wind = this.asRecord(data['wind']);
    const weatherArray = Array.isArray(data['weather']) ? data['weather'] : [];
    const firstWeather = this.asRecord(weatherArray[0]);

    return {
      ciudad: this.toText(data['ciudad'] ?? data['Ciudad'] ?? ciudad),
      temperatura: this.toNumber(data['temperatura'] ?? data['Temperatura'] ?? main['temp']),
      descripcion: this.toText(data['descripcion'] ?? data['Descripcion'] ?? firstWeather['description'] ?? 'Sin descripción'),
      sensacion: this.toNumber(data['sensacion'] ?? data['Sensacion'] ?? main['feels_like']),
      humedad: this.toNumber(data['humedad'] ?? data['Humedad'] ?? main['humidity']),
      presion: this.toNumber(data['presion'] ?? data['Presion'] ?? main['pressure']),
      viento: this.toNumber(data['viento'] ?? data['Viento'] ?? wind['speed'])
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private normalizeCity(ciudad: string): string {
    const normalized = this.toText(ciudad);
    return normalized || 'San Jose';
  }

  private toText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
