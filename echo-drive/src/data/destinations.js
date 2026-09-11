// Curated destinations for the journey planner's destination selector.
// These are hardcoded, real-world coordinates — no geocoding API, no billing,
// no API key. Swap or extend this list freely.

export const DEFAULT_ORIGIN = {
  id: 'origin',
  name: 'Current Location',
  area: 'Live GPS Position',
  position: [18.5204, 73.8567],
};

export const DESTINATIONS = [
  { id: 'shaniwar-wada', name: 'Shaniwar Wada', area: 'Pune City', position: [18.5195, 73.8553] },
  { id: 'koregaon-park', name: 'Koregaon Park', area: 'Pune', position: [18.5362, 73.8938] },
  { id: 'hinjawadi', name: 'Hinjawadi IT Park', area: 'Pune', position: [18.5913, 73.7389] },
  { id: 'magarpatta', name: 'Magarpatta City', area: 'Hadapsar, Pune', position: [18.5158, 73.928] },
  { id: 'phoenix-marketcity', name: 'Phoenix Marketcity', area: 'Viman Nagar, Pune', position: [18.5621, 73.9169] },
  { id: 'pune-airport', name: 'Pune Airport · PNQ', area: 'Lohegaon', position: [18.5822, 73.9197] },
  { id: 'lonavala', name: 'Lonavala', area: 'Hill Station', position: [18.7546, 73.4062] },
  { id: 'mumbai', name: 'Mumbai', area: 'Maharashtra', position: [19.076, 72.8777] },
];
