import type { TripYear } from './japan-trips';
import mediaPlaces from '../../public/data/japan-map-places.json';

export type MapPlace = {
  name: string;
  japanese: string;
  coordinates: [number, number];
  kind: 'city' | 'stop' | 'mountain';
  minZoom: number;
  trips?: TripYear[];
};

// Japanese names checked against Hokkaido's tourism/prefectural listings.
// These geographic labels use town centres. The current marker independently
// follows the ordered journey matched to original media and Strava recordings.
const japaneseNames: Record<string, string> = {
  Sapporo: '札幌', Fukagawa: '深川', Rumoi: '留萌', Haboro: '羽幌',
  Teshio: '天塩', Wakkanai: '稚内', 'Rishiri Island': '利尻島',
  'Rebun Island': '礼文島', Sarufutsu: '猿払', Esashi: '枝幸', Omu: '雄武',
  Shimokawa: '下川', Asahikawa: '旭川', Kamifurano: '上富良野', Kamisunagawa: '上砂川',
  Sounkyo: '層雲峡', Onneyu: '温根湯', Kitami: '北見', Abashiri: '網走',
  Utoro: 'ウトロ', 'Shiretoko Pass': '知床峠', Rausu: '羅臼', Betsukai: '別海',
  Teshikaga: '弟子屈', 'Lake Akan': '阿寒湖', Ashoro: '足寄', Nukabira: 'ぬかびら',
  'Mikuni Pass': '三国峠',
};
const majorCities = new Set(['Sapporo', 'Asahikawa', 'Wakkanai', 'Kitami', 'Abashiri']);
// Reference labels only; these coordinates never locate a video scene.
const routePlaceReferences = {
  "2025": [
    {
      "place": "Sapporo",
      "coordinates": [
        141.35,
        43.06
      ]
    },
    {
      "place": "Fukagawa",
      "coordinates": [
        142.04,
        43.72
      ]
    },
    {
      "place": "Rumoi",
      "coordinates": [
        141.64,
        43.94
      ]
    },
    {
      "place": "Haboro",
      "coordinates": [
        141.7,
        44.36
      ]
    },
    {
      "place": "Teshio",
      "coordinates": [
        141.75,
        44.89
      ]
    },
    {
      "place": "Wakkanai",
      "coordinates": [
        141.67,
        45.42
      ]
    },
    {
      "place": "Rishiri Island",
      "coordinates": [
        141.25,
        45.18
      ]
    },
    {
      "place": "Rebun Island",
      "coordinates": [
        141.05,
        45.3
      ]
    },
    {
      "place": "Sarufutsu",
      "coordinates": [
        142.11,
        45.33
      ]
    },
    {
      "place": "Esashi",
      "coordinates": [
        142.58,
        44.94
      ]
    },
    {
      "place": "Omu",
      "coordinates": [
        142.96,
        44.58
      ]
    },
    {
      "place": "Shimokawa",
      "coordinates": [
        142.64,
        44.3
      ]
    },
    {
      "place": "Asahikawa",
      "coordinates": [
        142.36,
        43.77
      ]
    },
    {
      "place": "Kamifurano",
      "coordinates": [
        142.468,
        43.457
      ]
    },
    {
      "place": "Kamisunagawa",
      "coordinates": [
        141.98,
        43.48
      ]
    },
    {
      "place": "Sapporo",
      "coordinates": [
        141.35,
        43.06
      ]
    }
  ],
  "2026": [
    {
      "place": "Sapporo",
      "coordinates": [
        141.35,
        43.06
      ]
    },
    {
      "place": "Asahikawa",
      "coordinates": [
        142.36,
        43.77
      ]
    },
    {
      "place": "Sounkyo",
      "coordinates": [
        142.95,
        43.73
      ]
    },
    {
      "place": "Onneyu",
      "coordinates": [
        143.5,
        43.75
      ]
    },
    {
      "place": "Kitami",
      "coordinates": [
        143.9,
        43.8
      ]
    },
    {
      "place": "Abashiri",
      "coordinates": [
        144.27,
        44.02
      ]
    },
    {
      "place": "Utoro",
      "coordinates": [
        145.0,
        44.07
      ]
    },
    {
      "place": "Shiretoko Pass",
      "coordinates": [
        145.1,
        44.05
      ]
    },
    {
      "place": "Rausu",
      "coordinates": [
        145.18,
        44.02
      ]
    },
    {
      "place": "Betsukai",
      "coordinates": [
        145.12,
        43.39
      ]
    },
    {
      "place": "Teshikaga",
      "coordinates": [
        144.46,
        43.49
      ]
    },
    {
      "place": "Lake Akan",
      "coordinates": [
        144.1,
        43.45
      ]
    },
    {
      "place": "Ashoro",
      "coordinates": [
        143.55,
        43.24
      ]
    },
    {
      "place": "Nukabira",
      "coordinates": [
        143.19,
        43.37
      ]
    },
    {
      "place": "Mikuni Pass",
      "coordinates": [
        143.12,
        43.58
      ]
    },
    {
      "place": "Sounkyo",
      "coordinates": [
        142.95,
        43.73
      ]
    },
    {
      "place": "Asahikawa",
      "coordinates": [
        142.36,
        43.77
      ]
    },
    {
      "place": "Sapporo",
      "coordinates": [
        141.35,
        43.06
      ]
    }
  ]
} as Record<TripYear, { place: string; coordinates: [number, number] }[]>;
const routePlaces = new Map<string, MapPlace>();
for (const [year, references] of Object.entries(routePlaceReferences)) {
  for (const stop of references) {
    // The lake itself is drawn from OSM water polygons.
    if (stop.place === 'Lake Akan') continue;
    const existing = routePlaces.get(stop.place);
    if (existing) {
      if (!existing.trips!.includes(year as TripYear)) existing.trips!.push(year as TripYear);
      continue;
    }
    const major = majorCities.has(stop.place);
    routePlaces.set(stop.place, {
      name: stop.place,
      japanese: japaneseNames[stop.place] ?? stop.place,
      coordinates: stop.coordinates,
      kind: major ? 'city' : 'stop',
      minZoom: major ? 0 : 1.22,
      trips: [year as TripYear],
    });
  }
}

