import * as ble from './js/bluetooth.js';
import * as hrv from './js/hrv-calculations.js';
import * as ui from './js/ui.js';
import { generateAndDownloadRRText as generateAndDownloadCSV } from './js/txt-exporter.js';
import * as history from './js/history.js';

let breathCircle, breathFrequencyElem, ieRatioElem, timeInElem, timeOutElem, breathPhaseElem;

document.addEventListener('DOMContentLoaded', () => {
    breathCircle = document.getElementById('breathCircle');
    breathFrequencyElem = document.getElementById('breathFrequency');
    ieRatioElem = document.getElementById('ieRatio');
    timeInElem = document.getElementById('timeIn');
    timeOutElem = document.getElementById('timeOut');
    breathPhaseElem = document.getElementById('breathPhase');
});

const elements = ui.getElements();

let hrMeasurements = [];
let allFilteredRrIntervals = [];
let lastRrInterval = null;
let sessionStartTime = null;
let deviceConnection = null;

// Add these state variables at the top
let lastHR = null;
let lastTimestamp = null;
let phase = null; // 'in' or 'out'
let phaseStartTime = null;
let timeIn = 0;
let timeOut = 0;
let cycles = [];
let currentCycle = { timeIn: 0, timeOut: 0, start: null };
let cycleCount = 0;

function resetSession() {
    hrMeasurements = [];
    allFilteredRrIntervals = [];
    lastRrInterval = null;
    sessionStartTime = new Date();
    ui.resetUI();
}

export function handleBreathData({ heartRate, rawRrIntervals }) {
    if (!breathCircle || !breathFrequencyElem || !ieRatioElem || !timeInElem || !timeOutElem || !breathPhaseElem) {
        // console.error("Breath display elements not found in the DOM or not yet initialized.");
        return;
    }

    let processedRrIntervals = rawRrIntervals;

    // If the device doesn't provide RR intervals, simulate them from the heart rate.
    if (heartRate > 0 && (!rawRrIntervals || rawRrIntervals.length === 0)) {
        const simulatedRr = 60000 / heartRate;
        processedRrIntervals = [simulatedRr];
    }

    if (processedRrIntervals.length > 0) {
        allFilteredRrIntervals.push(...processedRrIntervals);
        lastRrInterval = processedRrIntervals[processedRrIntervals.length - 1];
    }

    const timestamp = new Date();
    hrMeasurements.push({ timestamp: timestamp.toISOString(), hr: heartRate, rrIntervals: processedRrIntervals });
    ui.updateLog(timestamp, heartRate, processedRrIntervals);

    // --- Calculate average HR from last 4 RR intervals ---
    const last4RR = allFilteredRrIntervals.slice(-4);
    let avgHR = '--';
    if (last4RR.length > 1) {
        const avgRR = last4RR.reduce((sum, rr) => sum + rr, 0) / last4RR.length;
        avgHR = Math.round(60000 / avgRR);
    }

    // --- Breath phase detection ---
    const now = Date.now();
    if (lastHR !== null && lastTimestamp !== null && typeof avgHR === 'number') {
        const dt = (now - lastTimestamp) / 1000; // seconds

        if (avgHR > lastHR) {
            // HR rising: breath in
            if (phase !== 'in') {
                // Transition: out -> in (new cycle)
                if (phase === 'out' && currentCycle.timeOut > 0) {
                    cycles.push({ ...currentCycle });
                    cycleCount++;
                    currentCycle = { timeIn: 0, timeOut: 0, start: now };
                }
                phase = 'in';
                phaseStartTime = now;
            }
            currentCycle.timeIn += dt;
        } else if (avgHR < lastHR) {
            // HR falling: breath out
            if (phase !== 'out') {
                // Transition: in -> out
                phase = 'out';
                phaseStartTime = now;
            }
            currentCycle.timeOut += dt;
        } else {
            // HR flat: continue current phase
            if (phase === 'in') currentCycle.timeIn += dt;
            else if (phase === 'out') currentCycle.timeOut += dt;
        }
    } else {
        // First data point
        phase = 'in';
        phaseStartTime = now;
        currentCycle = { timeIn: 0, timeOut: 0, start: now };
    }

    lastHR = typeof avgHR === 'number' ? avgHR : lastHR;
    lastTimestamp = now;

    // --- Calculate frequency and I/E ratio ---
    let breathFrequency = 10;
    let ieRatio = 0.7;
    if (cycles.length > 0) {
        // Calculate frequency over last minute
        const oneMinuteAgo = now - 120000;
        const recentCycles = cycles.filter(c => c.start > oneMinuteAgo);
        breathFrequency = recentCycles.length;
        // Use last completed cycle for I/E ratio
        const lastCycle = cycles[cycles.length - 1];
        if (lastCycle && lastCycle.timeOut > 0) {
            ieRatio = lastCycle.timeIn / lastCycle.timeOut;
            ieRatio = Math.max(0.4, Math.min(2.2, ieRatio));
        }
    }

    // Update the HTML elements directly
    breathFrequencyElem.innerText = breathFrequency.toFixed(1);
    ieRatioElem.innerText = ieRatio.toFixed(2);
    timeInElem.innerText = currentCycle.timeIn.toFixed(1);
    timeOutElem.innerText = currentCycle.timeOut.toFixed(1);
    breathPhaseElem.innerText = phase === 'in' ? 'Inspiration' : 'Expiration';

    ui.updateMetrics({ hr: avgHR });

    
    

    // Update the flashing circle color and brightness
    if (phase === 'in') {
        // Light blue for inspiration
        breathCircle.style.background = '#6ec6ff';
        breathCircle.style.boxShadow = '0 0 30px 10px #6ec6ff88';
    } else if (phase === 'out') {
        // Dark blue for expiration
        breathCircle.style.background = '#1565c0';
        breathCircle.style.boxShadow = '0 0 15px 5px #1565c088';
    }

    // Add this after setting the color
    breathCircle.animate([
        { transform: 'scale(1.2)' },
        { transform: 'scale(1)' }
    ], {
        duration: 300,
        easing: 'ease'
    });

    // --- Calculate averages for last minute ---
    const oneMinuteAgo = now - 60000;
    const recentCycles = cycles.filter(c => c.start > oneMinuteAgo);

    // If no completed cycles in the last minute, include the running (current) cycle
    let tiSum = 0, teSum = 0, n = 0;
    if (recentCycles.length > 0) {
        tiSum = recentCycles.reduce((sum, c) => sum + c.timeIn, 0);
        teSum = recentCycles.reduce((sum, c) => sum + c.timeOut, 0);
        n = recentCycles.length;
    } else {
        // No completed cycles in last minute, use running totals
        tiSum = currentCycle.timeIn;
        teSum = currentCycle.timeOut;
        n = 1;
    }

    const avgTi = tiSum / n;
    const avgTe = teSum / n;
    let avgIeRatio = avgTe > 0 ? avgTi / avgTe : 0;
    avgIeRatio = Math.max(0.4, Math.min(2.2, avgIeRatio));

    // Display these averages in your UI above the graph
    document.getElementById('timeIn').innerText = avgTi.toFixed(1);
    document.getElementById('timeOut').innerText = avgTe.toFixed(1);
    document.getElementById('ieRatio').innerText = avgIeRatio.toFixed(2);
}







