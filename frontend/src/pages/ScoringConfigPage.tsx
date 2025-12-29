// frontend/src/pages/ScoringConfigPage.tsx

import React, { useState } from 'react';
import MDCPConfig from '../components/ScoringConfig/MDCPConfig';
import BANTConfig from '../components/ScoringConfig/BANTConfig';
import SPICEConfig from '../components/ScoringConfig/SPICEConfig';

type ConfigTab = 'mdcp' | 'bant' | 'spice';

export const ScoringConfigPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('mdcp');

  const tabs: Array<{ id: ConfigTab; label: string; icon: string }> = [
    { id: 'mdcp', label: 'MDCP', icon: '🎯' },
    { id: 'bant', label: 'BANT', icon: '📊' },
    { id: 'spice', label: 'SPICE', icon: '🌶️' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Scoring Configuration
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Customize how leads are qualified and prioritized. Set weights and thresholds for each framework.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="rounded-lg">
          {activeTab === 'mdcp' && <MDCPConfig />}
          {activeTab === 'bant' && <BANTConfig />}
          {activeTab === 'spice' && <SPICEConfig />}
        </div>

        {/* Framework Guide */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">MDCP</h3>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Money, Decision-maker, Champion, Process. Best for straightforward enterprise sales with clear budget and decision-makers.
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-2">BANT</h3>
            <p className="text-sm text-green-800 dark:text-green-300">
              Budget, Authority, Need, Timeline. Industry standard for enterprise sales qualification with detailed criteria.
            </p>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-lg border border-orange-200 dark:border-orange-800">
            <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-200 mb-2">SPICE</h3>
            <p className="text-sm text-orange-800 dark:text-orange-300">
              Situation, Problem, Implication, Consequence, Economic. Best for complex solutions with multiple stakeholders.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoringConfigPage;
