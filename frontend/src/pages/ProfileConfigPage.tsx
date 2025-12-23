// frontend/src/pages/ProfileConfigPage.tsx
import { useState } from 'react';

export default function ProfileConfigPage() {
  const [activeTab, setActiveTab] = useState('company');

  const tabs = [
    { id: 'company', label: 'Company Profile' },
    { id: 'icp', label: 'ICP Definition' },
    { id: 'mdcp', label: 'MDCP Config' },
    { id: 'bant', label: 'BANT Config' },
    { id: 'spice', label: 'SPICE Config' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Profile Configuration</h1>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <div className="flex space-x-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 px-1 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-gray-800 rounded-lg p-6">
        <p className="text-gray-400">
          Configure your {tabs.find(t => t.id === activeTab)?.label} settings here.
        </p>
        <p className="text-gray-500 mt-4 text-sm">
          This feature is coming soon. Check back for scoring framework customization.
        </p>
      </div>
    </div>
  );
}