export function generateBreathReport(cycles, sessionStartTime) {
    if (!cycles.length) return "<h2>Breathing Report</h2><p>No breath cycles detected.</p>";

    // Overall averages
    const totalTi = cycles.reduce((sum, c) => sum + c.timeOut, 0);
    const totalTe = cycles.reduce((sum, c) => sum + c.timeIn, 0);
    const totalCycles = cycles.length;
    const avgTi = totalTi / totalCycles;
    const avgTe = totalTe / totalCycles;
    const avgIe = avgTe > 0 ? avgTi / avgTe : 0;
    const avgIeClamped = Math.max(0.4, Math.min(2.2, avgIe));
    // DOUBLE THE FREQUENCY HERE:
    const avgFreq =  60/(avgTi+avgTe);

    // Per-minute review
    const perMinute = [];
    const sessionStart = cycles[0].start;
    const sessionEnd = cycles[cycles.length - 1].start;
    const sessionMinutes = Math.ceil((sessionEnd - sessionStart) / 60000);

    for (let m = 0; m < sessionMinutes; m++) {
        const minStart = sessionStart + m * 60000;
        const minEnd = minStart + 60000;
        const minuteCycles = cycles.filter(c => c.start >= minStart && c.start < minEnd);
        if (minuteCycles.length) {
            const ti = minuteCycles.reduce((sum, c) => sum + c.timeIn, 0) / minuteCycles.length*2;
            const te = minuteCycles.reduce((sum, c) => sum + c.timeOut, 0) / minuteCycles.length*2;
            const ie = te > 0 ? ti / te : 0;
            // DOUBLE THE FREQUENCY HERE:
            perMinute.push({
                minute: m + 1,
                freq: 2 * minuteCycles.length,
                ti: ti,
                te: te,
                ie: Math.max(0.4, Math.min(ie))
            });
        }
    }

    // Explanation
    let html = `<h2>Breathing Report</h2>
    <p>This report summarizes your breathing pattern during the session. Each breath cycle consists of an inspiration (time in, Ti) and expiration (time out, Te). The I/E ratio is Ti divided by Te, clamped between 0.4 and 2.2. Frequency is breaths per minute.</p>
    <h3>Overall Averages</h3>
    <ul>
        <li><b>Average Frequency:</b> ${avgFreq.toFixed(2)} breaths/min</li>
        <li><b>Average Ti:</b> ${avgTi.toFixed(2)} s</li>
        <li><b>Average Te:</b> ${avgTe.toFixed(2)} s</li>
        <li><b>Average I/E Ratio:</b> ${avgIeClamped.toFixed(2)}</li>
        <li><b>Total Cycles:</b> ${totalCycles}</li>
    </ul>
    <h3>Per-Minute Review</h3>
    <table border="1" cellpadding="4" style="border-collapse:collapse;">
        <tr>
            <th>Minute</th>
            <th>Frequency</th>
            <th>Avg Ti (s)</th>
            <th>Avg Te (s)</th>
            <th>Avg I/E</th>
        </tr>`;
    perMinute.forEach(row => {
        html += `<tr>
            <td>${row.minute}</td>
            <td>${row.freq}</td>
            <td>${row.ti.toFixed(2)}</td>
            <td>${row.te.toFixed(2)}</td>
            <td>${row.ie.toFixed(2)}</td>
        </tr>`;
    });
    html += `</table>`;
    return html;
}

