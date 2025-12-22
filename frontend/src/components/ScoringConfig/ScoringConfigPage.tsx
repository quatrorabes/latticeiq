import React, { useState } from 'react';
import { MDCPConfig } from './MDCPConfig';
import { BANTConfig } from './BANTConfig';
import { SPICEConfig } from './SPICEConfig';

type TabId = 'MDCP' | 'BANT' | 'SPICE';

export const ScoringConfigPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('MDCP');

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-gray-100">
          Scoring Configuration
        </h1>
        <p className="text-sm text-gray-400">
          Configure MDCP, BANT, and SPICE frameworks used for lead scoring.
        </p>
      </header>

      <nav className="flex gap-2 border-b border-gray-800 pb-2">
        {(['MDCP', 'BANT', 'SPICE'] as TabId[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-sm rounded-t ${
              activeTab === tab
                ? 'bg-gray-800 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main>
        {activeTab === 'MDCP' && <MDCPConfig />}
        {activeTab === 'BANT' && <BANTConfig />}
        {activeTab === 'SPICE' && <SPICEConfig />}
      </main>
    </div>
  );
};
