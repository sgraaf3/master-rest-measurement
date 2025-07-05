const HR_SERVICE_UUID = 'heart_rate';
const HR_MEASUREMENT_CHARACTERISTIC_UUID = 'heart_rate_measurement';

let device;
let heartRateCharacteristic;
let onDataCallback;

function parseHeartRate(value) {
    const flags = value.getUint8(0);
    const rate16Bits = flags & 0x1;
    const rrIntervalsPresent = (flags >> 4) & 0x1;

    let index = 1;
    const heartRate = rate16Bits ? value.getUint16(index, true) : value.getUint8(index);
    index += rate16Bits ? 2 : 1;

    if ((flags >> 3) & 0x1) index += 2; // Skip Energy Expended

    const rawRrIntervals = [];
    if (rrIntervalsPresent) {
        while (index < value.byteLength) {
            const rr = value.getUint16(index, true);
            rawRrIntervals.push(rr * (1000 / 1024)); // Convert to ms
            index += 2;
        }
    }
    return { heartRate, rawRrIntervals };
}

function handleCharacteristicValueChanged(event) {
    if (onDataCallback) {
        onDataCallback(parseHeartRate(event.target.value));
    }
}

export async function connect(onData, onConnect) {
    onDataCallback = onData;

    device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HR_SERVICE_UUID] }],
        optionalServices: [HR_SERVICE_UUID]
    });

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(HR_SERVICE_UUID);
    heartRateCharacteristic = await service.getCharacteristic(HR_MEASUREMENT_CHARACTERISTIC_UUID);

    await heartRateCharacteristic.startNotifications();
    heartRateCharacteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);

    onConnect(device.name);

    return {
        deviceName: device.name,
        disconnect: async () => {
            if (device?.gatt?.connected) {
                await heartRateCharacteristic.stopNotifications();
                device.gatt.disconnect();
            }
        }
    };
}