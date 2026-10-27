import React, { useState, useEffect } from 'react';
import CustomerSelect from './CustomerSelect';

const EDITABLE_STATUSES = ['pending', 'failed'];
const EMPTY_CONFIG = { plan: '', subdomain: '', adminEmail: '', region: '' };

async function fetchJson(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function TenantSetupTab() {
  const [customerId, setCustomerId] = useState('');
  const [plans, setPlans] = useState([]);
  const [tenant, setTenant] = useState(null);
  const [form, setForm] = useState(EMPTY_CONFIG);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJson('/api/tenants/options')
      .then(data => setPlans(data?.plans ?? []))
      .catch(err => console.error('Failed to load plans:', err));
  }, []);

  useEffect(() => {
    setTenant(null);
    setForm(EMPTY_CONFIG);
    setErrors({});
    setMessage(null);
    setError(null);
    if (!customerId) return;

    let cancelled = false;
    Promise.all([fetchJson(`/api/tenants/${customerId}`), fetchJson(`/api/customers/${customerId}/tenant-defaults`)])
      .then(([existing, defaults]) => {
        if (cancelled) return;
        setTenant(existing);
        setForm({
          plan: existing?.plan || defaults.plan,
          subdomain: existing?.subdomain || defaults.subdomain,
          adminEmail: existing?.adminEmail || defaults.adminEmail,
          region: existing?.region || defaults.region
        });
      })
      .catch(err => {
        console.error('Failed to load tenant:', err);
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/tenants/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: form.plan, subdomain: form.subdomain, adminEmail: form.adminEmail })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.errors) {
          setErrors(body.errors);
        } else {
          setError(body.error || `HTTP ${res.status}`);
        }
        return;
      }
      setTenant(body);
      setMessage('Tenant configuration saved.');
    } catch (err) {
      console.error('Failed to save tenant:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const status = tenant?.status ?? 'not configured';
  const editable = !tenant || EDITABLE_STATUSES.includes(tenant.status);

  return (
    <div className="tenant-tab">
      <h2>Tenant Setup</h2>
      <p className="form-hint">Configure the customer's tenant, then provision it.</p>

      <CustomerSelect value={customerId} onChange={setCustomerId} />

      {customerId && (
        <form onSubmit={handleSave}>
          <p className="tenant-status">
            Status: <span className={`status-badge ${status.replace(' ', '-')}`}>{status}</span>
          </p>

          <fieldset disabled={!editable} className="tenant-fieldset">
            <div className="form-field">
              <label htmlFor="plan">Plan</label>
              <select id="plan" name="plan" value={form.plan} onChange={handleChange}>
                {plans.map(plan => <option key={plan} value={plan}>{plan}</option>)}
              </select>
              {errors.plan && <span className="field-error">{errors.plan}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="subdomain">Subdomain</label>
              <input id="subdomain" name="subdomain" value={form.subdomain} onChange={handleChange} />
              {errors.subdomain && <span className="field-error">{errors.subdomain}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="adminEmail">Admin email</label>
              <input id="adminEmail" name="adminEmail" type="email" value={form.adminEmail} onChange={handleChange} />
              {errors.adminEmail && <span className="field-error">{errors.adminEmail}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="region">Region</label>
              <input id="region" value={form.region || '(not set)'} readOnly />
            </div>

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save configuration'}
            </button>
          </fieldset>
        </form>
      )}

      {message && <p className="form-success">✅ {message}</p>}
      {error && <p className="form-error">⚠️ {error}</p>}
    </div>
  );
}

export default TenantSetupTab;
