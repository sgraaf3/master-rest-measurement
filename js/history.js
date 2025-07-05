const STORAGE_KEY = 'hrv_sessions';

export function saveSession(session) {
    const history = loadHistory();
    history.unshift(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 20))); // Keep last 20
}

export function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

export function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
}