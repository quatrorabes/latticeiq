#!/usr/bin/env python3

import React from 'react';

interface ScoreDisplayProps {
	apexScore?: number;
	mdcScore?: number;
	bantScore?: number;
	spiceScore?: number;
	tier?: string;
	breakdown?: {
		[key: string]: number;
	};
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
	apexScore = 0,
	mdcScore = 0,
	bantScore = 0,
	spiceScore = 0,
	tier = 'Cold'
}) => {
	const getTierColor = (tierValue: string) => {
		const lowerTier = tierValue.toLowerCase();
		switch(lowerTier) {
			case 'hot': 
				return {
					bg: 'bg-red-950/40',
					text: 'text-red-500',
					border: 'border-red-500/30'
				};
			case 'warm': 
				return {
					bg: 'bg-yellow-950/40',
					text: 'text-yellow-500',
					border: 'border-yellow-500/30'
				};
			case 'cold': 
				return {
					bg: 'bg-blue-950/40',
					text: 'text-blue-500',
					border: 'border-blue-500/30'
				};
			default: 
				return {
					bg: 'bg-gray-950/40',
					text: 'text-gray-500',
					border: 'border-gray-500/30'
				};
		}
	};
	
	const ScoreCard = ({ label, score, description }: { label: string; score: number; description?: string }) => (
		<div className="flex-1 bg-secondary-bg rounded-base border border-border-primary p-3 hover:border-primary-400/50 transition-colors">
			<div className="flex justify-between items-center mb-2">
				<div className="text-xs text-text-secondary font-medium uppercase tracking-wide">{label}</div>
				{score > 0 && <div className="text-xs text-text-muted">+{score.toFixed(0)}</div>}
			</div>
			<div className="text-xl font-bold text-primary-400">{score.toFixed(0)}</div>
			{description && <div className="text-xs text-text-muted mt-1">{description}</div>}
		</div>
	);
	
	const tierColors = getTierColor(tier);
	const averageScore = (apexScore + mdcScore + bantScore + spiceScore) / 4;
	
	return (
		<div className="space-y-4">
			{/* Score Cards Grid */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-2">
				<ScoreCard 
					label="APEX" 
					score={apexScore}
					description="Affinity, Pain, eXec, eXpert"
				/>
				<ScoreCard 
					label="MDC" 
					score={mdcScore}
					description="Money, Decision, Champion"
				/>
				<ScoreCard 
					label="BANT" 
					score={bantScore}
					description="Budget, Authority, Need, Timeline"
				/>
				<ScoreCard 
					label="SPICE" 
					score={spiceScore}
					description="Situation, Problem, Implication..."
				/>
			</div>
		
			{/* Tier Badge and Average */}
			<div className={`${tierColors.bg} border ${tierColors.border} rounded-base p-4 text-center`}>
				<div className="text-sm text-text-secondary mb-1">Lead Quality Tier</div>
				<div className={`text-3xl font-bold ${tierColors.text} mb-2`}>{tier}</div>
				<div className="text-sm text-text-muted">Average Score: {averageScore.toFixed(0)}/100</div>
			</div>
		
			{/* Score Distribution Bar */}
			<div className="bg-secondary-bg rounded-base border border-border-primary p-3">
				<div className="text-xs text-text-secondary mb-2 font-medium">Score Distribution</div>
				<div className="flex h-2 gap-1 rounded overflow-hidden">
					<div className="flex-1 bg-blue-600/50" style={{width: `${apexScore}%`}} title={`APEX: ${apexScore}`} />
					<div className="flex-1 bg-green-600/50" style={{width: `${mdcScore}%`}} title={`MDC: ${mdcScore}`} />
					<div className="flex-1 bg-yellow-600/50" style={{width: `${bantScore}%`}} title={`BANT: ${bantScore}`} />
					<div className="flex-1 bg-purple-600/50" style={{width: `${spiceScore}%`}} title={`SPICE: ${spiceScore}`} />
				</div>
				<div className="grid grid-cols-4 gap-2 mt-3 text-xs">
					<div className="flex items-center gap-1">
						<div className="w-2 h-2 rounded-full bg-blue-600" />
						<span className="text-text-muted">APEX</span>
					</div>
					<div className="flex items-center gap-1">
						<div className="w-2 h-2 rounded-full bg-green-600" />
						<span className="text-text-muted">MDC</span>
					</div>
					<div className="flex items-center gap-1">
						<div className="w-2 h-2 rounded-full bg-yellow-600" />
						<span className="text-text-muted">BANT</span>
					</div>
					<div className="flex items-center gap-1">
						<div className="w-2 h-2 rounded-full bg-purple-600" />
						<span className="text-text-muted">SPICE</span>
					</div>
				</div>
			</div>
		</div>
	);
};
