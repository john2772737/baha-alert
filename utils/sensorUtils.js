// utils/sensorUtils.js

export const initialSensorData = {
  pressure: 1012.0, // hPa
  rainRaw: 1023, // Analog value (1023 = dry, 0 = wet)
  soilRaw: 1023, // Analog value (1023 = dry, 0 = wet)
  waterDistanceCM: 50.0, // Ultrasonic distance (cm)
  deviceMode: "---", // Mode reported by hardware
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

// --- Mappings (Raw -> Percentage) ---
export const STATE_MAPPINGS = {
  rain: (rainRaw) => clamp(100 - (rainRaw / 1023.0) * 100),
  soil: (soilRaw) => clamp(100 - (soilRaw / 1023.0) * 100),
  // Tank max depth 50cm
  waterTank: (distanceCM) =>
    distanceCM > 100 ? 0 : clamp(100.0 - (distanceCM / 50.0) * 100.0),
};

// --- Status Logic (Percentage/Value -> Display) ---
// ... (Your existing initialSensorData and helpers) ...

export const getRainStatus = (percent) => {
  // 0% - 25%: Ignored as noise/dry
  if (percent < 25)
    return {
      reading: "No Rain",
      status: "STATUS: Clear",
      className: "text-emerald-400 font-bold",
    };

  // 25% - 50%: Light Rain
  if (percent < 50)
    return {
      reading: "Light Rain",
      status: "STATUS: Drizzling",
      className: "text-yellow-400 font-bold",
    };

  // 50% - 70%: Moderate Rain (Lowered max threshold)
  if (percent < 70)
    return {
      reading: "Moderate Rain",
      status: "STATUS: Raining",
      className: "text-orange-400 font-bold",
    };

  // 70% - 100%: Heavy Rain (Now triggers earlier)
  return {
    reading: "Heavy Rain",
    status: "ALERT: Storm Conditions",
    className: "text-red-400 font-bold",
  };
};

// ... (Rest of your status functions) ...
export const getSoilStatus = (percent) => {
    // 0% - 40%: Dry
    // Meaning: The soil is dry and needs rain/watering.
    if (percent < 20) return { 
        reading: 'Dry', 
        status: 'STATUS: Low Moisture', 
        className: 'text-red-400 font-bold' 
    };
    
    // 40% - 80%: Moist
    // Meaning: Ideal conditions, holding water but not flooding.
    if (percent < 50) return { 
        reading: 'Moist', 
        status: 'STATUS: Healthy', 
        className: 'text-emerald-400 font-bold' 
    };
    
    // 80% - 100%: Wet
    // Meaning: Saturated, likely currently raining or just finished raining.
    return { 
        reading: 'Wet', 
        status: 'STATUS: Saturated', 
        className: 'text-cyan-400 font-bold' 
    };
};

export const getWaterTankStatus = (percent, distance) => {
  if (distance >= 400)
    return {
      reading: "Error",
      status: "SENSOR ERROR",
      className: "text-red-500 font-black animate-pulse",
    };
  if (percent > 70)
    return {
      reading: "High",
      status: "STATUS: High Capacity",
      className: "text-yellow-400 font-bold",
    };
  if (percent >= 20)
    return {
      reading: "Normal",
      status: "STATUS: Stable Level",
      className: "text-emerald-400 font-bold",
    };
  return {
    reading: "Low",
    status: "STATUS: Low Reserves",
    className: "text-red-400 font-bold",
  };
};

export const getPressureStatus = (pressure) => {
  if (pressure < 990)
    return {
      status: "WARNING: Low Pressure",
      className: "text-red-400 font-bold",
    };
  if (pressure > 1030)
    return {
      status: "STATUS: High Pressure",
      className: "text-yellow-400 font-bold",
    };
  return { status: "STATUS: Stable", className: "text-emerald-400 font-bold" };
};
