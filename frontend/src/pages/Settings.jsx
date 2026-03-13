import { useState, useEffect } from 'react';
import { getSettings, saveSettings, testNotification, generateRegistrationOptions, verifyRegistration } from '../api';
import { startRegistration } from '@simplewebauthn/browser';
import toast from 'react-hot-toast';

export default function Settings() {
  const [settings, setSettings] = useState({
    student_name: '',
    exam_date: '',
    theme: 'dark'
  });
  const [loading, setLoading] = useState(true);
  const [originalLevel, setOriginalLevel] = useState(null);

  useEffect(() => {
    getSettings().then(res => {
      setSettings(res.data);
      setOriginalLevel(res.data.level);
      setLoading(false);
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (settings.level && settings.level !== originalLevel) {
      if (!window.confirm("WARNING: Changing your CA Level will instantly wipe all your current subjects, chapters, notes, and progress to load the new syllabus. Are you absolutely sure?")) {
        return;
      }
    }

    try {
      const { data } = await saveSettings(settings);
      toast.success("Settings saved successfully!", { icon: '⚙️' });
      if (data.reseeded) {
        toast.success("Syllabus fully updated to new level!", { icon: '🔄' });
        setOriginalLevel(settings.level);
      }
    } catch (err) {
      toast.error("Failed saving settings.");
    }
  };

  const handleTestEmail = async () => {
    toast.loading("Sending test email...", { id: 'email-test' });
    try {
      const res = await testNotification();
      toast.success(res.data.message || "Email delivered!", { id: 'email-test', icon: '📩' });
    } catch (err) {
      toast.error(err.response?.data?.error || "Email test failed. Did you configure the .env file?", { id: 'email-test' });
    }
  };

  if (loading) return <div className="text-center mt-20 animate-pulse text-[var(--border)]">Loading Settings...</div>;

  return (
    <div className="animate-fade-in space-y-6 max-w-2xl mx-auto mt-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">App Settings</h1>
        <p className="text-[var(--text-muted)] mt-1">Configure your revision profile.</p>
      </header>

      <form onSubmit={handleSave} className="card space-y-6">
        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Student Name</label>
          <input 
            type="text" 
            name="student_name"
            value={settings.student_name || ''}
            onChange={handleChange}
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Target Exam Date</label>
          <input 
            type="date" 
            name="exam_date"
            value={settings.exam_date || ''}
            onChange={handleChange}
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-[var(--text-muted)] focus:text-white focus:border-[var(--primary)] focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Current CA Level</label>
          <select 
            name="level"
            value={settings.level || 'foundation'}
            onChange={handleChange}
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-red-400 focus:outline-none transition-colors"
          >
            <option value="foundation">CA Foundation</option>
            <option value="inter">CA Intermediate</option>
            <option value="final">CA Final</option>
          </select>
          <p className="text-xs text-red-400 mt-2 font-medium">⚠️ Changing this will reset your entire progress and wipe all notes/chapters to load the new syllabus.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Theme Preferences</label>
          <select 
            name="theme"
            value={settings.theme || 'dark'}
            onChange={handleChange}
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none transition-colors"
          >
            <option value="dark">Dark Theme (Recommended)</option>
            <option value="light" disabled>Light Theme (Coming Soon)</option>
          </select>
        </div>

        <button type="submit" className="w-full btn-primary mt-6 py-3">
          Save Settings
        </button>
        <div className="card mt-6 p-6 border-dashed border-[var(--border)] border-2 text-center bg-[var(--surface-hover)]">
          <div className="flex flex-col items-center justify-center">
            <h3 className="text-xl font-bold mb-2 text-white">Email Study Reminders</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Daily morning updates are configured to go to: <br/> <span className="text-[var(--primary)] font-medium">{settings.user_email || "User"}</span>
            </p>
            <p className="text-xs text-[var(--text-muted)] italic mb-4 max-w-sm">Requires Nodemailer and valid Gmail App Passwords to be configured inside /backend/.env.</p>
            <button 
              type="button" 
              onClick={handleTestEmail} 
              className="btn-secondary whitespace-nowrap px-8 border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black mb-4"
            >
               Send Test Notification Now
            </button>
          </div>
        </div>

        <div className="card mt-6 p-6 border-dashed border-[var(--border)] border-2 text-center bg-black/20">
          <div className="flex flex-col items-center justify-center">
            <h3 className="text-xl font-bold mb-2 text-white">Account Information</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Logged in as: <span className="text-[var(--primary)] font-medium">{settings.user_email || "User"}</span>
            </p>
            <button 
              type="button" 
              onClick={() => {
                localStorage.removeItem('token');
                window.location.reload();
              }} 
              className="btn-secondary whitespace-nowrap px-8 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
            >
               Sign Out Securely
            </button>
          </div>
        </div>

        <div className="card mt-6 p-6 border-dashed border-[var(--border)] border-2 text-center bg-black/20">
          <div className="flex flex-col items-center justify-center">
            <h3 className="text-xl font-bold mb-2 text-white">Biometric Passkeys (WebAuthn)</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Register a Passkey (Touch ID, Face ID, or Security Key) to bypass passwords completely on next login.
            </p>
            <button 
              type="button" 
              onClick={async () => {
                try {
                  toast.loading("Setting up your passkey...", { id: 'passkey' });
                  const res = await generateRegistrationOptions();
                  const attResp = await startRegistration(res.data);
                  await verifyRegistration(attResp);
                  toast.success("Passkey registered successfully! You can now use it to sign in.", { id: 'passkey', icon: '🔑' });
                } catch (error) {
                  console.error(error);
                  toast.error(error.message || "Failed to register passkey.", { id: 'passkey' });
                }
              }}
              className="btn-primary whitespace-nowrap px-8"
            >
               Register Passkey
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
