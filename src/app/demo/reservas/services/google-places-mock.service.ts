import { Injectable } from '@angular/core';

export interface MockPlace {
  placeId: string;
  mainText: string;
  secondaryText: string;
  formattedAddress: string;
  lat: number;
  lng: number;
}

@Injectable({
  providedIn: 'root'
})
export class GooglePlacesMockService {
  private readonly places: MockPlace[] = [
    {
      placeId: 'mock_cala_lodge',
      mainText: 'Cala Lodge',
      secondaryText: 'Monteverde',
      formattedAddress: 'Cala Lodge, Monteverde, Puntarenas Province, Costa Rica',
      lat: 10.3134,
      lng: -84.8241
    },
    {
      placeId: 'mock_liberia_airport',
      mainText: 'Liberia Airport',
      secondaryText: 'Liberia',
      formattedAddress: 'Daniel Oduber Quiros International Airport, Liberia, Costa Rica',
      lat: 10.6016,
      lng: -85.533
    },
    {
      placeId: 'mock_sjo_airport',
      mainText: 'Aeropuerto SJO',
      secondaryText: 'Alajuela',
      formattedAddress: 'Juan Santamaria International Airport, Alajuela, Costa Rica',
      lat: 9.998,
      lng: -84.2041
    },
    {
      placeId: 'mock_monteverde_reserve',
      mainText: 'Reserva Monteverde',
      secondaryText: 'Monteverde',
      formattedAddress: 'Monteverde Cloud Forest Biological Preserve, Puntarenas, Costa Rica',
      lat: 10.305,
      lng: -84.791
    },
    {
      placeId: 'mock_lafortuna_center',
      mainText: 'La Fortuna Centro',
      secondaryText: 'La Fortuna',
      formattedAddress: 'La Fortuna, Alajuela Province, Costa Rica',
      lat: 10.4702,
      lng: -84.6455
    },
    {
      placeId: 'mock_tamarindo_beach',
      mainText: 'Tamarindo Beach',
      secondaryText: 'Tamarindo',
      formattedAddress: 'Tamarindo Beach, Guanacaste Province, Costa Rica',
      lat: 10.2993,
      lng: -85.8404
    }
  ];

  searchPlaces(query: string): MockPlace[] {
    const term = query?.toLowerCase().trim();
    if (!term) {
      return [];
    }
    return this.places
      .filter(place => {
        const haystack = `${place.mainText} ${place.secondaryText} ${place.formattedAddress}`.toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 5);
  }

  getPlaceDetails(placeId: string): MockPlace | undefined {
    return this.places.find(place => place.placeId === placeId);
  }
}
