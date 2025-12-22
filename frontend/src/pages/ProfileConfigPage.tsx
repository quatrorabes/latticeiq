// src/pages/ProfileConfigPage.tsx
import React, { useState } from 'react';
import CompanyProfile from '@/components/ProfileConfig/CompanyProfile';
import ICPDefinition from '@/components/ProfileConfig/ICPDefinition';
import MDCPConfiguration from '@/components/ProfileConfig/MDCPConfiguration';
import BANTConfiguration from '@/components/ProfileConfig/BANTConfiguration';
import SPICEConfiguration from '@/components/ProfileConfig/SPICEConfiguration';
import CustomFrameworks from '@/components/ProfileConfig/CustomFrameworks';
import FrameworkSettings from '@/components/ProfileConfig/FrameworkSettings';

const ProfileConfigPage: React.FC<{ profileId: string }> = ({ profileId }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [profile, setProfile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [icoData, setIcoData] = useState({});
  const [mdcpConfig, setMdcpConfig] = useState({});
  const [bantConfig, setBantConfig] = useState({});
  const [spiceConfig, setSpiceConfig] = useState({});
  const [frameworkSettings, setFrameworkSettings] = useState({});

  const tabs = [
    { label: 'Company Profile', component: CompanyProfile },
    { label: 'ICP Definition', component: ICPDefinition },
    { label: 'MDCP Configuration', component: MDCPConfiguration },
    { label: 'BANT Configuration', component: BANTConfiguration },
    { label: 'SPICE Configuration', component: SPICEConfiguration },
    { label: 'Custom Frameworks', component: CustomFrameworks },
    { label: 'Framework Settings', component: FrameworkSettings }
  ];

  const ActiveComponent = tabs[activeTab].component;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Scoring Configuration</h1>
      
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700 mb-6">
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            className={`px-4 py-2 font-medium text-sm transition ${
              activeTab === idx
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      <div className="bg-gray-900 p-6 rounded-lg border border-gray-700">
        <ActiveComponent
          profileId={profileId}
          data={[icoData, mdcpConfig, bantConfig, spiceConfig][activeTab - 1]}
          onSave={(data) => {
            setIsSaving(true);
            // Save to API
            setTimeout(() => setIsSaving(false), 1000);
          }}
        />
      </div>

      {/* Save Button (shown on all tabs) */}
      <div className="mt-6 flex gap-3 justify-end">
        <button
          className="px-6 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition"
        >
          Cancel
        </button>
        <button
          disabled={isSaving}
          className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 transition"
        >
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
};

export default ProfileConfigPage;
