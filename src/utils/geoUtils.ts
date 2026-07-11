export const FEET_PER_METER = 3.28084;
export const METERS_PER_MILE = 1609.344;

export const AUTO_CHECKIN_RADIUS_FEET = 100;
export const AUTO_CHECKIN_RADIUS_METERS = AUTO_CHECKIN_RADIUS_FEET / FEET_PER_METER;

export const AUTO_CHECKOUT_DISTANCE_MILES = 2;
export const AUTO_CHECKOUT_DISTANCE_METERS =
  AUTO_CHECKOUT_DISTANCE_MILES * METERS_PER_MILE;

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export const isValidCoordinate = (
  latitude: number | null | undefined,
  longitude: number | null | undefined
): latitude is number => {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

export const getDistanceFromLatLonInMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  if (
    !isValidCoordinate(lat1, lon1) ||
    !isValidCoordinate(lat2, lon2)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadiusMeters = 6371000;

  const toRad = (value: number): number => {
    return (value * Math.PI) / 180;
  };

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
};

export const getDistanceBetweenPointsMeters = (
  from: GeoPoint,
  to: GeoPoint
): number => {
  return getDistanceFromLatLonInMeters(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude
  );
};

export const isWithinAutoCheckinRadius = (
  distanceMeters: number,
  radiusMeters: number = AUTO_CHECKIN_RADIUS_METERS
): boolean => {
  return Number.isFinite(distanceMeters) && distanceMeters <= radiusMeters;
};

export const isBeyondAutoCheckoutDistance = (
  distanceMeters: number,
  thresholdMeters: number = AUTO_CHECKOUT_DISTANCE_METERS
): boolean => {
  return Number.isFinite(distanceMeters) && distanceMeters >= thresholdMeters;
};

