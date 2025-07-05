import * as ble from './js/bluetooth.js';
import * as hrv from './js/hrv-calculations.js';
import * as ui from './js/ui.js';
import { generateAndDownloadRRText as generateAndDownloadCSV } from './js/txt-exporter.js';
import * as history from './js/history.js';
import { getLiveHrZone, generateHrZoneReport } from './js/hr-zone.js';
import { handleBreathData } from './breath.js';

const elements = ui.getElements();

let hrMeasurements = [];
let allFilteredRrIntervals = [];
let lastRrInterval = null;
let sessionStartTime = null;
let deviceConnection = null;

function resetSession() {
    hrMeasurements = [];
    allFilteredRrIntervals = [];
    lastRrInterval = null;
    sessionStartTime = new Date();
    ui.resetUI();
}

function handleData({ heartRate, rawRrIntervals }) {
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

    // Calculate a more stable HR from recent RR intervals if available.
    // This is often more accurate than the HR value directly from the device.
    let displayHr = heartRate;
    const recentRrIntervals = allFilteredRrIntervals.slice(-4); // Use last 4 for a rolling average
    if (recentRrIntervals.length > 0) {
        const averageRr = recentRrIntervals.reduce((sum, rr) => sum + rr, 0) / recentRrIntervals.length;
        if (averageRr > 0) {
            displayHr = Math.round(60000 / averageRr);
        }
    }

    const timestamp = new Date();
    hrMeasurements.push({ timestamp: timestamp.toISOString(), hr: displayHr, rrIntervals: processedRrIntervals });
    ui.updateLog(timestamp, displayHr, processedRrIntervals);

    const windowedRr = allFilteredRrIntervals.slice(-300); // Use a rolling window for live metrics
    const userInputs = ui.getUserInputs();

    const hrvMetrics = hrv.calculateHrvMetrics(windowedRr);

    // Calculate Recovery and Conditioning scores using the new scaling logic.
    const recoveryScore = hrv.calculateRecoveryScore(hrvMetrics.rmssd, userInputs.baselineRmssd);
    const conditioningScore = hrv.scale(hrvMetrics.sdnn, 20, 150, 0, 100);

    const durationMinutes = (new Date() - sessionStartTime) / (1000 * 60);
    // Add 1 to durationMinutes to prevent strain score from being 0 at the start
    const strainScore = hrv.calculateStrainScore(hrMeasurements, durationMinutes + 1, userInputs);

    ui.updateMetrics({
        hr: displayHr,
        sdnn: hrvMetrics.sdnn,
        rmssd: hrvMetrics.rmssd,
        recovery: recoveryScore,
        conditioning: conditioningScore,
        strain: strainScore,
        recoveryTime: hrvMetrics.recoveryTime
    });
    ui.updateChart(timestamp, {
        hr: displayHr,
        sdnn: hrvMetrics.sdnn,
        rmssd: hrvMetrics.rmssd,
        recovery: recoveryScore,
        conditioning: conditioningScore,
        strain: strainScore
    });

    const at = parseFloat(document.getElementById('hrMax').value) || 180;
    const liveZone = getLiveHrZone(displayHr, at, recoveryScore);
    document.getElementById('hrZone').textContent = liveZone;

    handleBreathData({ heartRate: displayHr, rrIntervals: processedRrIntervals });
}

/**
 * Calculates final metrics for the completed session.
 * @returns {object} An object containing all final session data.
 */
function calculateFinalSessionData() {
    const durationMinutes = (new Date() - sessionStartTime) / (1000 * 60);
    const userInputs = ui.getUserInputs();
    const finalHrv = hrv.calculateHrvMetrics(allFilteredRrIntervals);
    const recoveryScore = hrv.calculateRecoveryScore(finalHrv.rmssd, userInputs.baselineRmssd);
    const conditioningScore = hrv.scale(finalHrv.sdnn, 20, 150, 0, 100);
    const strainScore = hrv.calculateStrainScore(hrMeasurements, durationMinutes, userInputs);

    return {
        timestamp: sessionStartTime.toISOString(),
        durationMinutes,
        finalHrv,
        recoveryScore,
        conditioningScore,
        strainScore,
        hrMeasurements // Pass along for other functions that need the raw data
    };
}

/**
 * Saves the session to history and updates the UI.
 * @param {object} sessionSummary - The summary object for the session.
 */
function saveAndRenderHistory(sessionSummary) {
    history.saveSession(sessionSummary);
    ui.renderHistory(history.loadHistory());
}

/**
 * Prepares RR interval data and shows the advanced analysis modal.
 * Note: Assumes the modal contains an iframe with id="hrvAnalysisFrame".
 */
function showAdvancedAnalysisModal() {
    const modal = document.getElementById('hrvAnalysisModal');
    const frame = document.getElementById('hrvAnalysisFrame');
    const closeButton = document.getElementById('closeHrvModal');

    if (!modal || !frame || !closeButton) {
        console.error('Advanced analysis modal components not found. Cannot show modal.');
        return;
    }

    const allRR = hrMeasurements.flatMap(data => data.rrIntervals);
    const rrText = allRR.map(rr => Math.round(rr)).join('\n');
    const rrBlob = new Blob([rrText], { type: 'text/plain' });
    const rrUrl = URL.createObjectURL(rrBlob);

    modal.style.display = 'block';
    frame.src = `AdvancedHRVAnalysis\\AdvancedHRVAnalysis.html?rrfile=${encodeURIComponent(rrUrl)}`;

    closeButton.onclick = () => {
        modal.style.display = 'none';
        frame.src = ''; // Clear iframe content
        URL.revokeObjectURL(rrUrl); // Clean up blob URL
    };
}

/**
 * Handles all tasks for processing the end of a session.
 */
function processSessionEnd() {
    const sessionData = calculateFinalSessionData();
    ui.updateMetrics({ recovery: sessionData.recoveryScore, conditioning: sessionData.conditioningScore, strain: sessionData.strainScore });
    saveAndRenderHistory(sessionData);
    const filename = generateAndDownloadCSV({ hrMeasurements });
    ui.updateStatus(`Session data saved to ${filename}`);
    showAdvancedAnalysisModal();
}

elements.connectButton.addEventListener('click', async () => {
    ui.setUIState('connecting');
    try {
        deviceConnection = await ble.connect(handleData, (deviceName) => {
            ui.setUIState('connected', deviceName);
            resetSession();
        });
    } catch (error) {
        ui.setUIState('disconnected', `Error: ${error.message}`);
    }
});

elements.stopButton.addEventListener('click', async () => {
    if (deviceConnection) {
        await deviceConnection.disconnect();
        ui.setUIState('disconnected', `Disconnected from ${deviceConnection.deviceName}.`);
    }

    if (hrMeasurements.length > 0) {
        processSessionEnd();
    }
});
elements.clearHistoryButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all session history? This cannot be undone.')) {
        history.clearHistory();
        ui.renderHistory(history.loadHistory());
        ui.updateStatus('Session history cleared.');
    }
});

function initializeApp() {
    ui.renderHistory(history.loadHistory());
    ui.initChart();
    ui.setUIState('disconnected', 'Ready to connect to a Heart Rate Monitor.');
    document.getElementById('hrZone').textContent = '-';
    document.getElementById('hrZoneReport').innerHTML = '';
}

initializeApp();


export { resetSession, handleData, generateHrZoneReport, initializeApp };