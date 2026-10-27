import React, { useState } from 'react';
import CustomerSelect from './CustomerSelect';

function DataMappingTab() {
  const [customerId, setCustomerId] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [columns, setColumns] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/mapping/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: await file.text() })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.errors?.csv || body.error || `HTTP ${res.status}`);
        return;
      }
      setAnalysis(body);
      setColumns(body.columns);
    } catch (err) {
      console.error('Failed to analyze the file:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Data Mapping</h2>
      <p className="form-hint">Upload a customer's clients file. Each field shows its suggested source column. Change any that are wrong.</p>

      <CustomerSelect
        value={customerId}
        onChange={id => {
          setCustomerId(id);
          setAnalysis(null);
        }}
      />
      <div className="form-field">
        <label htmlFor="clientsFile">Clients file (CSV)</label>
        <input id="clientsFile" type="file" accept=".csv,text/csv" disabled={!customerId || loading} onChange={handleFile} />
      </div>

      {loading && <p>Reading file...</p>}
      {error && <p className="form-error">⚠️ Could not read the file: {error}</p>}

      {analysis && (
        <>
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
                    {!columns[field.key] && (
                      <span className="field-error">{field.required ? ' required, unmapped' : ' unmapped'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default DataMappingTab;
