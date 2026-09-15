export const PROFILE_PREFERENCES_KEY = 'smartdoc:profile-preferences';

export const DEFAULT_PROFILE_PREFERENCES = {
  theme: 'system',
  language: 'English',
  compactMode: false,
  reduceMotion: false,
  studyReminders: true,
};

export function readProfilePreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_PREFERENCES_KEY) || 'null');
    return { ...DEFAULT_PROFILE_PREFERENCES, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    return { ...DEFAULT_PROFILE_PREFERENCES };
  }
}

export function applyProfilePreferences(preferences) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const theme = preferences.theme === 'system'
    ? (prefersDark ? 'dark' : 'light')
    : preferences.theme;

  root.dataset.smartdocTheme = theme;
  root.dataset.smartdocCompact = preferences.compactMode ? 'true' : 'false';
  root.dataset.smartdocReduceMotion = preferences.reduceMotion ? 'true' : 'false';
}
