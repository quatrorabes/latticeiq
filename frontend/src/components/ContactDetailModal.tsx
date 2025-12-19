#!/usr/bin/env python3

// frontend/src/components/ContactDetailModal.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface EnrichmentData {
	apex_score?: number;
	bant_budget?: string;
	bant_authority?: string;
	bant_need?: string;
	bant_timing?: string;
	enrichment_status?: string;
	enrichment_data?: {
		synthesized?: Record<string, any>;
		raw_results?: Record<string, any>;
		queries_executed?: number;
	};
	enriched_at?: string;
}

interface Contact {
	id: number;
	firstname?: string;
	lastname?: string;
	email?: string;
	company?: string;
	title?: string;  // ← FIXED: optional
	apex_score?: number;
	enrichment_data?: any;
	enrichment_status?: string;
}

interface ContactDetailModalProps {
	contact: Contact | null;
	isOpen: boolean;
	onClose: () => void;
}

export const ContactDetailModal: React.FC<ContactDetailModalProps> = ({
	contact,
	isOpen,
	onClose,
}) => {
	const [enrichmentData, setEnrichmentData] = useState<EnrichmentData | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	
	useEffect(() => {
		if (isOpen && contact) {
			fetchEnrichmentData();
		}
	}, [isOpen, contact]);
	
	const fetchEnrichmentData = async () => {
		if (!contact) return;
		
		setLoading(true);
		setError(null);
		
		try {
			const { data, error } = await supabase
				.from('contacts')
				.select('*')
				.eq('id', contact.id)
				.single();
			
			if (error) throw error;
			
			setEnrichmentData({
				apex_score: data.apex_score,
				bant_budget: data.bant_budget,
				bant_authority: data.bant_authority,
				bant_need: data.bant_need,
				bant_timing: data.bant_timing,
				enrichment_status: data.enrichment_status,
				enrichment_data: data.enrichment_data,
				enriched_at: data.enriched_at,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch enrichment data');
		} finally {
			setLoading(false);
		}
	};
	
	if (!isOpen || !contact) return null;
	
	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
			<div className="bg-gray-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
				{/* Header */}
				<div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-start">
					<div>
						<h2 className="text-2xl font-bold text-white">
							{contact.firstname} {contact.lastname}
						</h2>
						<p className="text-gray-400 text-sm mt-1">{contact.email}</p>
					</div>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-white text-2xl"
					>
						×
					</button>
				</div>
		
				{/* Content */}
				<div className="p-6 space-y-6">
					{/* Basic Info */}
					<div className="grid grid-cols-2 gap-4 bg-gray-800 p-4 rounded">
						<div>
							<label className="text-xs text-gray-400 uppercase">Company</label>
							<p className="text-white font-semibold">{contact.company || '—'}</p>
						</div>
						<div>
							<label className="text-xs text-gray-400 uppercase">Title</label>
							<p className="text-white font-semibold">{contact.title || '—'}</p>
						</div>
					</div>
		
					{loading ? (
						<div className="text-center py-8">
							<div className="inline-block animate-spin">⚙️</div>
							<p className="text-gray-400 mt-2">Loading enrichment data...</p>
						</div>
					) : error ? (
						<div className="bg-red-900 bg-opacity-20 border border-red-500 text-red-200 p-4 rounded">
							{error}
						</div>
					) : enrichmentData ? (
						<>
							{/* APEX Score */}
							{enrichmentData.apex_score !== undefined && (
								<div className="bg-purple-900 bg-opacity-20 border border-purple-500 p-4 rounded">
									<h3 className="text-lg font-semibold text-purple-300 mb-2">
										APEX Score
									</h3>
									<div className="text-4xl font-bold text-purple-400">
										{enrichmentData.apex_score}
									</div>
									<p className="text-sm text-gray-400 mt-2">
										Sales readiness score (0-100)
									</p>
								</div>
							)}
						
							{/* BANT Breakdown */}
							{(enrichmentData.bant_budget ||
								enrichmentData.bant_authority ||
								enrichmentData.bant_need ||
								enrichmentData.bant_timing) && (
								<div className="bg-blue-900 bg-opacity-20 border border-blue-500 p-4 rounded">
									<h3 className="text-lg font-semibold text-blue-300 mb-4">
										BANT Analysis
									</h3>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="text-sm text-gray-400">Budget</label>
											<p className="text-white font-semibold">
												{enrichmentData.bant_budget || '—'}
											</p>
										</div>
										<div>
											<label className="text-sm text-gray-400">Authority</label>
											<p className="text-white font-semibold">
												{enrichmentData.bant_authority || '—'}
											</p>
										</div>
										<div>
											<label className="text-sm text-gray-400">Need</label>
											<p className="text-white font-semibold">
												{enrichmentData.bant_need || '—'}
											</p>
										</div>
										<div>
											<label className="text-sm text-gray-400">Timing</label>
											<p className="text-white font-semibold">
												{enrichmentData.bant_timing || '—'}
											</p>
										</div>
									</div>
								</div>
							)}
						
							{/* Synthesized Profile */}
							{enrichmentData.enrichment_data?.synthesized && (
								<div className="bg-green-900 bg-opacity-20 border border-green-500 p-4 rounded">
									<h3 className="text-lg font-semibold text-green-300 mb-4">
										AI-Synthesized Profile
									</h3>
									<pre className="bg-gray-800 p-4 rounded text-xs text-gray-300 overflow-x-auto">
										{JSON.stringify(
											enrichmentData.enrichment_data.synthesized,
											null,
											2
										)}
									</pre>
								</div>
							)}
						
							{/* Raw Query Results */}
							{enrichmentData.enrichment_data?.raw_results && (
								<div className="bg-gray-800 border border-gray-600 p-4 rounded">
									<h3 className="text-lg font-semibold text-gray-200 mb-4">
										Raw Enrichment Data
									</h3>
									<div className="space-y-4">
										{Object.entries(
											enrichmentData.enrichment_data.raw_results
										).map(([domain, result]: [string, any]) => (
											<div key={domain} className="bg-gray-700 p-3 rounded">
												<h4 className="font-semibold text-gray-300 text-sm mb-2">
													{domain}
												</h4>
												<p className="text-xs text-gray-400 mb-2">
													Status: <span className={result.success ? 'text-green-400' : 'text-red-400'}>
														{result.success ? '✓ Success' : '✗ Failed'}
													</span>
													{' | '}
													Latency: {result.latency_ms}ms
												</p>
												<pre className="bg-gray-800 p-2 rounded text-xs text-gray-300 overflow-x-auto max-h-40">
													{result.content || 'No content'}
												</pre>
											</div>
										))}
									</div>
								</div>
							)}
						
							{/* Metadata */}
							<div className="text-xs text-gray-500 pt-4 border-t border-gray-700">
								<p>Status: {enrichmentData.enrichment_status}</p>
								<p>Enriched: {enrichmentData.enriched_at || 'Not enriched'}</p>
								<p>
									Queries: {enrichmentData.enrichment_data?.queries_executed || 0}
								</p>
							</div>
						</>
					) : (
						<div className="text-center py-8 text-gray-400">
							No enrichment data available
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