// OSM town labels for the places identified beside original-media GPS pins.
// They are geographic references, independent of each scene's recorded point.
for (const place of mediaPlaces) {
  const existing = routePlaces.get(place.name);
  if (existing) routePlaces.delete(place.name);
  // Distinct towns can share an English name (士別 and 標津 are both Shibetsu).
  routePlaces.set(`${place.name}:${place.coordinates.join(',')}`, {
    name: place.name,
    japanese: place.japanese,
    coordinates: place.coordinates as [number, number],
    kind: existing?.kind ?? 'stop',
    minZoom: existing?.minZoom ?? 1.22,
    trips: [...new Set([...(existing?.trips ?? []), ...place.trips as TripYear[]])],
  });
}

// A small set of geographic reference points, not a detailed navigation map.
// Mountain names: Japan Ministry of the Environment's Hokkaido park guides.
export const mapPlaces: MapPlace[] = [
  ...routePlaces.values(),
  { name: 'Haneda Airport', japanese: '羽田空港', coordinates: [139.78, 35.55], kind: 'stop', minZoom: 0 },
  { name: 'New Chitose Airport', japanese: '新千歳空港', coordinates: [141.68, 42.79], kind: 'stop', minZoom: 0 },
  { name: 'Hakodate', japanese: '函館', coordinates: [140.73, 41.77], kind: 'city', minZoom: 0 },
  { name: 'Kushiro', japanese: '釧路', coordinates: [144.38, 42.98], kind: 'city', minZoom: 0 },
  { name: 'Obihiro', japanese: '帯広', coordinates: [143.20, 42.92], kind: 'city', minZoom: 0 },
  { name: 'Otaru', japanese: '小樽', coordinates: [141.00, 43.19], kind: 'city', minZoom: 1.35 },
  { name: 'Nemuro', japanese: '根室', coordinates: [145.58, 43.33], kind: 'city', minZoom: 1.35 },
  { name: 'Muroran', japanese: '室蘭', coordinates: [140.97, 42.32], kind: 'city', minZoom: 1.35 },
  { name: 'Asahidake', japanese: '旭岳', coordinates: [142.85, 43.66], kind: 'mountain', minZoom: 1.65 },
  { name: 'Tokachidake', japanese: '十勝岳', coordinates: [142.69, 43.42], kind: 'mountain', minZoom: 1.65 },
  { name: 'Mount Rausu', japanese: '羅臼岳', coordinates: [145.12, 44.08], kind: 'mountain', minZoom: 1.65 },
  { name: 'Mount Rishiri', japanese: '利尻山', coordinates: [141.24, 45.18], kind: 'mountain', minZoom: 1.65 },
  { name: 'Mount Yotei', japanese: '羊蹄山', coordinates: [140.81, 42.83], kind: 'mountain', minZoom: 1.65 },
];
