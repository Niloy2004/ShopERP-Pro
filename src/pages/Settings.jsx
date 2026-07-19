import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';

export default function Settings({ currentUser }) {
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () => {
    window.api.settings.get().then(setSettings);
    window.api.users.list().then(setUsers);
  };
  useEffect(() => { load(); }, []);

  const set = (k, v) => setSettings({ ...settings, [k]: v });

  const save = async () => {
    await window.api.settings.set(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!settings) return <div className="page-sub">Loading settings…</div>;

  const isOwner = currentUser?.role === 'Owner';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <div className="page-sub">Business profile, users & backup</div>
        </div>
      </div>

      <div className="grid-2">
        {isOwner && (
          <div className="card">
            <h3 style={{ marginBottom: 14, fontSize: 16 }}>Business Profile</h3>
            <div className="field"><label>Business name</label><input value={settings.business_name || ''} onChange={e => set('business_name', e.target.value)} /></div>
            <div className="field"><label>Tagline</label><input value={settings.business_tagline || ''} onChange={e => set('business_tagline', e.target.value)} /></div>
            <div className="field"><label>Address</label><input value={settings.address || ''} onChange={e => set('address', e.target.value)} /></div>
            <div className="field"><label>Contact phone</label><input value={settings.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
            <div className="field"><label>Invoice number prefix</label><input value={settings.invoice_prefix || ''} onChange={e => set('invoice_prefix', e.target.value)} /></div>
            <div className="field"><label>Show service reminders this many days ahead</label><input type="number" min="1" value={settings.service_reminder_days || 3} onChange={e => set('service_reminder_days', e.target.value)} /></div>
            <button className="btn btn-primary" onClick={save}>{saved ? 'Saved ✓' : 'Save Changes'}</button>
          </div>
        )}

        <div className="card">
          <h3 style={{ marginBottom: 14, fontSize: 16 }}>Change Your Password</h3>
          <ChangePasswordForm currentUser={currentUser} />
        </div>
      </div>

      {isOwner && (
        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16 }}>User Accounts & Roles</h3>
              <button className="btn btn-ghost" onClick={() => setShowAddUser(true)}>+ Add User</button>
            </div>
            <table>
              <thead><tr><th>Name</th><th>Username</th><th>Role</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}><td>{u.name}</td><td className="mono">{u.username}</td><td><span className="badge badge-neutral">{u.role}</span></td></tr>
                ))}
              </tbody>
            </table>

            <h3 style={{ fontSize: 16, margin: '20px 0 10px' }}>Backup & Restore</h3>
            <div className="page-sub" style={{ marginBottom: 10 }}>
              Export a copy of your database as a backup file, or restore from a previous backup.
              The app must be restarted after a restore.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={async () => {
                const r = await window.api.db.export();
                if (r.ok) alert(`Backup saved to:\n${r.filePath}`);
              }}>Export Backup</button>
              <button className="btn btn-ghost" onClick={async () => {
                if (!confirm('This will replace your current data with the backup file. Continue?')) return;
                const r = await window.api.db.import();
                if (r.ok) alert('Restore complete. Please restart the app now.');
              }}>Restore Backup</button>
            </div>
          </div>
        </div>
      )}

      {showAddUser && <AddUserForm onClose={() => setShowAddUser(false)} onSaved={() => { setShowAddUser(false); load(); }} />}
    </div>
  );
}

function ChangePasswordForm({ currentUser }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    setError('');
    setSuccess(false);
    if (!currentPassword || !newPassword) return setError('Fill in both fields.');
    if (newPassword !== confirmPassword) return setError('New password and confirmation don\'t match.');
    if (newPassword.length < 4) return setError('New password should be at least 4 characters.');
    const result = await window.api.auth.changePassword({ userId: currentUser.id, currentPassword, newPassword });
    if (result.ok) {
      setSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => setSuccess(false), 2500);
    } else {
      setError(result.error || 'Could not change password.');
    }
  };

  return (
    <div>
      <div className="field"><label>Current password</label><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></div>
      <div className="field"><label>New password</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
      <div className="field"><label>Confirm new password</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div>
      {error && <div style={{ background: '#f6e0da', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button className="btn btn-primary" onClick={submit}>{success ? 'Password Updated ✓' : 'Update Password'}</button>
    </div>
  );
}

function AddUserForm({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('Staff');
  const [password, setPassword] = useState('');

  const save = async () => {
    if (!name || !username) return alert('Name and username are required.');
    await window.api.users.add({ name, username, role, password: password || 'changeme' });
    onSaved();
  };

  return (
    <Modal title="Add User" onClose={onClose} width={420}>
      <div className="field"><label>Full name</label><input value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="field"><label>Username</label><input value={username} onChange={e => setUsername(e.target.value)} /></div>
      <div className="field">
        <label>Role</label>
        <select value={role} onChange={e => setRole(e.target.value)}>
          <option>Owner</option><option>Staff</option><option>Technician</option>
        </select>
      </div>
      <div className="field"><label>Temporary password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Add User</button>
      </div>
    </Modal>
  );
}
