import React, { useState, useEffect, useRef } from 'react';
import CustomerSelect from './CustomerSelect';

function DataMappingTab({ onSaved }) {
  const [customerId, setCustomerId] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [columns, setColumns] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const uploadedRef = useRef(false);

  useEffect(() => {
    uploadedRef.current = false;
    setAnalysis(null);
    setColumns({});
    setError(null);
    setFieldErrors({});
    setSavedAt(null);
    if (!customerId) return;

    let cancelled = false;
    fetch(`/api/customers/${customerId}/mapping`)
      .then(res => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(saved => {
        if (cancelled || !saved || uploadedRef.current) return;
        setAnalysis(saved);
        setColumns(saved.columns);
        setSavedAt(saved.savedAt);
      })
      .catch(err => {
        console.error('Failed to load the saved mapping:', err);
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    uploadedRef.current = true;
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setSavedAt(null);
    setAnalysis(null);
    try {
      const csv = await file.text();
      const res = await fetch(`/api/customers/${customerId}/mapping/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.errors?.csv || body.error || `HTTP ${res.status}`);
        return;
      }
      setAnalysis({ ...body, csv, fileName: file.name });
      setColumns(body.columns);
    } catch (err) {
      console.error('Failed to analyze the file:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    setSavedAt(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: analysis.csv, fileName: analysis.fileName, columns })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.errors) {
          setFieldErrors(body.errors);
        } else {
          setError(body.error || `HTTP ${res.status}`);
        }
        return;
      }
      setSavedAt(body.savedAt);
      onSaved();
    } catch (err) {
      console.error('Failed to save the mapping:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2>Data Mapping</h2>
      <p className="form-hint">Upload a customer's clients file. Each field shows its suggested source column. Change any that are wrong.</p>

      <CustomerSelect value={customerId} onChange={setCustomerId} />
      <div className="form-field">
        <label htmlFor="clientsFile">Clients file (CSV)</label>
        <input key={customerId} id="clientsFile" type="file" accept=".csv,text/csv" disabled={!customerId || loading} onChange={handleFile} />
      </div>

      {loading && <p>Reading file...</p>}
      {error && <p className="form-error">⚠️ Could not read the file: {error}</p>}

      {analysis && (
        <>
          {analysis.fileName && <p className="form-hint">Mapping for {analysis.fileName}</p>}
          {analysis.warnings.length > 0 && (
            <ul className="mapping-warning">
              {analysis.warnings.map(warning => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          <table className="mapping-table">
            <thead>
              <tr><th>Field</th><th>Source column</th></tr>
            </thead>
            <tbody>
              {analysis.fields.map(field => (
                <tr key={field.key}>
                  <td>{field.label}{field.required && ' *'}</td>
                  <td>
                    <select
                      aria-label={field.label}
                      value={columns[field.key] ?? ''}
                      onChange={e => setColumns(prev => ({ ...prev, [field.key]: e.target.value || null }))}
                    >
                      <option value="">(unmapped)</option>
                      {analysis.headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    {fieldErrors[`columns.${field.key}`] ? (
                      <span className="field-error"> {fieldErrors[`columns.${field.key}`]}</span>
                    ) : !columns[field.key] && (
                      <span className="field-error">{field.required ? ' required, unmapped' : ' unmapped'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save mapping'}
          </button>
          {savedAt && <p className="form-success">✅ Mapping saved. Data Mapping is complete.</p>}
        </>
      )}
    </div>
  );
}

export default DataMappingTab;
