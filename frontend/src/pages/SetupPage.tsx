import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface StepProps {
  onNext: () => void;
  onBack: () => void;
  isLastStep?: boolean;
}

// Step 1: ICP Definition
const ICPStep = ({ onNext }: StepProps) => {
  const [icp, setICP] = useState({
    industry: '',
    company_size: '',
    primary_use_case: '',
    typical_budget: '',
    pain_points: ['', '', ''],
  });

  const handleSave = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) return;

      // POST to backend
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v3/icp-config`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            industry: icp.industry,
            company_size: icp.company_size,
            primary_use_case: icp.primary_use_case,
            typical_budget: icp.typical_budget,
            pain_points: icp.pain_points.filter((p) => p.trim()),
          }),
        }
      );

      if (response.ok) {
        onNext();
      }
    } catch (error) {
      console.error('Failed to save ICP config:', error);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-100">Define Your ICP</h2>
      <p className="text-gray-400">Tell us about your ideal customer profile</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300">Industry</label>
          <input
            type="text"
            placeholder="e.g., SaaS, Finance, Insurance"
            value={icp.industry}
            onChange={(e) => setICP({ ...icp, industry: e.target.value })}
            className="w-full mt-2 px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Company Size</label>
          <select
            value={icp.company_size}
            onChange={(e) => setICP({ ...icp, company_size: e.target.value })}
            className="w-full mt-2 px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700"
          >
            <option value="">Select...</option>
            <option value="startup">Startup (1-50)</option>
            <option value="small">Small (50-250)</option>
            <option value="mid-market">Mid-Market (250-1000)</option>
            <option value="enterprise">Enterprise (1000+)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Primary Use Case</label>
          <input
            type="text"
            placeholder="What problem does your product solve?"
            value={icp.primary_use_case}
            onChange={(e) => setICP({ ...icp, primary_use_case: e.target.value })}
            className="w-full mt-2 px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Typical Budget</label>
          <input
            type="text"
            placeholder="e.g., $50K-$100K/year"
            value={icp.typical_budget}
            onChange={(e) => setICP({ ...icp, typical_budget: e.target.value })}
            className="w-full mt-2 px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Top 3 Pain Points</label>
          {icp.pain_points.map((pain, idx) => (
            <input
              key={idx}
              type="text"
              placeholder={`Pain point ${idx + 1}`}
              value={pain}
              onChange={(e) => {
                const newPains = [...icp.pain_points];
                newPains[idx] = e.target.value;
                setICP({ ...icp, pain_points: newPains });
              }}
              className="w-full mt-2 px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700"
            />
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="w-full px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg"
      >
        Next: Scoring Frameworks
      </button>
    </div>
  );
};

// Step 2: MDCP Configuration
const MDCPStep = ({ onNext, onBack }: StepProps) => {
  const [weights, setWeights] = useState({
    money: 25,
    decision_maker: 25,
    champion: 25,
    process: 25,
  });

  const handleSave = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) return;

      await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v3/scoring/mdcp-config`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            weights,
            thresholds: { hot: 75, warm: 50 },
          }),
        }
      );

      onNext();
    } catch (error) {
      console.error('Failed to save MDCP config:', error);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-100">Configure MDCP Scoring</h2>
      <p className="text-gray-400">Adjust weights for Money, Decision-maker, Champion, Process</p>

      <div className="space-y-4">
        {Object.entries(weights).map(([key, value]) => (
          <div key={key}>
            <div className="flex justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300 capitalize">
                {key.replace('_', ' ')}
              </label>
              <span className="text-teal-400 font-bold">{value}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={value}
              onChange={(e) => setWeights({ ...weights, [key]: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg"
        >
          Back
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg"
        >
          Next: BANT
        </button>
      </div>
    </div>
  );
};

// Step 3: BANT Configuration
const BANTStep = ({ onNext, onBack }: StepProps) => {
  const [weights, setWeights] = useState({
    budget: 25,
    authority: 25,
    need: 25,
    timeline: 25,
  });

  const handleSave = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) return;

      await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v3/scoring/bant-config`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            weights,
            thresholds: { hot: 75, warm: 50 },
          }),
        }
      );

      onNext();
    } catch (error) {
      console.error('Failed to save BANT config:', error);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-100">Configure BANT Scoring</h2>
      <p className="text-gray-400">Adjust weights for Budget, Authority, Need, Timeline</p>

      <div className="space-y-4">
        {Object.entries(weights).map(([key, value]) => (
          <div key={key}>
            <div className="flex justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300 capitalize">
                {key.replace('_', ' ')}
              </label>
              <span className="text-teal-400 font-bold">{value}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={value}
              onChange={(e) => setWeights({ ...weights, [key]: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg"
        >
          Back
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg"
        >
          Next: SPICE
        </button>
      </div>
    </div>
  );
};

// Step 4: SPICE Configuration
const SPICEStep = ({ onNext, onBack, isLastStep }: StepProps) => {
  const [weights, setWeights] = useState({
    situation: 20,
    problem: 20,
    implication: 20,
    consequence: 20,
    economics: 20,
  });

  const handleSave = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) return;

      await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v3/scoring/spice-config`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            weights,
            thresholds: { hot: 80, warm: 60 },
          }),
        }
      );

      onNext();
    } catch (error) {
      console.error('Failed to save SPICE config:', error);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-100">Configure SPICE Scoring</h2>
      <p className="text-gray-400">
        Adjust weights for Situation, Problem, Implication, Consequence, Economics
      </p>

      <div className="space-y-4">
        {Object.entries(weights).map(([key, value]) => (
          <div key={key}>
            <div className="flex justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300 capitalize">
                {key.replace('_', ' ')}
              </label>
              <span className="text-teal-400 font-bold">{value}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={value}
              onChange={(e) => setWeights({ ...weights, [key]: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg"
        >
          Back
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
        >
          {isLastStep ? 'Complete Setup' : 'Finish'}
        </button>
      </div>
    </div>
  );
};

// Main SetupPage Component
export default function SetupPage() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const steps = [
    { title: 'ICP Definition', component: ICPStep },
    { title: 'MDCP Scoring', component: MDCPStep },
    { title: 'BANT Scoring', component: BANTStep },
    { title: 'SPICE Scoring', component: SPICEStep },
  ];

  const CurrentStep = steps[step].component;

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      // Setup complete, redirect to contacts
      navigate('/contacts');
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-100 mb-2">LatticeIQ Setup</h1>
          <p className="text-gray-400">
            Step {step + 1} of {steps.length}: {steps[step].title}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-800 rounded-full h-2 mb-12">
          <div
            className="bg-teal-600 h-2 rounded-full transition-all"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Step Content */}
        <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
          <CurrentStep
            onNext={handleNext}
            onBack={handleBack}
            isLastStep={step === steps.length - 1}
          />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          You can update these settings anytime in your profile
        </div>
      </div>
    </div>
  );
}
