// frontend/src/pages/ScoringConfigPage.tsx
import { useState } from 'react';
import { ChevronDown, Info, TrendingUp, Copy, Check } from 'lucide-react';

interface ScoringFramework {
  id: 'mdcp' | 'bant' | 'spice';
  name: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  dimensions: ScoringDimension[];
  hotThreshold: number;
  warmThreshold: number;
}

interface ScoringDimension {
  key: string;
  name: string;
  description: string;
  points: number;
  importance: 'high' | 'medium' | 'low';
}

const FRAMEWORKS: Record<string, ScoringFramework> = {
  mdcp: {
    id: 'mdcp',
    name: 'MDCP',
    title: 'Money • Decision-Maker • Champion • Process',
    description: 'Enterprise sales qualification framework focusing on budget authority, decision-making power, internal advocacy, and deal timing.',
    color: 'from-blue-600 to-cyan-600',
    icon: '💰',
    dimensions: [
      {
        key: 'money',
        name: 'Money (Budget)',
        description: 'Company has sufficient budget to purchase your solution',
        points: 25,
        importance: 'high',
      },
      {
        key: 'decision_maker',
        name: 'Decision-Maker',
        description: 'Contact has authority to make purchase decisions',
        points: 25,
        importance: 'high',
      },
      {
        key: 'champion',
        name: 'Champion (Advocate)',
        description: 'Contact who will advocate internally and drive adoption',
        points: 25,
        importance: 'high',
      },
      {
        key: 'process',
        name: 'Process (Timeline)',
        description: 'Active deal cycle within 30-60 days',
        points: 25,
        importance: 'high',
      },
    ],
    hotThreshold: 80,
    warmThreshold: 60,
  },
  bant: {
    id: 'bant',
    name: 'BANT',
    title: 'Budget • Authority • Need • Timeline',
    description: 'Salesforce-proven framework for qualifying enterprise deals. Focus on budget, decision authority, pain point identification, and buying urgency.',
    color: 'from-orange-600 to-amber-600',
    icon: '📊',
    dimensions: [
      {
        key: 'budget',
        name: 'Budget',
        description: 'Company has allocated budget for this solution',
        points: 25,
        importance: 'high',
      },
      {
        key: 'authority',
        name: 'Authority',
        description: 'Contact has decision-making authority',
        points: 25,
        importance: 'high',
      },
      {
        key: 'need',
        name: 'Need (Pain Point)',
        description: 'Clear identification of problem you solve',
        points: 25,
        importance: 'high',
      },
      {
        key: 'timeline',
        name: 'Timeline',
        description: 'Urgency signals indicating near-term buying window',
        points: 25,
        importance: 'high',
      },
    ],
    hotThreshold: 80,
    warmThreshold: 60,
  },
  spice: {
    id: 'spice',
    name: 'SPICE',
    title: 'Situation • Problem • Implication • Consequence • Economics',
    description: 'Consultative selling framework emphasizing deep discovery. Focus on understanding context, problems, business impact, risk, and ROI.',
    color: 'from-purple-600 to-pink-600',
    icon: '🎯',
    dimensions: [
      {
        key: 'situation',
        name: 'Situation',
        description: 'Understanding company context and current state',
        points: 20,
        importance: 'high',
      },
      {
        key: 'problem',
        name: 'Problem',
        description: 'Identified specific challenges and pain points',
        points: 20,
        importance: 'high',
      },
      {
        key: 'implication',
        name: 'Implication',
        description: 'Understood business impact of problems',
        points: 20,
        importance: 'high',
      },
      {
        key: 'consequence',
        name: 'Consequence',
        description: 'Risk and costs of inaction quantified',
        points: 20,
        importance: 'medium',
      },
      {
        key: 'economics',
        name: 'Economics (ROI)',
        description: 'Financial impact and ROI documented',
        points: 20,
        importance: 'medium',
      },
    ],
    hotThreshold: 85,
    warmThreshold: 65,
  },
};

