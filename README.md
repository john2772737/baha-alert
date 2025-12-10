
# BABAD (Baha Alert and Babala Against Disaster)

BABAD  is a real-time flood monitoring system that integrates IoT sensors with a Next.js web dashboard. It uses a Fuzzy Logic AI Engine to analyze sensor data (Rain, Soil Moisture, Water Level, Pressure) and determine flood risk levels, sending automated email alerts when critical thresholds are breached.

# 🚀 Key Features
Real-Time Monitoring: Live dashboard displaying data from Rain, Soil, Water Level, and Barometric Pressure sensors.

🤖 Fuzzy Logic AI: Client-side AI engine calculates flood risk (Stable, Advisory, Warning, Critical) based on multi-sensor inputs.

📧 Automated Alerts: Triggers email notifications via API when flood status changes to critical levels.

Operation Modes:

AUTO: Standard monitoring mode.

MAINTENANCE: Manual testing console for sensor calibration and diagnostics.

SLEEP: Low-power mode visualization.

Historical Data: Interactive 7-day history charts using Chart.js.

Hardware Lock: Dashboard UI locks automatically if the physical device switch is set to a different mode.

🛠️ Tech Stack
Frontend: Next.js 15 (React), Tailwind CSS, Chart.js

Backend: Next.js API Routes (Serverless Functions)

Database: MongoDB Atlas (Mongoose ODM)

Authentication: Firebase Auth (or custom context implementation)

Deployment: Vercel
