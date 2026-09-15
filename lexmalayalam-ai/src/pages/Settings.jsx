import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiMonitor, FiMoon, FiSun } from 'react-icons/fi';
import { applyProfilePreferences, readProfilePreferences } from '../utils/profilePreferences';
import './Settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState(readProfilePreferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    applyProfilePreferences(preferences);
    localStorage.setItem('smartdoc:profile-preferences', JSON.stringify(preferences));
    if (preferences.theme !== 'system' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => applyProfilePreferences(preferences);
    media.addEventListener?.('change', syncSystemTheme);
    return () => media.removeEventListener?.('change', syncSystemTheme);
  }, [preferences]);

  const update = (key, value) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    localStorage.setItem('smartdoc:profile-preferences', JSON.stringify(preferences));
    applyProfilePreferences(preferences);
    setSaved(true);
  };

  return (
    <main className="sd-settings-page">
      <div className="sd-settings-shell">
        <header className="sd-settings-header">
          <button type="button" className="sd-settings-back" onClick={() => navigate('/profile')} aria-label="Back to profile"><FiArrowLeft /></button>
          <div><span className="sd-settings-eyebrow">PERSONALIZE</span><h1>Settings</h1><p>Make SmartDoc feel right for your study routine.</p></div>
        </header>

        <section className="sd-settings-card">
          <div className="sd-settings-card-heading"><FiMonitor /><div><h2>Appearance</h2><p>Choose how SmartDoc looks on this device.</p></div></div>
          <div className="sd-theme-options" role="group" aria-label="Color theme">
            {[{ value: 'light', label: 'Light', Icon: FiSun }, { value: 'dark', label: 'Dark', Icon: FiMoon }, { value: 'system', label: 'System', Icon: FiMonitor }].map(({ value, label, Icon }) => (
              <button type="button" key={value} className={`sd-theme-option${preferences.theme === value ? ' selected' : ''}`} aria-pressed={preferences.theme === value} onClick={() => update('theme', value)}>
                <Icon /><span>{label}</span>{preferences.theme === value && <FiCheck className="sd-theme-check" />}
              </button>
            ))}
          </div>
          <SettingsToggle label="Compact display" description="Use tighter spacing where supported." checked={preferences.compactMode} onChange={(value) => update('compactMode', value)} />
          <SettingsToggle label="Reduce motion" description="Reduce non-essential interface animations." checked={preferences.reduceMotion} onChange={(value) => update('reduceMotion', value)} />
        </section>

        <section className="sd-settings-card">
          <div className="sd-settings-card-heading"><span className="sd-settings-language-icon">文</span><div><h2>Language</h2><p>Choose your preferred language.</p></div></div>
          <label className="sd-settings-field">Preferred language
            <select value={preferences.language} onChange={(event) => update('language', event.target.value)}>
              <option>English</option>
              <option>Malayalam</option>
            </select>
          </label>
          <p className="sd-settings-note">Your preference is saved on this device. Some parts of SmartDoc may remain in English until full translations are available.</p>
        </section>

        <section className="sd-settings-card">
          <div className="sd-settings-card-heading"><span className="sd-settings-reminder-icon">✓</span><div><h2>Study preferences</h2><p>Keep your study workflow comfortable.</p></div></div>
          <SettingsToggle label="Study reminder preference" description="Save your preference for future reminder features. No background reminders are scheduled by this setting." checked={preferences.studyReminders} onChange={(value) => update('studyReminders', value)} />
        </section>

        <div className="sd-settings-save-row">
          <p role="status">{saved ? 'Settings saved on this device.' : 'Changes save locally on this device.'}</p>
          <button type="button" className="sd-settings-save" onClick={save}>Save settings</button>
        </div>
      </div>
    </main>
  );
}

function SettingsToggle({ label, description, checked, onChange }) {
  return (
    <label className="sd-settings-toggle">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="sd-settings-switch" aria-hidden="true" />
    </label>
  );
}