export default function ScoringConfigPage() {
  const [selectedFramework, setSelectedFramework] = useState<'mdcp' | 'bant' | 'spice'>('mdcp');
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const framework = FRAMEWORKS[selectedFramework];

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Lead Scoring Frameworks</h1>
          <p className="text-gray-400">
            Master three proven qualification methodologies. Choose the right framework for your sales process.
          </p>
        </div>

        {/* Framework Selector */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {Object.values(FRAMEWORKS).map((fw) => (
            <button
              key={fw.id}
              onClick={() => setSelectedFramework(fw.id)}
              className={`p-6 rounded-lg border-2 transition-all ${
                selectedFramework === fw.id
                  ? 'border-cyan-500 bg-gray-900'
                  : 'border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="text-3xl mb-2">{fw.icon}</div>
              <h3 className="text-lg font-semibold mb-1">{fw.name}</h3>
              <p className="text-xs text-gray-400">{fw.title}</p>
            </button>
          ))}
        </div>

        {/* Framework Details */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 mb-8">
          {/* Title & Description */}
          <div className="mb-8">
            <div className={`inline-block text-3xl mb-3 px-4 py-2 rounded-lg bg-gradient-to-r ${framework.color} bg-clip-text text-transparent`}>
              {framework.name}
            </div>
            <h2 className="text-2xl font-bold mb-3">{framework.title}</h2>
            <p className="text-gray-400 leading-relaxed max-w-2xl">
              {framework.description}
            </p>
          </div>

          {/* Scoring Threshold Guide */}
          <div className="mb-8 p-4 bg-gray-800 border border-gray-700 rounded-lg">
            <div className="flex items-start gap-3 mb-4">
              <TrendingUp size={20} className="text-cyan-400 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold mb-3">Qualification Thresholds</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-green-900 bg-opacity-30 border border-green-700 rounded">
                    <p className="text-sm text-green-300 font-medium">🔥 Hot Lead</p>
                    <p className="text-xs text-green-400 mt-1">
                      Score of <strong>{framework.hotThreshold}+</strong> points
                    </p>
                    <p className="text-xs text-green-400 mt-1">
                      Strong fit, ready to engage immediately
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded">
                    <p className="text-sm text-yellow-300 font-medium">⚡ Warm Lead</p>
                    <p className="text-xs text-yellow-400 mt-1">
                      Score of <strong>{framework.warmThreshold}–{framework.hotThreshold - 1}</strong> points
                    </p>
                    <p className="text-xs text-yellow-400 mt-1">
                      Potential fit, needs more information
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dimensions */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Info size={18} className="text-cyan-400" />
              Scoring Dimensions
            </h3>
            <div className="space-y-3">
              {framework.dimensions.map((dimension, idx) => (
                <div
                  key={dimension.key}
                  className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition"
                >
                  {/* Header */}
                  <button
                    onClick={() =>
                      setExpandedDimension(
                        expandedDimension === dimension.key ? null : dimension.key
                      )
                    }
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-750 transition"
                  >
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-semibold">{dimension.name}</h4>
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-1 bg-cyan-900 text-cyan-300 rounded text-xs font-medium">
                            +{dimension.points} pts
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              dimension.importance === 'high'
                                ? 'bg-red-900 text-red-300'
                                : dimension.importance === 'medium'
                                ? 'bg-yellow-900 text-yellow-300'
                                : 'bg-gray-700 text-gray-300'
                            }`}
                          >
                            {dimension.importance.charAt(0).toUpperCase() + dimension.importance.slice(1)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400">{dimension.description}</p>
                    </div>
                    <ChevronDown
                      size={20}
                      className={`text-gray-400 transition-transform ${
                        expandedDimension === dimension.key ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Expanded Content */}
                  {expandedDimension === dimension.key && (
                    <div className="px-4 py-4 border-t border-gray-700 bg-gray-750">
                      <div className="space-y-4">
                        {/* Scoring Examples */}
                        <div>
                          <p className="text-sm font-semibold text-cyan-400 mb-2">✓ Examples of full points:</p>
                          <ul className="text-sm text-gray-300 space-y-1 pl-4">
                            {getExamples(framework.id, dimension.key).map((example, i) => (
                              <li key={i} className="list-disc">{example}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Partial Points */}
                        <div>
                          <p className="text-sm font-semibold text-yellow-400 mb-2">◐ Partial points awarded for:</p>
                          <ul className="text-sm text-gray-300 space-y-1 pl-4">
                            {getPartialExamples(framework.id, dimension.key).map((example, i) => (
                              <li key={i} className="list-disc">{example}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Use Case Recommendations */}
          <div className="mb-8 p-4 bg-gray-800 border border-gray-700 rounded-lg">
            <h3 className="font-semibold mb-3">Best For:</h3>
            <p className="text-sm text-gray-300 mb-3">
              {getUseCaseRecommendation(framework.id)}
            </p>
            <div className="flex gap-2 flex-wrap">
              {getUseCases(framework.id).map((useCase, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-xs font-medium"
                >
                  {useCase}
                </span>
              ))}
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg text-left flex items-center justify-between transition"
          >
            <span className="font-semibold text-sm">Advanced Configuration</span>
            <ChevronDown
              size={18}
              className={`text-gray-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            />
          </button>

          {showAdvanced && (
            <div className="mt-4 p-4 bg-gray-800 border border-gray-700 rounded-lg space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-300 block mb-2">
                  Hot Lead Threshold
                </label>
                <input
                  type="number"
                  defaultValue={framework.hotThreshold}
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leads scoring {framework.hotThreshold}+ points are marked as hot
                </p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-300 block mb-2">
                  Warm Lead Threshold
                </label>
                <input
                  type="number"
                  defaultValue={framework.warmThreshold}
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leads scoring {framework.warmThreshold}–{framework.hotThreshold - 1} points are marked as warm
                </p>
              </div>
              <button className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-medium transition">
                Save Configuration
              </button>
            </div>
          )}
        </div>

        {/* Framework Comparison */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Framework Comparison</h2>
          <div className="overflow-x-auto border border-gray-800 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Aspect</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">MDCP</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">BANT</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">SPICE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                <tr className="hover:bg-gray-900 transition">
                  <td className="px-4 py-3 text-sm font-medium text-gray-300">Sales Methodology</td>
                  <td className="px-4 py-3 text-sm text-gray-400">Enterprise Account-Based</td>
                  <td className="px-4 py-3 text-sm text-gray-400">Salesforce Traditional</td>
                  <td className="px-4 py-3 text-sm text-gray-400">Consultative Selling</td>
                </tr>
                <tr className="hover:bg-gray-900 transition">
                  <td className="px-4 py-3 text-sm font-medium text-gray-300">Deal Complexity</td>
                  <td className="px-4 py-3 text-sm text-gray-400">High (5+ stakeholders)</td>
                  <td className="px-4 py-3 text-sm text-gray-400">Medium (2-4 stakeholders)</td>
                  <td className="px-4 py-3 text-sm text-gray-400">Complex (Discovery-heavy)</td>
                </tr>
                <tr className="hover:bg-gray-900 transition">
                  <td className="px-4 py-3 text-sm font-medium text-gray-300">Focus Area</td>
                  <td className="px-4 py-3 text-sm text-gray-400">Internal advocacy & process</td>
                  <td className="px-4 py-3 text-sm text-gray-400">Basic deal criteria</td>
                  <td className="px-4 py-3 text-sm text-gray-400">Understanding problems & ROI</td>
                </tr>
                <tr className="hover:bg-gray-900 transition">
                  <td className="px-4 py-3 text-sm font-medium text-gray-300">Sales Cycle</td>
                  <td className="px-4 py-3 text-sm text-gray-400">90+ days</td>
                  <td className="px-4 py-3 text-sm text-gray-400">30-60 days</td>
                  <td className="px-4 py-3 text-sm text-gray-400">45-90 days (research)</td>
                </tr>
                <tr className="hover:bg-gray-900 transition">
                  <td className="px-4 py-3 text-sm font-medium text-gray-300">Best For</td>
                  <td className="px-4 py-3 text-sm text-gray-400">SaaS B2B, Enterprise</td>
                  <td className="px-4 py-3 text-sm text-gray-400">Mid-market, Quick cycles</td>
                  <td className="px-4 py-3 text-sm text-gray-400">Consulting, Custom solutions</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Implementation Guide */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Implementation Guide</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-1">Select Your Framework</h3>
                <p className="text-sm text-gray-400">
                  Choose MDCP for enterprise, BANT for mid-market, or SPICE for consultative selling
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-1">Configure Thresholds</h3>
                <p className="text-sm text-gray-400">
                  Set hot lead and warm lead thresholds based on your sales targets
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-1">Train Your Team</h3>
                <p className="text-sm text-gray-400">
                  Use the scoring guide to train sales team on dimension assessment
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                4
              </div>
              <div>
                <h3 className="font-semibold mb-1">Apply & Iterate</h3>
                <p className="text-sm text-gray-400">
                  Score all contacts and refine thresholds based on win/loss data
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Functions
function getExamples(framework: string, dimension: string): string[] {
  const examples: Record<string, Record<string, string[]>> = {
    mdcp: {
      money: [
        'VP of Finance confirmed budget is allocated for this category',
        'Company just closed funding round',
        'Budget holder included in sales conversation',
      ],
      decision_maker: [
        'Contact is C-level executive or VP with authority',
        'Decision-making power confirmed via org chart',
        'Contact signs contracts or has expense approval',
      ],
      champion: [
        'Contact advocates in internal meetings',
        'Contact introduced you to other stakeholders',
        'Contact attended multiple demos and engaged questions',
      ],
      process: [
        'Deal in active stage (not discovery)',
        'Implementation timeline discussed',
        'RFP issued or contract under negotiation',
      ],
    },
    bant: {
      budget: [
        'Budget allocated and confirmed by finance',
        'Owner of budget included in conversation',
        'Pricing discussion moved forward',
      ],
      authority: [
        'Contact can sign contracts',
        'Contact has veto power or final say',
        'Decision committee includes this contact',
      ],
      need: [
        'Contact articulated specific problem you solve',
        'Current pain point quantified (cost, time, risk)',
        'Acknowledged better solution needed',
      ],
      timeline: [
        'Budget needs to be spent before end of quarter',
        'Implementation deadline discussed',
        'Competitor evaluations happening now',
      ],
    },
    spice: {
      situation: [
        'Company context, size, industry fully understood',
        'Current tools and systems documented',
        'Organizational structure mapped',
      ],
      problem: [
        'Specific pain points documented',
        'Current workarounds identified',
        'Multiple people confirmed same problems',
      ],
      implication: [
        'Business impact of problems quantified',
        'Effect on revenue or efficiency discussed',
        'Strategic initiatives affected identified',
      ],
      consequence: [
        'Cost of inaction calculated',
        'Opportunity cost identified',
        'Risk of staying with current state assessed',
      ],
      economics: [
        'ROI or payback period calculated',
        'Financial impact of solution presented',
        'Deal value and terms agreed',
      ],
    },
  };
  return examples[framework]?.[dimension] || [];
}

function getPartialExamples(framework: string, dimension: string): string[] {
  const examples: Record<string, Record<string, string[]>> = {
    mdcp: {
      money: ['Budget mentioned but not confirmed', 'Rough budget estimate provided'],
      decision_maker: ['Contact reports to decision-maker', 'Part of approval committee'],
      champion: ['Contact showed interest', 'Contact shared insights informally'],
      process: ['Early-stage conversations ongoing', 'RFI (Request for Information) issued'],
    },
    bant: {
      budget: ['Budget likely exists but not confirmed', 'Budget year not specified'],
      authority: ['Contact influences decision', 'Needs approval from manager'],
      need: ['Problem acknowledged but vague', 'Nice-to-have rather than must-have'],
      timeline: ['Considering for next year', 'Evaluation phase ongoing'],
    },
    spice: {
      situation: ['Basic company info known', 'Some organizational knowledge'],
      problem: ['One problem identified', 'Needs more investigation'],
      implication: ['General business impact understood', 'Department-level impact only'],
      consequence: ['Rough estimate of inaction cost', 'Partial consequence mapping'],
      economics: ['Preliminary ROI discussed', 'Pricing range explored'],
    },
  };
  return examples[framework]?.[dimension] || [];
}

function getUseCaseRecommendation(framework: string): string {
  const recommendations: Record<string, string> = {
    mdcp: 'Enterprise SaaS companies with long sales cycles, multiple stakeholders, and high deal values. Ideal when you need to map internal champions and track deal progression.',
    bant: 'Fast-moving sales organizations selling mid-market solutions. Best when you need a quick qualification check before investing heavy sales effort.',
    spice: 'Consulting firms, custom software solutions, and complex B2B services. Essential when success depends on deep customer understanding and problem-solving.',
  };
  return recommendations[framework] || '';
}

function getUseCases(framework: string): string[] {
  const useCases: Record<string, string[]> = {
    mdcp: ['Enterprise SaaS', 'Account-Based Sales', 'Multi-year Deals', 'High ACV'],
    bant: ['Mid-Market Sales', 'Quick Cycles', 'Clear Criteria', 'Transactional'],
    spice: ['Consulting', 'Custom Solutions', 'Complex Deals', 'Discovery-Heavy'],
  };
  return useCases[framework] || [];
}
