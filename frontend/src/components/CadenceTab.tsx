import React, { useState, useEffect } from 'react';
import {
  Play, Pause, Square, CheckCircle, Clock, Mail, Phone, Linkedin,
  Calendar, AlertCircle, RefreshCw, ChevronRight, MessageSquare,
  Zap, Target, TrendingUp
} from 'lucide-react';
import {
  getCadenceTypes, getContactCadence, startCadence, stopCadence,
  pauseCadence, resumeCadence, completeTouch, getActivities,
  CadenceType, Cadence, Touch, Activity
} from '../api/cadences';


interface CadenceTabProps {
  contactId: string;
  contactName: string;
  onUpdate?: () => void;
}


export const CadenceTab: React.FC<CadenceTabProps> = ({ contactId, contactName, onUpdate }) => {
  const [cadenceTypes, setCadenceTypes] = useState<Record<string, CadenceType>>({});
  const [activeCadence, setActiveCadence] = useState<Cadence | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [selectedType, setSelectedType] = useState('standard');
  const [error, setError] = useState<string | null>(null);
  const [completingTouch, setCompletingTouch] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState<string | null>(null);
  const [touchNotes, setTouchNotes] = useState('');
  const [responseReceived, setResponseReceived] = useState(false);

  useEffect(() => {
    loadData();
  }, [contactId]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [types, cadenceData, activityData] = await Promise.all([
        getCadenceTypes(),
        getContactCadence(contactId),
        getActivities(contactId, 20)
      ]);
      setCadenceTypes(types);
      setActiveCadence(cadenceData.cadence);
      setActivities(activityData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCadence = async () => {
    setIsStarting(true);
    setError(null);
    try {
      await startCadence(contactId, selectedType);
      await loadData();
      onUpdate?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopCadence = async () => {
    if (!confirm(`Stop the cadence for ${contactName}? This will cancel all pending touches.`)) return;
    try {
      await stopCadence(contactId);
      await loadData();
      onUpdate?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePauseCadence = async () => {
    try {
      await pauseCadence(contactId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResumeCadence = async () => {
    try {
      await resumeCadence(contactId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCompleteTouch = async (touchId: string) => {
    setCompletingTouch(touchId);
    try {
      await completeTouch(touchId, touchNotes, responseReceived);
      setShowNotes(null);
      setTouchNotes('');
      setResponseReceived(false);
      await loadData();
      onUpdate?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCompletingTouch(null);
    }
  };

  const getTouchIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail size={16} />;
      case 'call': return <Phone size={16} />;
      case 'linkedin': return <Linkedin size={16} />;
      default: return <MessageSquare size={16} />;
    }
  };

  const getTouchColor = (type: string) => {
    switch (type) {
      case 'email': return '#6366f1';
      case 'call': return '#22c55e';
      case 'linkedin': return '#0077b5';
      default: return '#94a3b8';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#22c55e';
      case 'pending': return '#f59e0b';
      case 'cancelled': return '#ef4444';
      case 'skipped': return '#6b7280';
      default: return '#94a3b8';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    return `In ${diffDays} days`;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="cadence-loading">
        <RefreshCw size={24} className="spin" />
        <span>Loading cadence...</span>
      </div>
    );
  }

  return (
    <div className="cadence-tab">
      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Active Cadence View */}
      {activeCadence ? (
        <div className="active-cadence">
          {/* Cadence Header */}
          <div className="cadence-header">
            <div className="cadence-info">
              <div className="cadence-badge" style={{ background: activeCadence.status === 'active' ? '#22c55e' : '#f59e0b' }}>
                {activeCadence.status === 'active' ? <Play size={14} /> : <Pause size={14} />}
                {activeCadence.status.toUpperCase()}
              </div>
              <h3>{activeCadence.name}</h3>
              <span className="started-date">Started {new Date(activeCadence.started_at).toLocaleDateString()}</span>
            </div>
            <div className="cadence-actions">
              {activeCadence.status === 'active' ? (
                <button className="btn-icon" onClick={handlePauseCadence} title="Pause">
                  <Pause size={16} />
                </button>
              ) : (
                <button className="btn-icon" onClick={handleResumeCadence} title="Resume">
                  <Play size={16} />
                </button>
              )}
              <button className="btn-icon danger" onClick={handleStopCadence} title="Stop">
                <Square size={16} />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="progress-section">
            <div className="progress-header">
              <span>Progress</span>
              <span>{activeCadence.progress.completed} / {activeCadence.progress.total} touches</span>
            </div>
            <div className="progress-bar-track">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${activeCadence.progress.percentage}%` }}
              />
            </div>
          </div>

          {/* Next Touch Alert */}
          {activeCadence.next_touch && (
            <div className="next-touch-card">
              <div className="next-touch-header">
                <Zap size={16} />
                <span>Next Touch</span>
              </div>
              <div className="next-touch-content">
                <div className="touch-type" style={{ color: getTouchColor(activeCadence.next_touch.touch_type) }}>
                  {getTouchIcon(activeCadence.next_touch.touch_type)}
                  <span>{activeCadence.next_touch.touch_type.toUpperCase()}</span>
                  <span className="variant-label">Variant {activeCadence.next_touch.variant_number}</span>
                </div>
                <div className="touch-schedule">
                  <Calendar size={14} />
                  <span>{formatDate(activeCadence.next_touch.scheduled_for)}</span>
                  <span className="time">{formatTime(activeCadence.next_touch.scheduled_for)}</span>
                </div>
                {showNotes === activeCadence.next_touch.id ? (
                  <div className="complete-form">
                    <textarea
                      placeholder="Add notes (optional)..."
                      value={touchNotes}
                      onChange={e => setTouchNotes(e.target.value)}
                    />
                    <label className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={responseReceived}
                        onChange={e => setResponseReceived(e.target.checked)}
                      />
                      Response received
                    </label>
                    <div className="form-actions">
                      <button 
                        className="btn-complete"
                        onClick={() => handleCompleteTouch(activeCadence.next_touch!.id)}
                        disabled={completingTouch === activeCadence.next_touch.id}
                      >
                        {completingTouch === activeCadence.next_touch.id ? 'Saving...' : 'Mark Complete'}
                      </button>
                      <button className="btn-cancel" onClick={() => setShowNotes(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button 
                    className="btn-mark-complete"
                    onClick={() => setShowNotes(activeCadence.next_touch!.id)}
                  >
                    <CheckCircle size={14} />
                    Mark as Complete
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Touch Timeline */}
          <div className="touch-timeline">
            <h4>Touch Timeline</h4>
            <div className="timeline">
              {activeCadence.touches.map((touch, idx) => (
                <div 
                  key={touch.id} 
                  className={`timeline-item ${touch.status}`}
                >
                  <div className="timeline-marker" style={{ 
                    background: touch.status === 'completed' ? '#22c55e' : 
                               touch.status === 'pending' ? getTouchColor(touch.touch_type) : '#6b7280'
                  }}>
                    {touch.status === 'completed' ? <CheckCircle size={12} /> : getTouchIcon(touch.touch_type)}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="touch-label">
                        Touch {touch.touch_number}: {touch.touch_type}
                      </span>
                      <span className="touch-status" style={{ color: getStatusColor(touch.status) }}>
                        {touch.status}
                      </span>
                    </div>
                    <div className="timeline-date">
                      {touch.executed_at 
                        ? `Completed ${new Date(touch.executed_at).toLocaleDateString()}`
                        : `Scheduled: ${new Date(touch.scheduled_for).toLocaleDateString()}`
                      }
                    </div>
                    {touch.notes && <div className="timeline-notes">{touch.notes}</div>}
                    {touch.response_received && (
                      <div className="response-badge">✓ Response received</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Start Cadence View */
        <div className="start-cadence">
          <div className="start-header">
            <Target size={32} className="start-icon" />
            <h3>Start a Sales Cadence</h3>
            <p>Automate your outreach with a structured multi-touch sequence</p>
          </div>

          <div className="cadence-selector">
            {Object.entries(cadenceTypes).map(([key, type]) => (
              <div 
                key={key}
                className={`cadence-option ${selectedType === key ? 'selected' : ''}`}
                onClick={() => setSelectedType(key)}
              >
                <div className="option-header">
                  <span className="option-name">{type.name}</span>
                  {selectedType === key && <CheckCircle size={16} className="check" />}
                </div>
                <p className="option-desc">{type.description}</p>
                <div className="option-stats">
                  <span><Mail size={12} /> {type.total_touches} touches</span>
                  <span><Calendar size={12} /> {type.duration_days} days</span>
                </div>
              </div>
            ))}
          </div>

          <button 
            className="btn-start-cadence"
            onClick={handleStartCadence}
            disabled={isStarting}
          >
            {isStarting ? (
              <>
                <RefreshCw size={16} className="spin" />
                Starting...
              </>
            ) : (
              <>
                <Play size={16} />
                Start {cadenceTypes[selectedType]?.name || 'Cadence'}
              </>
            )}
          </button>
        </div>
      )}

      {/* Activity History */}
      {activities.length > 0 && (
        <div className="activity-section">
          <h4>
            <TrendingUp size={16} />
            Recent Activity
          </h4>
          <div className="activity-list">
            {activities.slice(0, 10).map(activity => (
              <div key={activity.id} className="activity-item">
                <div className="activity-icon" style={{ background: getTouchColor(activity.channel) }}>
                  {getTouchIcon(activity.channel)}
                </div>
                <div className="activity-content">
                  <span className="activity-type">{activity.activity_type.replace(/_/g, ' ')}</span>
                  <span className="activity-message">{activity.message}</span>
                </div>
                <span className="activity-time">
                  {new Date(activity.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .cadence-tab {
          padding: 0.5rem 0;
        }

        .cadence-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 3rem;
          color: #94a3b8;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #ef4444;
          margin-bottom: 1rem;
          font-size: 0.85rem;
        }

        /* Active Cadence Styles */
        .active-cadence {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .cadence-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1rem;
          background: rgba(30, 41, 59, 0.6);
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.1);
        }

        .cadence-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .cadence-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.25rem 0.6rem;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 700;
          color: white;
          width: fit-content;
        }

        .cadence-info h3 {
          margin: 0.25rem 0 0;
          font-size: 1rem;
          font-weight: 700;
          color: #f8fafc;
        }

        .started-date {
          font-size: 0.75rem;
          color: #64748b;
        }

        .cadence-actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 6px;
          color: #a5b4fc;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-icon:hover {
          background: rgba(99, 102, 241, 0.2);
        }

        .btn-icon.danger {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        .btn-icon.danger:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        /* Progress */
        .progress-section {
          padding: 0.75rem 1rem;
          background: rgba(30, 41, 59, 0.4);
          border-radius: 8px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          color: #94a3b8;
          margin-bottom: 0.5rem;
        }

        .progress-bar-track {
          height: 6px;
          background: rgba(148, 163, 184, 0.1);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #8b5cf6);
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        /* Next Touch Card */
        .next-touch-card {
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 10px;
          overflow: hidden;
        }

        .next-touch-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1rem;
          background: rgba(99, 102, 241, 0.1);
          font-size: 0.75rem;
          font-weight: 600;
          color: #a5b4fc;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .next-touch-content {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .touch-type {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
          font-size: 0.9rem;
        }

        .variant-label {
          font-size: 0.7rem;
          font-weight: 500;
          padding: 0.125rem 0.5rem;
          background: rgba(148, 163, 184, 0.1);
          border-radius: 4px;
          color: #94a3b8;
        }

        .touch-schedule {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: #94a3b8;
        }

        .touch-schedule .time {
          color: #64748b;
        }

        .btn-mark-complete {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.6rem 1rem;
          background: #22c55e;
          border: none;
          border-radius: 6px;
          color: white;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-mark-complete:hover {
          background: #16a34a;
        }

        .complete-form {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .complete-form textarea {
          padding: 0.75rem;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 6px;
          color: #f8fafc;
          font-size: 0.85rem;
          resize: vertical;
          min-height: 60px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: #94a3b8;
          cursor: pointer;
        }

        .form-actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn-complete {
          flex: 1;
          padding: 0.5rem 1rem;
          background: #22c55e;
          border: none;
          border-radius: 6px;
          color: white;
          font-weight: 600;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .btn-complete:disabled {
          opacity: 0.6;
        }

        .btn-cancel {
          padding: 0.5rem 1rem;
          background: transparent;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 6px;
          color: #94a3b8;
          font-size: 0.8rem;
          cursor: pointer;
        }

        /* Timeline */
        .touch-timeline {
          padding: 1rem;
          background: rgba(30, 41, 59, 0.4);
          border-radius: 10px;
        }

        .touch-timeline h4 {
          margin: 0 0 1rem;
          font-size: 0.9rem;
          font-weight: 600;
          color: #e2e8f0;
        }

        .timeline {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .timeline-item {
          display: flex;
          gap: 0.75rem;
          padding: 0.75rem 0;
          border-left: 2px solid rgba(148, 163, 184, 0.1);
          margin-left: 9px;
          padding-left: 1.25rem;
          position: relative;
        }

        .timeline-item.completed {
          border-left-color: rgba(34, 197, 94, 0.3);
        }

        .timeline-marker {
          position: absolute;
          left: -10px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .timeline-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .touch-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: #e2e8f0;
          text-transform: capitalize;
        }

        .touch-status {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .timeline-date {
          font-size: 0.75rem;
          color: #64748b;
        }

        .timeline-notes {
          font-size: 0.8rem;
          color: #94a3b8;
          font-style: italic;
          margin-top: 0.25rem;
        }

        .response-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.7rem;
          color: #22c55e;
          margin-top: 0.25rem;
        }

        /* Start Cadence View */
        .start-cadence {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .start-header {
          text-align: center;
          padding: 1rem 0;
        }

        .start-icon {
          color: #6366f1;
          margin-bottom: 0.75rem;
        }

        .start-header h3 {
          margin: 0 0 0.25rem;
          font-size: 1.1rem;
          font-weight: 700;
          color: #f8fafc;
        }

        .start-header p {
          margin: 0;
          font-size: 0.85rem;
          color: #64748b;
        }

        .cadence-selector {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }

        .cadence-option {
          padding: 1rem;
          background: rgba(30, 41, 59, 0.6);
          border: 2px solid rgba(148, 163, 184, 0.1);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .cadence-option:hover {
          border-color: rgba(99, 102, 241, 0.3);
        }

        .cadence-option.selected {
          border-color: #6366f1;
          background: rgba(99, 102, 241, 0.1);
        }

        .option-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.25rem;
        }

        .option-name {
          font-weight: 700;
          font-size: 0.9rem;
          color: #f8fafc;
        }

        .option-header .check {
          color: #6366f1;
        }

        .option-desc {
          margin: 0 0 0.5rem;
          font-size: 0.75rem;
          color: #64748b;
        }

        .option-stats {
          display: flex;
          gap: 1rem;
          font-size: 0.7rem;
          color: #94a3b8;
        }

        .option-stats span {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .btn-start-cadence {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.875rem 1.5rem;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-start-cadence:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
        }

        .btn-start-cadence:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Activity Section */
        .activity-section {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
        }

        .activity-section h4 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0 0 0.75rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: #94a3b8;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .activity-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem;
          background: rgba(30, 41, 59, 0.4);
          border-radius: 6px;
        }

        .activity-icon {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }

        .activity-content {
          flex: 1;
          min-width: 0;
        }

        .activity-type {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: #e2e8f0;
          text-transform: capitalize;
        }

        .activity-message {
          display: block;
          font-size: 0.7rem;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .activity-time {
          font-size: 0.7rem;
          color: #64748b;
          flex-shrink: 0;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 500px) {
          .cadence-selector {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default CadenceTab;
