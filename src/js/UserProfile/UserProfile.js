const USER_PROFILE_KEY = 'userProfile';

/**
 * Loads the user profile from localStorage.
 * @returns {object} The user profile object, or an empty object if not found.
 */
export function loadUserProfile() {
    try {
        const profile = localStorage.getItem(USER_PROFILE_KEY);
        return profile ? JSON.parse(profile) : {};
    } catch (error) {
        console.error("Error loading user profile:", error);
        return {};
    }
}

/**
 * Saves the user profile to localStorage.
 * @param {object} profile - The user profile object to save.
 */
export function saveUserProfile(profile) {
    try {
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    } catch (error) {
        console.error("Error saving user profile:", error);
    }
}

/**
 * Updates the user profile with new data.
 * @param {object} newData - The new data to merge into the profile.
 */
export function updateUserProfile(newData) {
    const currentProfile = loadUserProfile();
    const updatedProfile = { ...currentProfile, ...newData };
    saveUserProfile(updatedProfile);
    return updatedProfile;
}

/**
 * Clears the user profile from localStorage.
 */
export function clearUserProfile() {
    try {
        localStorage.removeItem(USER_PROFILE_KEY);
        console.log("User profile cleared.");
    } catch (error) {
        console.error("Error clearing user profile:", error);
    }
}
