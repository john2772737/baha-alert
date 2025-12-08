export const initialSensorData = {
  pressure: 1012.0, 
  rainRaw: 1023, 
  soilRaw: 1023, 
  waterDistanceCM: 50.0, 
  deviceMode: "---", 
};

// --- Helpers ---
const clamp = (val) => Math.min(100, Math.max(0, Math.round(val)));
export const getFormattedTime = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// --- Mappings ---
export const STATE_MAPPINGS = {
  rain: (rainRaw) => (rainRaw === -1 ? -1 : clamp(100 - (rainRaw / 1023.0) * 100)), 
  soil: (soilRaw) => (soilRaw === -1 ? -1 : clamp(100 - (soilRaw / 1023.0) * 100)), 
  waterTank: (distanceCM) =>
    distanceCM === -1 ? -1 : (distanceCM > 100 ? 0 : clamp(100.0 - (distanceCM / 50.0) * 100.0)),
};

// --- Status Logic ---

export const getRainStatus = (percent) => {
  // ⭐ FIX: Removed "percent === 0" from error check.
  // Now 0% (Max Dryness) will correctly fall through to "No Rain".
  if (percent === -1 || percent === undefined || isNaN(percent)) {
    return {
      reading: "Error",
      status: "SENSOR ERROR",
      className: "text-red-500 font-black animate-pulse",
    };
  }

  // Normal Logic
  if (percent < 25) return { reading: "No Rain", status: "STATUS: Clear", className: "text-emerald-400 font-bold" };
  if (percent < 50) return { reading: "Light Rain", status: "STATUS: Drizzling", className: "text-yellow-400 font-bold" };
  if (percent < 70) return { reading: "Moderate Rain", status: "STATUS: Raining", className: "text-orange-400 font-bold" };
  return { reading: "Heavy Rain", status: "ALERT: Storm Conditions", className: "text-red-400 font-bold" };
};

export const getSoilStatus = (percent) => {
  // ⭐ FIX: Removed "percent === 0" from error check.
  // Now 0% (Max Dryness) will correctly fall through to "Dry".
  if (percent === -1 || percent === undefined || isNaN(percent)) {
    return {
      reading: "Error",
      status: "SENSOR ERROR",
      className: "text-red-500 font-black animate-pulse",
    };
  }

  // Normal Logic
  if (percent < 20) return { reading: 'Dry', status: 'STATUS: Low Moisture', className: 'text-red-400 font-bold' };
  if (percent < 50) return { reading: 'Moist', status: 'STATUS: Healthy', className: 'text-emerald-400 font-bold' };
  return { reading: 'Wet', status: 'STATUS: Saturated', className: 'text-cyan-400 font-bold' };
};

export const getWaterTankStatus = (percent, distance) => {
  // Water and Pressure still need 0 checks because 0 distance/pressure IS an error.
  if (distance === -1 || distance === 0 || distance >= 400 || distance === undefined) { 
      return { 
          reading: 'Error', 
          status: 'SENSOR ERROR', 
          className: 'text-red-500 font-black animate-pulse' 
      };
  }

  // Normal Logic
  if (distance <= 3) return { reading: 'High', status: 'STATUS: High Capacity', className: 'text-yellow-400 font-bold' };
  if (distance <= 15) return { reading: 'Normal', status: 'STATUS: Stable Level', className: 'text-emerald-400 font-bold' };
  return { reading: 'Low', status: 'STATUS: Low Reserves', className: 'text-red-400 font-bold' };
};

export const getPressureStatus = (pressure) => {
  if (pressure <= 0 || pressure === -1 || pressure === undefined) {
    return {
      status: "SENSOR ERROR",
      className: "text-red-500 font-black animate-pulse",
    };
  }

  if (pressure < 990) return { status: "WARNING: Low Pressure", className: "text-red-400 font-bold" };
  if (pressure > 1030) return { status: "STATUS: High Pressure", className: "text-yellow-400 font-bold" };
  return { status: "STATUS: Stable", className: "text-emerald-400 font-bold" };
};