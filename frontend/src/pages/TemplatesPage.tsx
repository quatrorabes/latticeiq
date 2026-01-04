import { useState, useEffect } from 'react';
import { templateApi, EmailTemplate } from '../api/campaigns';
import { Edit2, Trash2, Mail, Plus, Eye, Code } from 'lucide-react';
import '../styles/TemplatesPage.css';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await templateApi.listEmail();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      // await templateApi.deleteEmail(id);
      loadTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  if (loading) {
    return (
      <div className="templates-page">
        <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
          Loading templates...
        </div>
      </div>
    );
  }

  return (
    <div className="templates-page">
      <div className="page-header">
        <div className="header-main">
          <Mail size={32} />
          <div>
            <h1>Email Templates</h1>
            <p>Create personalized templates with dynamic variables</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingTemplate(null);
            setShowEditor(true);
          }}
          className="btn-primary"
        >
          <Plus size={20} />
          New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="empty-state">
          <Mail size={64} />
          <p>No templates yet</p>
          <button onClick={() => setShowEditor(true)} className="btn-primary">
            Create your first template →
          </button>
        </div>
      ) : (
        <div className="templates-grid">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showEditor && (
        <TemplateEditor
          template={editingTemplate}
          onClose={() => {
            setShowEditor(false);
            setEditingTemplate(null);
          }}
          onSuccess={() => {
            setShowEditor(false);
            setEditingTemplate(null);
            loadTemplates();
          }}
        />
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: EmailTemplate;
  onEdit: (template: EmailTemplate) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="template-card">
      <div className="template-header">
        <div className="template-title">
          <Mail size={20} />
          <h3>{template.name}</h3>
        </div>
        <div className="template-actions">
          <button onClick={() => onEdit(template)} className="icon-btn" title="Edit">
            <Edit2 size={16} />
          </button>
          <button onClick={() => onDelete(template.id)} className="icon-btn danger" title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="template-subject">
        <strong>Subject:</strong> {template.subject}
      </div>

      <div className="template-body-preview">
        {template.body.substring(0, 150)}...
      </div>

      {template.variables_used.length > 0 && (
        <div className="template-variables">
          <div className="variables-label">Variables used:</div>
          <div className="variables-list">
            {template.variables_used.map((variable, i) => (
              <span key={i} className="variable-tag">
                {`{{${variable}}}`}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="template-footer">
        <span className={`status-badge ${template.is_active ? 'active' : 'inactive'}`}>
          {template.is_active ? 'Active' : 'Inactive'}
        </span>
        {template.category && <span className="category-badge">{template.category}</span>}
      </div>
    </div>
  );
}

function TemplateEditor({
  template,
  onClose,
  onSuccess,
}: {
  template: EmailTemplate | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [body, setBody] = useState(template?.body || '');
  const [category, setCategory] = useState(template?.category || '');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const availableVariables = [
    { name: 'first_name', description: 'Contact first name' },
    { name: 'last_name', description: 'Contact last name' },
    { name: 'company', description: 'Company name' },
    { name: 'job_title', description: 'Job title' },
    { name: 'industry', description: 'Industry' },
    { name: 'company_size', description: 'Company employee count' },
    { name: 'icp_score', description: 'ICP match score' },
    { name: 'kernel_persona', description: 'Persona type (WHO)' },
    { name: 'kernel_urgency', description: 'Urgency signal (WHEN)' },
    { name: 'kernel_hook', description: 'Value proposition (WHAT)' },
  ];

  const insertVariable = (variable: string) => {
    setBody((prev) => prev + `{{${variable}}}`);
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))];
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const variables = extractVariables(subject + body);
      
      await templateApi.createEmail({
        name,
        subject,
        body,
        category: category || undefined,
        variables_used: variables,
        is_active: true,
      });

      onSuccess();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const previewSample = {
    first_name: 'John',
    last_name: 'Doe',
    company: 'Acme Corp',
    job_title: 'VP of Sales',
    industry: 'Technology',
    company_size: '500',
    icp_score: '85',
    kernel_persona: 'Executive',
    kernel_urgency: 'Q1 Budget Planning',
    kernel_hook: 'Increase pipeline velocity by 40%',
  };

  const renderPreview = (text: string) => {
    let result = text;
    Object.entries(previewSample).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    });
    return result;
  };

  return (
    <div className="modal-overlay">
      <div className="modal template-editor-modal">
        <div className="modal-header">
          <h2>{template ? 'Edit Template' : 'New Email Template'}</h2>
          <button onClick={onClose} className="close-btn">
            ×
          </button>
        </div>

        <div className="editor-tabs">
          <button
            className={`editor-tab ${!showPreview ? 'active' : ''}`}
            onClick={() => setShowPreview(false)}
          >
            <Code size={16} />
            Edit
          </button>
          <button
            className={`editor-tab ${showPreview ? 'active' : ''}`}
            onClick={() => setShowPreview(true)}
          >
            <Eye size={16} />
            Preview
          </button>
        </div>

        {!showPreview ? (
          <div className="editor-content">
            <div className="editor-main">
              <div className="form-group">
                <label className="form-label">Template Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                  placeholder="e.g., Cold Outreach - Tech Executives"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="form-input"
                  placeholder="e.g., Cold Outreach, Follow-up, Demo Request"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Subject *</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="form-input"
                  placeholder="e.g., {{first_name}}, quick question about {{company}}"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Body *</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="form-textarea template-body"
                  rows={12}
                  placeholder="Hi {{first_name}},&#10;&#10;I noticed {{company}} is in the {{industry}} space...&#10;&#10;Best,&#10;Your Name"
                />
              </div>
            </div>

            <div className="variables-sidebar">
              <h3>Available Variables</h3>
              <p className="variables-help">Click to insert into template</p>
              <div className="variables-grid">
                {availableVariables.map((variable) => (
                  <button
                    key={variable.name}
                    onClick={() => insertVariable(variable.name)}
                    className="variable-button"
                    title={variable.description}
                  >
                    <Code size={14} />
                    <span>{variable.name}</span>
                  </button>
                ))}
              </div>

              <div className="variables-info">
                <strong>Syntax:</strong>
                <code>{`{{variable_name}}`}</code>
                <p>Variables are replaced with real contact data when emails are sent.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="preview-content">
            <div className="preview-header">
              <h3>Preview with Sample Data</h3>
              <div className="preview-badge">Sample Contact: John Doe</div>
            </div>

            <div className="preview-email-container">
              <div className="preview-email-subject">
                <strong>Subject:</strong> {renderPreview(subject)}
              </div>
              <div className="preview-email-body">
                {renderPreview(body).split('\n').map((line, i) => (
                  <p key={i}>{line || '\u00A0'}</p>
                ))}
              </div>
            </div>

            <div className="preview-sample-data">
              <h4>Sample Data Used:</h4>
              <div className="sample-data-grid">
                {Object.entries(previewSample).map(([key, value]) => (
                  <div key={key} className="sample-data-item">
                    <code>{`{{${key}}}`}</code>
                    <span>→</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || !subject || !body || saving}
            className="btn-primary"
          >
            {saving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
