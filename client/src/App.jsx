import React, { useState, useEffect } from 'react';
import DataMappingTab from './DataMappingTab';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'customer-info', label: 'Customer Info' },
  { id: 'data-mapping', label: 'Data Mapping' },
  { id: 'tenant-setup', label: 'Tenant Setup' },
  { id: 'import', label: 'Import' }
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [onboardingData, setOnboardingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function reloadOnboarding() {
    return fetch('/api/onboarding')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Invalid response format');
        return data;
      })
      .then(data => {
        setOnboardingData(data);
        setError(null);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch onboarding data:', err);
        setError(err.message);
        setOnboardingData([]);
        setLoading(false);
      });
  }

  useEffect(() => {
    reloadOnboarding();
  }, []);

  return (
    <div className="app">
      <header>
        <h1>Onboarding Dashboard</h1>
        <p>Customer Success Team - Internal Tool</p>
      </header>

      <nav className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {activeTab === 'dashboard' && (
          <DashboardTab data={onboardingData} loading={loading} error={error} />
        )}
        {activeTab === 'customer-info' && (
          <CustomerInfoTab onCreated={reloadOnboarding} />
        )}
        {activeTab === 'data-mapping' && (
          <DataMappingTab />
        )}
        {activeTab === 'tenant-setup' && (
          <PlaceholderTab title="Tenant Setup" description="Provision and configure customer tenant" />
        )}
        {activeTab === 'import' && (
          <PlaceholderTab title="Import" description="Import customer data into the platform" />
        )}
      </main>
    </div>
  );
}

function DashboardTab({ data, loading, error }) {
  if (loading) {
    return <div className="placeholder"><p>Loading...</p></div>;
  }

  if (error) {
    return (
      <div className="placeholder">
        <p style={{ color: '#dc2626' }}>⚠️ Failed to load onboarding data</p>
        <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="placeholder"><p>No customers in the onboarding queue</p></div>;
  }

  return (
    <div>
      <h2>Onboarding Queue</h2>
      <p style={{ color: '#6b7280', marginBottom: '20px' }}>
        {data.length} customer(s) awaiting onboarding
      </p>

      {data.map(item => (
        <div key={item.customerId} className="customer-card">
          <h3>{item.customerName}</h3>
          <div className="customer-meta">
            <span>📍 {item.customerRegion}</span>
            <span>🏭 {item.customerIndustry}</span>
          </div>

          <div className="progress-section">
            <ProgressBar percent={item.progressPercent} />
            <Checklist steps={item.steps} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ percent }) {
  return (
    <div className="progress-bar-container">
      <div 
        className="progress-bar" 
        style={{ width: `${Math.max(percent, 0)}%` }}
      >
        {percent > 0 ? `${percent}%` : ''}
      </div>
    </div>
  );
}

function Checklist({ steps }) {
  return (
    <ul className="checklist">
      {steps.map(step => (
        <li key={step.id}>
          <span className={`step-status ${step.status}`}>
            {step.status === 'completed' ? '✓' : step.order}
          </span>
          <span>{step.name}</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#9ca3af' }}>
            {step.status.replace('_', ' ')}
          </span>
        </li>
      ))}
    </ul>
  );
}

const EMPTY_FORM = { name: '', industry: '', region: '', contactEmail: '' };

function CustomerInfoTab({ onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [savedName, setSavedName] = useState(null);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState({ industries: [], regions: [] });

  useEffect(() => {
    fetch('/api/customers/options')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => setOptions({ industries: data.industries ?? [], regions: data.regions ?? [] }))
      .catch(err => console.error('Failed to load customer options:', err));
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setSubmitError(null);
    setSavedName(null);

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.errors) {
          setErrors(body.errors);
        } else {
          setSubmitError(`HTTP ${res.status}`);
        }
        return;
      }
      setSavedName(body.name);
      setForm(EMPTY_FORM);
      onCreated();
    } catch (err) {
      console.error('Failed to save customer:', err);
      setSubmitError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="customer-form" onSubmit={handleSubmit}>
      <h2>Customer Info</h2>
      <p className="form-hint">Add a customer to the onboarding queue. Fields marked * are required.</p>

      <FormField id="name" label="Customer name *" required value={form.name} onChange={handleChange} error={errors.name} />
      <FormField id="contactEmail" label="Contact email *" type="email" required value={form.contactEmail} onChange={handleChange} error={errors.contactEmail} />
      <FormSelect id="industry" label="Industry" options={options.industries} value={form.industry} onChange={handleChange} error={errors.industry} />
      <FormSelect id="region" label="Region" options={options.regions} value={form.region} onChange={handleChange} error={errors.region} />

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Saving...' : 'Create customer'}
      </button>

      {savedName && (
        <p className="form-success">✅ {savedName} was added to the onboarding queue. Customer Info is complete.</p>
      )}
      {submitError && (
        <p className="form-error">⚠️ Could not save the customer: {submitError}</p>
      )}
    </form>
  );
}

function FormField({ id, label, error, ...inputProps }) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={id} {...inputProps} />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

function FormSelect({ id, label, options, error, ...selectProps }) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={id} {...selectProps}>
        <option value="">Choose...</option>
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

function PlaceholderTab({ title, description }) {
  return (
    <div className="placeholder">
      <h2>{title}</h2>
      <p>{description}</p>
      <p style={{ marginTop: '20px', fontSize: '0.9rem' }}>
        🚧 This section is ready to be built
      </p>
    </div>
  );
}

export default App;
