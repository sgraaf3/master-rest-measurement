/* The code that was here was for illustrative purposes and was causing a
 * ReferenceError on load. The actual implementation is in main.js.
 * This file should only export functions.
 */
export function generateHrZoneReport(hrMeasurements, at, recoveryScore) {
    if (!hrMeasurements.length) return "<h2>HR Zone Report</h2><p>No HR data available.</p>";
    const avgHr = hrMeasurements.reduce((sum, m) => sum + m.hr, 0) / hrMeasurements.length;
    const zone = getLiveHrZone(avgHr, at, recoveryScore);

    return `
    <h2>HR Zone Report</h2>
    <ul>
        <li><b>Average HR:</b> ${avgHr.toFixed(1)} bpm</li>
        <li><b>AT (Anaerobic Threshold):</b> ${at.toFixed(1)} bpm</li>
        <li><b>Recovery Score:</b> ${recoveryScore}</li>
        <li><b>Detected Zone:</b> <span style="font-weight:bold;color:#007bff">${zone}</span></li>
    </ul>
    `;
}
export function getLiveHrZone(currentHr, at, recoveryScore) {
    const intensive2Min = 1.05 * at;
    const intensive2Max = 1.1 * at;
    const intensive1Min = 1.00 * at;
    const intensive1Max = 1.05 * at;
    const atMin = 0.96 * at;
    const atMax = 1.00 * at;
    const zone3Min = 0.90 * at;
    const zone3Max = 0.96 * at;
    const zone2Min = 0.80 * at;
    const zone2Max = 0.90 * at;
    const zone1Min = 0.70 * at;
    const zone1Max = 0.80 * at;
    const transitionMin = 0.60 * at;
    const transitionMax = 0.70 * at;

    let zone = '';
    if (currentHr >= intensive2Min && currentHr <= intensive2Max) {
        zone = 'Intensive 2';
    } else if (currentHr >= intensive1Min && currentHr < intensive2Min) {
        zone = 'Intensive 1';
    } else if (currentHr >= atMin && currentHr < intensive1Min) {
        zone = 'Anaerobic Threshold (AT)';
    } else if (currentHr >= zone3Min && currentHr < atMin) {
        zone = 'Zone 3';
    } else if (currentHr >= zone2Min && currentHr < zone3Min) {
        zone = 'Zone 2';
    } else if (currentHr >= zone1Min && currentHr < zone2Min) {
        zone = 'Zone 1';
    } else if (currentHr >= transitionMin && currentHr < zone1Min) {
        zone = 'Transition Rest/Sport';
    } else if (currentHr < transitionMin) {
        if (recoveryScore > 70) zone = 'Relaxed';
        else if (recoveryScore > 50) zone = 'Rest';
        else if (recoveryScore > 35) zone = 'Active Light';
        else if (recoveryScore > 20) zone = 'Active';
        else if (recoveryScore > 10) zone = 'Really Active';
        else zone = 'Very Active';
    } else {
        zone = 'Above Max HR';
    }
    return zone;
}