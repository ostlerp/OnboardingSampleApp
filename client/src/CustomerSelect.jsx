import React, { useState, useEffect } from 'react';

function CustomerSelect({ value, onChange }) {
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/customers')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => setCustomers(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error('Failed to load customers:', err);
        setError(err.message);
      });
  }, []);

  return (
    <div className="form-field">
      <label htmlFor="customer-select">Customer</label>
      <select id="customer-select" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Choose a customer...</option>
        {customers.map(customer => (
          <option key={customer.id} value={customer.id}>{customer.name}</option>
        ))}
      </select>
      {error && <span className="field-error">Could not load customers: {error}</span>}
    </div>
  );
}

export default CustomerSelect;
