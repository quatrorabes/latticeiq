// frontend/src/pages/SettingsPage.tsx
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('userApiKey', apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-2">Manage your account and preferences</p>
        </div>

        {/* Account Section */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Account</h2>
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 block mb-2">Email</label>
              <p className="bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white">
                {user?.email || 'Loading...'}
              </p>
            </div>
            <div>
              <label className="text-gray-400 block mb-2">API Key (Optional)</label>
              <div className="flex gap-2">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded transition"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={handleSaveApiKey}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded transition"
                >
                  Save
                </button>
              </div>
              {saved && <p className="text-green-400 text-sm mt-2">✓ Saved!</p>}
            </div>
          </div>
        </div>

        {/* Workspace Section */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Workspace</h2>
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 block mb-2">Workspace Name</label>
              <input
                type="text"
                placeholder="Default Workspace"
                defaultValue="Default Workspace"
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-2">Default Vertical</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:border-cyan-500 focus:outline-none">
                <option>Technology</option>
                <option>SaaS</option>
                <option>Healthcare</option>
                <option>Finance</option>
                <option>Retail</option>
                <option>Other</option>
              </select>
            </div>
            <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded transition">
              Save Workspace
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-300 mb-4">Danger Zone</h2>
          <p className="text-gray-300 mb-4">Once you log out, you will need to sign in again to access your account.</p>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded transition font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
