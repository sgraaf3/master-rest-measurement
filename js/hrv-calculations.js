/**
 * Calculates SDNN and RMSSD.
 * @param {number[]} rrIntervals - An array of RR intervals in milliseconds.
 * @returns {{sdnn: number, rmssd: number}} An object with sdnn and rmssd values.
 */
export function calculateHrvMetrics(rrIntervals) {
    if (rrIntervals.length < 2) return { sdnn: NaN, rmssd: NaN };

    const meanRr = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
    const sumOfSquaredDiffs = rrIntervals.reduce((sum, val) => sum + Math.pow(val - meanRr, 2), 0);
    const sdnn = Math.sqrt(sumOfSquaredDiffs / rrIntervals.length);

    let sumOfSuccessiveSqDiffs = 0;
    for (let i = 0; i < rrIntervals.length - 1; i++) {
        sumOfSuccessiveSqDiffs += Math.pow(rrIntervals[i + 1] - rrIntervals[i], 2);
    }
    const rmssd = Math.sqrt(sumOfSuccessiveSqDiffs / (rrIntervals.length - 1));

    console.log('RR Intervals:', rrIntervals, 'Calculated Metrics:', { sdnn, rmssd });

    return { sdnn, rmssd };
}

/**
 * Calculates a simplified Recovery Score (0-100) based on RMSSD.
 * @param {number} rmssd - The RMSSD value in milliseconds.
 * @param {number} baselineRmssd - The user's personal baseline RMSSD.
  * @returns {number} Recovery score.
 */


export function calculateRecoveryScore(rmssd, baselineRmssd) {
    if (isNaN(rmssd) || rmssd <= 0 || !baselineRmssd || baselineRmssd <= 0) return 0;

    // A score of 50 represents a reading equal to the baseline.
    // The score scales based on a range around the user's baseline.
    const lowerBound = baselineRmssd * 0.5; // A reading at 50% of baseline is a low score
    const upperBound = baselineRmssd * 1.5; // A reading at 150% of baseline is a high score

    const score = ((rmssd - lowerBound) / (upperBound - lowerBound)) * 100;
    return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Calculates a simplified Strain Score (0-100).
 * @param {{hr: number}[]} hrDataPoints - Array of { hr } objects.
 * @param {number} durationMinutes - Duration of the session in minutes.
 * @param {number} durationMinutes - Duration of the session in minutes.
 * @param {{hrRest: number, hrMax: number}} userMetrics - User's personal HR metrics.
 * @returns {number} Strain score.
 */

export function calculateStrainScore(hrDataPoints, durationMinutes, userMetrics) {
    const { hrRest, hrMax } = userMetrics;
    if (hrDataPoints.length === 0 || durationMinutes <= 0 || !hrRest || !hrMax || hrMax <= hrRest) return 0;

    const averageHr = hrDataPoints.reduce((sum, dp) => sum + dp.hr, 0) / hrDataPoints.length;
    const hrReserve = hrMax - hrRest;

    // Calculate intensity as a percentage of the user's heart rate reserve
    const intensity = Math.max(0, (averageHr - hrRest) / hrReserve);
    const durationFactor = Math.min(1, durationMinutes / 120); // Cap duration effect at 2 hours
    const score = intensity * durationFactor * 100;
    return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Scales a value from an input range to an output range.
 * Clamps the output value to the output range.
 * @param {number} value - The value to scale.
 * @param {number} inMin - The minimum value of the input range.
 * @param {number} inMax - The maximum value of the input range.
 * @param {number} outMin - The minimum value of the output range.
 * @param {number} outMax - The maximum value of the output range.
 * @returns {number} The scaled value, rounded to the nearest integer.
 */
export function scale(value, inMin, inMax, outMin, outMax) {
    if (inMin === inMax) { // Avoid division by zero, return the middle of the output range
        return Math.round((outMin + outMax) / 2);
    }
    const scaled = outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
    return Math.round(Math.max(outMin, Math.min(outMax, scaled)));
}
