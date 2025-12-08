// src/utils/fuzzyEngine.js

// --- Helper Functions ---
const isLow = (val, trueThreshold, falseThreshold) => {
    if (val <= trueThreshold) return 1.0; 
    if (val >= falseThreshold) return 0.0; 
    return (falseThreshold - val) / (falseThreshold - trueThreshold);
};

const isMiddle = (val, start, peak, end) => {
    return Math.max(0, Math.min((val - start) / (peak - start), (end - val) / (end - peak)));
};

// --- MAIN AI FUNCTION ---
export const calculateFloodRisk = (rainRaw, soilRaw, waterDist, pressure) => {
    
    // ============================================
    // 1. FUZZIFICATION (Inputs -> 0.0 to 1.0)
    // ============================================

    // Rain (Low value = Wet)
    const rainHeavy = isLow(rainRaw, 307, 511);        
    const rainModerate = isMiddle(rainRaw, 307, 511, 767); 
    
    // Soil (Low value = Wet)
    const soilSaturated = isLow(soilRaw, 511, 818);    
    
    // Water Level (Low distance = High/Full)
    const waterHigh = isLow(waterDist, 4, 10); // Expanded range slightly for interaction
    const waterCritical = isLow(waterDist, 4, 5);     

    // Pressure (Low value = Storm)
    const pressureStorm = isLow(pressure, 990, 1000);  

    // ============================================
    // 2. INFERENCE (The "Communication" Rules)
    // ============================================

    /* Here, sensors "talk" to each other using Math.min().
       Math.min() acts like an "AND" gate. 
       Both conditions must be true for the rule to trigger.
    */

    // RULE A: The "Runoff" Effect (Rain + Soil)
    // "If it is raining heavily AND soil is already full..."
    // This communicates that rain is worse when soil can't drink it.
    const runoffRisk = Math.min(rainHeavy, soilSaturated);

    // RULE B: The "Storm Surge" Effect (Water + Pressure)
    // "If water is already high AND a storm is coming (low pressure)..."
    // This communicates that high water is scarier when pressure drops.
    const surgeRisk = Math.min(waterHigh, pressureStorm);

    // RULE C: The "Active Flood" Effect (Rain + Water)
    // "If it is raining heavily AND water is already high..."
    // Direct correlation: Input is adding to an already full container.
    const activeFloodRisk = Math.min(rainHeavy, waterCritical);

    // RULE D: The "Catastrophe" Combo (All 4 Sensors)
    // If everything is bad at once.
    const systemFailure = Math.min(rainHeavy, soilSaturated, waterCritical, pressureStorm);


    // ============================================
    // 3. DEFUZZIFICATION (Weighted Total)
    // ============================================

    // We calculate the final risk by prioritizing the combinations.
    // Notice we don't just add "rain" or "soil" alone anymore.
    // We add the *combinations* we calculated above.

    let totalRisk = 0;

    // If all sensors agree (Rule D), instant 100%
    if (systemFailure > 0.5) {
        totalRisk = 100;
    } 
    else {
        // Otherwise, weigh the specific interactions:
        // Active Flooding (Rain + Water) is the most dangerous scenario (weight 60)
        // Runoff (Rain + Soil) adds moderate risk (weight 30)
        // Surge (Pressure + Water) adds prediction risk (weight 20)
        
        // We use Math.max to take the highest severity of the overlapping rules
        // or a weighted sum. Let's use a weighted approach clamped to 100.
        
        totalRisk = (activeFloodRisk * 60) + (runoffRisk * 30) + (surgeRisk * 20);
        
        // Add a base risk if Water is critical on its own (failsafe)
        totalRisk += (waterCritical * 40);
    }

    // Clamp to 0-100
    let finalRisk = Math.min(100, totalRisk);
    
    // --- STATUS TEXT ---
    let status = "SAFE";
    let message = "Conditions stable.";

    if (finalRisk >= 90) {
        status = "EMERGENCY";
        message = "ALL SENSORS CRITICAL. EVACUATE.";
    } 
    else if (finalRisk >= 70) {
        status = "CRITICAL";
        message = "High water with active rain/storm inputs.";
    } 
    else if (finalRisk >= 50) {
        status = "WARNING";
        message = "Water rising due to rain/soil saturation.";
    } 
    else if (finalRisk >= 30) {
        status = "ADVISORY";
        message = "Sensors detecting potential runoff.";
    } 
    else {
        status = "SAFE";
        message = "Normal levels.";
    }

    return {
        score: finalRisk.toFixed(1),
        status,
        message,
        // We return the "Interaction" scores so you can see the communication happening
        details: {
            runoff_factor: (runoffRisk * 100).toFixed(0), // Rain + Soil
            surge_factor: (surgeRisk * 100).toFixed(0),   // Water + Pressure
            flood_factor: (activeFloodRisk * 100).toFixed(0) // Rain + Water
        }
    };
};