import React, { useState, useEffect } from 'react';
import CustomerSelect from './CustomerSelect';

async function fetchJson(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function ImportTab({ onImported }) {
  const [customerId, setCustomerId] = useState('');
  const [readiness, setReadiness] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setReadiness(null);
    setSummary(null);
    setError(null);
    if (!customerId) return;

    let cancelled = false;
    Promise.all([fetchJson(`/api/customers/${customerId}/mapping`), fetchJson(`/api/tenants/${customerId}`)])
      .then(([mapping, tenant]) => {
        if (cancelled) return;
        setReadiness({
          mapping: Boolean(mapping),
          fileName: mapping?.fileName,
          rowCount: mapping?.rowCount,
          tenantStatus: tenant?.status ?? 'not configured'
        });
      })
      .catch(err => {
        console.error('Failed to check import readiness:', err);
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  async function handleImport() {
    setImporting(true);
    setSummary(null);
    setError(null);

    try {
      const res = await fetch(`/api/customers/${customerId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `HTTP ${res.status}`);
        return;
      }
      setSummary(body);
      onImported();
    } catch (err) {
      console.error('Failed to import:', err);
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  const tenantActive = readiness?.tenantStatus === 'active';
  const ready = Boolean(readiness?.mapping && tenantActive);

  return (
    <div className="import-tab">
      <h2>Import</h2>
      <p className="form-hint">Import the customer's clients into its tenant using the saved mapping.</p>

      <CustomerSelect value={customerId} onChange={setCustomerId} />

      {readiness && (
        <>
          <ul className="readiness-list">
            <li className={readiness.mapping ? 'ready' : 'not-ready'}>
              {readiness.mapping
                ? `✓ Mapping saved (${readiness.fileName || 'clients file'}, ${readiness.rowCount} rows)`
                : '✗ No saved mapping: save one on the Data Mapping tab'}
            </li>
            <li className={tenantActive ? 'ready' : 'not-ready'}>
              {tenantActive
                ? '✓ Tenant is active'
                : `✗ Tenant is ${readiness.tenantStatus}: provision it on the Tenant Setup tab`}
            </li>
          </ul>

          <button type="button" className="btn-primary" onClick={handleImport} disabled={!ready || importing}>
            {importing ? 'Importing...' : 'Import clients'}
          </button>
        </>
      )}

      {error && <p className="form-error">⚠️ {error}</p>}

      {summary && (
        <div className="import-summary">
          <p className={summary.failed === 0 ? 'form-success' : 'form-error'}>
            {summary.imported} imported, {summary.updated} updated, {summary.failed} failed
          </p>
          {summary.errors.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Problem</th>
                </tr>
              </thead>
              <tbody>
                {summary.errors.map(rowError => (
                  <tr key={rowError.row}>
                    <td>{rowError.row}</td>
                    <td>{rowError.messages.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default ImportTab;
