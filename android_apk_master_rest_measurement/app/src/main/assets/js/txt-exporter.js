export function generateAndDownloadRRText({ hrMeasurements }) {
    const allRR = hrMeasurements.flatMap(data => data.rrIntervals);
    const rrLine = allRR.map(rr => Math.round(rr)).join(' ');
    const date = new Date();
    const dateTimeString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
    const filename = `rr-intervals_${dateTimeString}.txt`;

    const blob = new Blob([rrLine], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);

    return filename;
}