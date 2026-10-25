export interface CelestialDirection { x: number; y: number; z: number; }
export interface SceneLocation { latitude: number; longitude: number; }
export interface CelestialDirections {
  sun: CelestialDirection;
  moon: CelestialDirection;
}
export interface CelestialAnnualPaths {
  sun: readonly CelestialDirection[];
  moon: readonly CelestialDirection[];
}

const DAY_MS = 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const RAD = Math.PI / 180;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const wrap = (value: number, modulo: number): number => ((value % modulo) + modulo) % modulo;
const daysInYear = (year: number): number => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;

function astronomicalTimestamp(year: number, dayOfYear: number, utcHours: number): number {
  // Scene time is UTC: latitude/longitude are sufficient to place the bodies
  // without silently inventing a political timezone or daylight-saving rule.
  return Date.UTC(year, 0, 1) + (dayOfYear + utcHours / 24) * DAY_MS;
}

function horizontalDirection(
  rightAscension: number,
  declination: number,
  timestamp: number,
  latitude: number,
  longitude: number
): CelestialDirection {
  const daysSinceJ2000 = (timestamp - J2000_MS) / DAY_MS;
  const localSidereal = wrap(280.46061837 + 360.98564736629 * daysSinceJ2000 + longitude, 360) * RAD;
  const hourAngle = localSidereal - rightAscension;
  const latitudeRad = clamp(latitude, -90, 90) * RAD;
  const x = Math.cos(declination) * Math.sin(hourAngle);
  const y = Math.sin(latitudeRad) * Math.sin(declination) + Math.cos(latitudeRad) * Math.cos(declination) * Math.cos(hourAngle);
  const z = Math.sin(declination) * Math.cos(latitudeRad) - Math.cos(declination) * Math.sin(latitudeRad) * Math.cos(hourAngle);
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
}

function sunEquatorial(timestamp: number): { rightAscension: number; declination: number } {
  const daysSinceJ2000 = (timestamp - J2000_MS) / DAY_MS;
  const meanLongitude = wrap(280.460 + 0.9856474 * daysSinceJ2000, 360) * RAD;
  const meanAnomaly = wrap(357.528 + 0.9856003 * daysSinceJ2000, 360) * RAD;
  const eclipticLongitude = meanLongitude + (1.915 * Math.sin(meanAnomaly) + 0.020 * Math.sin(2 * meanAnomaly)) * RAD;
  const obliquity = (23.439 - 0.0000004 * daysSinceJ2000) * RAD;
  return {
    rightAscension: Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude)),
    declination: Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude))
  };
}

function moonEquatorial(timestamp: number): { rightAscension: number; declination: number } {
  const daysSinceJ2000 = (timestamp - J2000_MS) / DAY_MS;
  const moonLongitude = wrap(218.316 + 13.176396 * daysSinceJ2000, 360) * RAD;
  const moonAnomaly = wrap(134.963 + 13.064993 * daysSinceJ2000, 360) * RAD;
  const sunAnomaly = wrap(357.529 + 0.9856003 * daysSinceJ2000, 360) * RAD;
  const elongation = wrap(297.850 + 12.190749 * daysSinceJ2000, 360) * RAD;
  const argumentLatitude = wrap(93.272 + 13.229350 * daysSinceJ2000, 360) * RAD;
  const eclipticLongitude = moonLongitude + (
    6.289 * Math.sin(moonAnomaly) +
    1.274 * Math.sin(2 * elongation - moonAnomaly) +
    0.658 * Math.sin(2 * elongation) +
    0.214 * Math.sin(2 * moonAnomaly) -
    0.186 * Math.sin(sunAnomaly)
  ) * RAD;
  const eclipticLatitude = (
    5.128 * Math.sin(argumentLatitude) +
    0.280 * Math.sin(moonAnomaly + argumentLatitude) +
    0.277 * Math.sin(moonAnomaly - argumentLatitude) +
    0.173 * Math.sin(2 * elongation - argumentLatitude)
  ) * RAD;
  const obliquity = (23.439 - 0.0000004 * daysSinceJ2000) * RAD;
  return {
    rightAscension: Math.atan2(
      Math.sin(eclipticLongitude) * Math.cos(obliquity) - Math.tan(eclipticLatitude) * Math.sin(obliquity),
      Math.cos(eclipticLongitude)
    ),
    declination: Math.asin(
      Math.sin(eclipticLatitude) * Math.cos(obliquity) +
      Math.cos(eclipticLatitude) * Math.sin(obliquity) * Math.sin(eclipticLongitude)
    )
  };
}

export function resolveCelestialDirections(input: {
  year: number;
  dayOfYear: number;
  timeHours: number;
  latitude: number;
  longitude: number;
}): CelestialDirections {
  const longitude = wrap(input.longitude + 180, 360) - 180;
  const timestamp = astronomicalTimestamp(input.year, input.dayOfYear, input.timeHours);
  const sun = sunEquatorial(timestamp);
  const moon = moonEquatorial(timestamp);
  return {
    sun: horizontalDirection(sun.rightAscension, sun.declination, timestamp, input.latitude, longitude),
    moon: horizontalDirection(moon.rightAscension, moon.declination, timestamp, input.latitude, longitude)
  };
}

export function resolveSolarDaySpanDeg(year: number, dayOfYear: number, latitude: number): number {
  const timestamp = astronomicalTimestamp(year, dayOfYear, 12);
  const declination = sunEquatorial(timestamp).declination;
  const latitudeRad = clamp(latitude, -89.999, 89.999) * RAD;
  const sunriseHourAngle = Math.acos(clamp(-Math.tan(latitudeRad) * Math.tan(declination), -1, 1));
  return sunriseHourAngle * 2 / RAD;
}

export function resolveSolarPeakAltitude(
  year: number,
  dayOfYear: number,
  latitude: number
): number {
  const timestamp = astronomicalTimestamp(year, dayOfYear, 12);
  const declination = sunEquatorial(timestamp).declination;
  const latitudeRad = clamp(latitude, -90, 90) * RAD;
  return clamp(Math.cos(latitudeRad - declination), 0, 1);
}

export function resolveMoonPhase(year: number, dayOfYear: number, timeHours: number): number {
  const epoch = Date.UTC(2000, 0, 6, 18, 14);
  const timestamp = astronomicalTimestamp(year, dayOfYear, timeHours);
  return wrap((timestamp - epoch) / DAY_MS / 29.530588, 1);
}

export function projectCelestialAnnualPaths(input: {
  year: number;
  timeHours: number;
  latitude: number;
  longitude: number;
}): CelestialAnnualPaths {
  const count = daysInYear(input.year);
  const sun: CelestialDirection[] = [];
  const moon: CelestialDirection[] = [];
  for (let dayOfYear = 0; dayOfYear <= count; dayOfYear += 1) {
    const directions = resolveCelestialDirections({ ...input, dayOfYear });
    sun.push(directions.sun);
    moon.push(directions.moon);
  }
  return { sun, moon };
}