function generateHrZoneReport(hrMeasurements, at, recoveryScore) {
    if (!hrMeasurements.length) return "<h2>HR Zone Report</h2><p>No HR data available.</p>";

    // Calculate average HR for the session
    const avgHr = hrMeasurements.reduce((sum, m) => sum + m.hr, 0) / hrMeasurements.length;

    // Calculate HR zone boundaries
    const maxHr = 1.1 * at;
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
    if (avgHr >= intensive2Min && avgHr <= intensive2Max) {
        zone = 'Intensive 2';
    } else if (avgHr >= intensive1Min && avgHr < intensive2Min) {
        zone = 'Intensive 1';
    } else if (avgHr >= atMin && avgHr < intensive1Min) {
        zone = 'Anaerobic Threshold (AT)';
    } else if (avgHr >= zone3Min && avgHr < atMin) {
        zone = 'Zone 3';
    } else if (avgHr >= zone2Min && avgHr < zone3Min) {
        zone = 'Zone 2';
    } else if (avgHr >= zone1Min && avgHr < zone2Min) {
        zone = 'Zone 1';
    } else if (avgHr >= transitionMin && avgHr < zone1Min) {
        zone = 'Transition Rest/Sport';
    } else if (avgHr < transitionMin) {
        // Below .6*AT, use recoveryScore
        if (recoveryScore > 70) zone = 'Relaxed';
        else if (recoveryScore > 50) zone = 'Rest';
        else if (recoveryScore > 35) zone = 'Active Light';
        else if (recoveryScore > 20) zone = 'Active';
        else if (recoveryScore > 10) zone = 'Really Active';
        else zone = 'Very Active';
    } else {
        zone = 'Above Max HR';
    }

    return `
    <h2>HR Zone Report</h2>
    <ul>
        <li><b>Average HR:</b> ${avgHr.toFixed(1)} bpm</li>
        <li><b>AT (Anaerobic Threshold):</b> ${at.toFixed(1)} bpm</li>
        <li><b>Max HR (1.1 × AT):</b> ${maxHr.toFixed(1)} bpm</li>
        <li><b>Recovery Score:</b> ${recoveryScore}</li>
        <li><b>Detected Zone:</b> <span style="font-weight:bold;color:#007bff">${zone}</span></li>
    </ul>
    <p>
        <b>Zone Legend:</b><br>
        Intensive 2: 1.05–1.10 × AT<br>
        Intensive 1: 1.00–1.05 × AT<br>
        AT: 0.96–1.00 × AT<br>
        Zone 3: 0.90–0.96 × AT<br>
        Zone 2: 0.80–0.90 × AT<br>
        Zone 1: 0.70–0.80 × AT<br>
        Transition Rest/Sport: 0.60–0.70 × AT<br>
        Below 0.60 × AT: Relax/Rest/Active (based on Recovery Score)
    </p>
    `;
}


