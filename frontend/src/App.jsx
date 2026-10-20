import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from './api.js';

const AuthContext = createContext(null);
const roleNames = { admin: 'Administrator', user: 'Customer', store_owner: 'Store owner' };
const landing = { admin: '/admin', user: '/stores', store_owner: '/owner' };

function readSession() {
  try {
    return JSON.parse(localStorage.getItem('storewise_user') || 'null');
  } catch {
    return null;
  }
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);
  const signIn = (session) => {
    localStorage.setItem('storewise_token', session.token);
    localStorage.setItem('storewise_user', JSON.stringify(session.user));
    setUser(session.user);
  };
  const signOut = () => {
    localStorage.removeItem('storewise_token');
    localStorage.removeItem('storewise_user');
    sessionStorage.removeItem('storewise_token');
    sessionStorage.removeItem('storewise_user');
    setUser(null);
  };
  const value = useMemo(() => ({ user, signIn, signOut }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  return useContext(AuthContext);
}

function PrivateRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={landing[user.role] || '/login'} replace />;
  return children;
}

function Alert({ children, kind = 'error' }) {
  return children ? <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div> : null;
}

function PageState({ loading, error, empty, children }) {
  if (loading) return <div className="state-card"><span className="spinner" /> Loading your workspace…</div>;
  if (error) return <div className="state-card state-error">{error}</div>;
  if (empty) return <div className="state-card">{empty}</div>;
  return children;
}

function Stars({ value = 0 }) {
  return <span className="stars" aria-label={`${value || 0} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <span key={star} className={star <= Math.round(Number(value)) ? 'filled' : ''}>★</span>)}</span>;
}

function RatingPicker({ value, onChange, disabled }) {
  return <div className="rating-picker" role="radiogroup" aria-label="Choose a rating">
    {[1, 2, 3, 4, 5].map((rating) => (
      <button type="button" key={rating} disabled={disabled} aria-label={`${rating} star${rating > 1 ? 's' : ''}`}
        aria-checked={Number(value) === rating} role="radio"
        className={rating <= Number(value) ? 'selected' : ''}
        onClick={() => onChange(rating)}>★</button>
    ))}
  </div>;
}

function AuthFrame({ children, eyebrow = 'STOREWISE', title, subtitle }) {
  return <main className="auth-screen">
    <div className="auth-side">
      <Link className="brand brand-light" to="/login"><span className="brand-mark">s</span> storewise</Link>
      <div className="auth-promo"><span className="eyebrow">A little more local</span><h2>Good stores deserve<br />great feedback.</h2><p>Discover independent businesses and help your community choose with confidence.</p><div className="promo-rating"><Stars value={5} /><span>Thoughtful ratings, better shopping.</span></div></div>
      <span className="auth-foot">A better way to find your next favourite.</span>
    </div>
    <section className="auth-main"><div className="auth-box"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>{children}</div></section>
  </main>;
}

function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to={landing[user.role] || '/login'} replace />;
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      signIn(data);
      navigate(landing[data.user.role] || '/login', { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };
  return <AuthFrame title="Welcome back." subtitle="Sign in to manage your stores, ratings and community.">
    <form className="form-stack" onSubmit={submit}>
      <Alert kind="success">{location.state?.message}</Alert>
      <Alert>{error}</Alert>
      <label>Email address<input type="email" autoComplete="email" required maxLength="254" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Your password" /></label>
      <button className="button button-primary button-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'} <span>→</span></button>
    </form>
    <div className="auth-switch">New to Storewise? <Link to="/signup">Create an account</Link></div>
  </AuthFrame>;
}

const passwordHint = '8–16 characters, one uppercase letter and one special character.';
function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', address: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      navigate('/login', { replace: true, state: { message: 'Account created — sign in to get started.' } });
    } catch (requestError) {
      const validation = requestError.response?.data?.errors?.map((item) => item.message).join(' ');
      setError(validation || getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };
  return <AuthFrame eyebrow="JOIN THE NEIGHBOURHOOD" title="Find your next favourite." subtitle="Create your customer account and start sharing the good stuff.">
    <form className="form-stack" onSubmit={submit}>
      <Alert>{error}</Alert>
      <label>Full name<input required minLength="20" maxLength="60" value={form.name} onChange={set('name')} placeholder="At least 20 characters" /></label>
      <label>Email address<input type="email" required maxLength="254" value={form.email} onChange={set('email')} placeholder="you@example.com" /></label>
      <label>Address <span className="label-note">Optional</span><textarea maxLength="400" rows="2" value={form.address} onChange={set('address')} placeholder="Street, city and postcode" /></label>
      <label>Password<input type="password" autoComplete="new-password" required minLength="8" maxLength="16" pattern="(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,16}" title={passwordHint} value={form.password} onChange={set('password')} placeholder="Create a strong password" /><span className="input-hint">{passwordHint}</span></label>
      <button className="button button-primary button-full" disabled={loading}>{loading ? 'Creating account…' : 'Create account'} <span>→</span></button>
    </form>
    <div className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></div>
  </AuthFrame>;
}

function AppShell({ children }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const nav = user.role === 'admin'
    ? [{ to: '/admin', label: 'Overview', icon: '▦' }, { to: '/admin/stores', label: 'Stores', icon: '⌂' }, { to: '/admin/users', label: 'People', icon: '♙' }]
    : user.role === 'store_owner'
      ? [{ to: '/owner', label: 'My store', icon: '⌂' }]
      : [{ to: '/stores', label: 'Discover stores', icon: '⌕' }];
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" to={landing[user.role]}><span className="brand-mark">s</span> storewise</Link>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="side-nav">{nav.map((item) => <NavLink key={item.to} to={item.to} end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">{item.icon}</span>{item.label}</NavLink>)}</nav>
      <div className="sidebar-bottom">
        <div className="help-card"><span className="help-dot" /><div><strong>Made for better local</strong><p>Every rating helps a neighbour.</p></div></div>
        <div className="user-mini"><div className="avatar">{user.name.charAt(0).toUpperCase()}</div><div className="user-mini-copy"><strong>{user.name}</strong><span>{roleNames[user.role]}</span></div><button className="button button-quiet" onClick={() => { signOut(); navigate('/login', { replace: true }); }}>Logout</button></div>
      </div>
    </aside>
    <main className="main-panel"><header className="topbar"><div className="breadcrumb">Your workspace <span>/</span> {roleNames[user.role]}</div><button className="button button-quiet password-trigger" onClick={() => setPasswordOpen(true)}>Update password <span>⌁</span></button></header><div className="page-content">{children}</div></main>
    {passwordOpen && <PasswordDialog onClose={() => setPasswordOpen(false)} />}
  </div>;
}

function PasswordDialog({ onClose }) {
  const [values, setValues] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const { data } = await api.put('/auth/password', values);
      setMessage(data.message);
      setValues({ currentPassword: '', newPassword: '' });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal">
    <div className="modal-heading"><div><div className="eyebrow">ACCOUNT SECURITY</div><h2>Update password</h2></div><button className="icon-button close-button" onClick={onClose} aria-label="Close">×</button></div>
    <form className="form-stack" onSubmit={submit}><Alert>{error}</Alert><Alert kind="success">{message}</Alert>
      <label>Current password<input type="password" autoComplete="current-password" required value={values.currentPassword} onChange={(e) => setValues({ ...values, currentPassword: e.target.value })} /></label>
      <label>New password<input type="password" autoComplete="new-password" minLength="8" maxLength="16" pattern="(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,16}" title={passwordHint} required value={values.newPassword} onChange={(e) => setValues({ ...values, newPassword: e.target.value })} /><span className="input-hint">{passwordHint}</span></label>
      <div className="modal-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={loading}>{loading ? 'Saving…' : 'Save password'}</button></div>
    </form>
  </section></div>;
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function StoresPage() {
  const [stores, setStores] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [notice, setNotice] = useState('');
  const load = async (query = '') => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/stores', { params: { search: query } });
      setStores(data.stores);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { const timer = setTimeout(() => load(search), 250); return () => clearTimeout(timer); }, [search]);
  const saveRating = async (store, rating) => {
    setSavingId(store.id);
    setNotice('');
    setError('');
    try {
      await api.put(`/stores/${store.id}/rating`, { rating });
      setStores((current) => current.map((item) => item.id === store.id ? { ...item, userRating: rating } : item));
      setNotice('Your rating has been saved. Thanks for supporting local.');
      load(search);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSavingId(null);
    }
  };
  return <><PageHeading eyebrow="THE NEIGHBOURHOOD" title="Find somewhere good." subtitle="Discover local shops and share a rating when you’ve visited." />
    <div className="toolbar"><div className="search-box"><span>⌕</span><input aria-label="Search stores by name or address" placeholder="Search by store name or address…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><span className="result-count">{stores.length} {stores.length === 1 ? 'store' : 'stores'}</span></div>
    <Alert kind="success">{notice}</Alert><Alert>{error}</Alert>
    <PageState loading={loading} error={error && !stores.length ? error : ''} empty={!loading && !error && !stores.length ? 'No stores found. Try another search, or check back soon.' : ''}>
      <div className="store-grid">{stores.map((store) => <article className="store-card" key={store.id}><div className="store-card-top"><span className="store-icon">⌂</span><span className="local-pill">LOCAL FIND</span></div><h2>{store.name}</h2><p className="store-address">{store.address || 'Address not provided'}</p><div className="rating-line"><Stars value={store.averageRating} /><strong>{store.averageRating ?? '—'}</strong><span>({Number(store.averageRating) ? 'rated by visitors' : 'no ratings yet'})</span></div><div className="rating-control"><div><strong>{store.userRating ? 'Your rating' : 'Rate this store'}</strong><span>{store.userRating ? 'You can change this anytime.' : 'Your feedback helps the community.'}</span></div><RatingPicker value={store.userRating || 0} disabled={savingId === store.id} onChange={(rating) => saveRating(store, rating)} /></div>{savingId === store.id && <span className="saving-note">Saving your rating…</span>}</article>)}</div>
    </PageState>
  </>;
}

function SortableHeader({ label, field, sort, direction, onSort }) {
  return <th><button className="sort-button" onClick={() => onSort(field)}>{label}<span className="sort-mark">{sort === field ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>;
}

function AdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [sort, setSort] = useState('name');
  const [direction, setDirection] = useState('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState('');
  const [owners, setOwners] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', address: '', password: '', role: 'user' });
  const [storeForm, setStoreForm] = useState({ name: '', email: '', address: '', ownerId: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const responses = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/stores', { params: { search, sort: ['name', 'email', 'address', 'averageRating'].includes(sort) ? sort : 'name', direction } }),
        api.get('/admin/users', { params: { search, role: role || undefined, sort: ['name', 'email', 'address', 'role'].includes(sort) ? sort : 'name', direction } })
      ]);
      setStats(responses[0].data);
      setStores(responses[1].data.stores);
      setUsers(responses[2].data.users);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (location.pathname === '/admin/users') setActiveTab('users');
    else if (location.pathname === '/admin/stores') setActiveTab('stores');
    else setActiveTab('overview');
  }, [location.pathname]);
  useEffect(() => { const timer = setTimeout(load, 180); return () => clearTimeout(timer); }, [search, role, sort, direction]);
  const toggleSort = (field) => {
    if (sort === field) setDirection(direction === 'asc' ? 'desc' : 'asc');
    else { setSort(field); setDirection('asc'); }
  };
  const openStoreForm = async () => {
    setFormError('');
    try {
      const { data } = await api.get('/admin/users', { params: { role: 'store_owner' } });
      setOwners(data.users);
      setDialog('store');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };
  const submitForm = async (event) => {
    event.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (dialog === 'user') await api.post('/admin/users', userForm);
      else await api.post('/admin/stores', { ...storeForm, ownerId: storeForm.ownerId || null });
      setSuccess(dialog === 'user' ? 'User created successfully.' : 'Store created successfully.');
      setDialog('');
      setUserForm({ name: '', email: '', address: '', password: '', role: 'user' });
      setStoreForm({ name: '', email: '', address: '', ownerId: '' });
      await load();
    } catch (requestError) {
      const validation = requestError.response?.data?.errors?.map((item) => item.message).join(' ');
      setFormError(validation || getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };
  const openUser = async (id) => {
    try {
      const { data } = await api.get(`/admin/users/${id}`);
      setSelectedUser(data.user);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  return <><PageHeading eyebrow="ADMINISTRATION" title={activeTab === 'overview' ? 'The big picture.' : activeTab === 'stores' ? 'Every local spot.' : 'Your community.'} subtitle="A clear view of the places and people making Storewise work." action={<div className="heading-actions"><button className="button button-outline" onClick={openStoreForm}>＋ Add store</button><button className="button button-primary" onClick={() => { setFormError(''); setDialog('user'); }}>＋ Add user</button></div>} />
    <Alert>{error}</Alert><Alert kind="success">{success}</Alert>
    <div className="tabs" role="tablist"><button className={activeTab === 'overview' ? 'active' : ''} onClick={() => navigate('/admin')}>Overview</button><button className={activeTab === 'stores' ? 'active' : ''} onClick={() => navigate('/admin/stores')}>Stores <span>{stats?.stores ?? '—'}</span></button><button className={activeTab === 'users' ? 'active' : ''} onClick={() => navigate('/admin/users')}>People <span>{stats?.users ?? '—'}</span></button></div>
    {activeTab === 'overview' && <div className="stats-grid">{[
      { label: 'TOTAL USERS', value: stats?.users, icon: '♙', note: 'People in your community' },
      { label: 'REGISTERED STORES', value: stats?.stores, icon: '⌂', note: 'Independent places to explore' },
      { label: 'RATINGS SHARED', value: stats?.ratings, icon: '★', note: 'Helpful local recommendations' }
    ].map((item) => <article className="stat-card" key={item.label}><div className="stat-top"><span>{item.label}</span><span className="stat-icon">{item.icon}</span></div><strong>{loading ? '…' : (item.value ?? '—')}</strong><p>{item.note}</p></article>)}</div>}
    <section className="table-panel"><div className="panel-heading"><div><h2>{activeTab === 'users' ? 'People directory' : 'Store directory'}</h2><p>{activeTab === 'users' ? 'Search members, owners and administrators.' : 'All registered stores and their community score.'}</p></div></div>
      <div className="filter-row"><div className="search-box"><span>⌕</span><input aria-label="Filter listings" placeholder="Filter by name, email or address…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>{activeTab !== 'stores' && <select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option><option value="user">Normal user</option><option value="admin">Administrator</option><option value="store_owner">Store owner</option></select>}<span className="result-count">{activeTab === 'users' ? users.length : stores.length} results</span></div>
      <PageState loading={loading} error={error && !stats ? error : ''} empty={!loading && activeTab === 'users' && !users.length ? 'No people match those filters.' : !loading && activeTab !== 'users' && !stores.length ? 'No stores match those filters. Add your first store above.' : ''}>
        {activeTab === 'users' ? <div className="table-wrap"><table><thead><tr><SortableHeader label="PERSON" field="name" sort={sort} direction={direction} onSort={toggleSort} /><SortableHeader label="EMAIL" field="email" sort={sort} direction={direction} onSort={toggleSort} /><SortableHeader label="ADDRESS" field="address" sort={sort} direction={direction} onSort={toggleSort} /><SortableHeader label="ROLE" field="role" sort={sort} direction={direction} onSort={toggleSort} /><th>DETAILS</th></tr></thead><tbody>{users.map((person) => <tr key={person.id}><td><div className="table-person"><div className="avatar avatar-small">{person.name.charAt(0)}</div><strong>{person.name}</strong></div></td><td>{person.email}</td><td className="muted-cell">{person.address || '—'}</td><td><span className={`role-pill ${person.role}`}>{roleNames[person.role]}</span></td><td><button className="text-button" onClick={() => openUser(person.id)}>View details →</button></td></tr>)}</tbody></table></div>
          : <div className="table-wrap"><table><thead><tr><SortableHeader label="STORE" field="name" sort={sort} direction={direction} onSort={toggleSort} /><SortableHeader label="EMAIL" field="email" sort={sort} direction={direction} onSort={toggleSort} /><SortableHeader label="ADDRESS" field="address" sort={sort} direction={direction} onSort={toggleSort} /><SortableHeader label="AVERAGE RATING" field="averageRating" sort={sort} direction={direction} onSort={toggleSort} /></tr></thead><tbody>{stores.map((store) => <tr key={store.id}><td><div className="store-name-cell"><span className="mini-store-icon">⌂</span><div><strong>{store.name}</strong><span>{store.ownerName ? `Owned by ${store.ownerName}` : 'Independent listing'}</span></div></div></td><td>{store.email}</td><td className="muted-cell">{store.address || '—'}</td><td><div className="rating-cell"><Stars value={store.averageRating} /><strong>{store.averageRating ?? '—'}</strong></div></td></tr>)}</tbody></table></div>}
      </PageState>
      <div className="table-footer"><span>Sort columns using the arrows in each heading.</span><span>Storewise administration</span></div>
    </section>
    {dialog && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setDialog('')}><section className="modal"><div className="modal-heading"><div><div className="eyebrow">ADD TO STOREWISE</div><h2>{dialog === 'user' ? 'Create a user account' : 'Add a new store'}</h2></div><button className="icon-button close-button" onClick={() => setDialog('')} aria-label="Close">×</button></div>
      <form className="form-stack" onSubmit={submitForm}><Alert>{formError}</Alert>{dialog === 'user' ? <>
        <label>Full name<input required minLength="20" maxLength="60" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} /></label><label>Email address<input type="email" required value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} /></label><label>Address<textarea rows="2" maxLength="400" value={userForm.address} onChange={(e) => setUserForm({ ...userForm, address: e.target.value })} /></label><label>Temporary password<input type="password" required minLength="8" maxLength="16" pattern="(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,16}" title={passwordHint} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} /><span className="input-hint">{passwordHint}</span></label><label>Account role<select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}><option value="user">Normal user</option><option value="admin">Administrator</option><option value="store_owner">Store owner</option></select></label>
      </> : <><label>Store name<input required maxLength="60" value={storeForm.name} onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })} /></label><label>Store email<input required type="email" value={storeForm.email} onChange={(e) => setStoreForm({ ...storeForm, email: e.target.value })} /></label><label>Address<textarea rows="2" maxLength="400" value={storeForm.address} onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })} /></label><label>Store owner <span className="label-note">Optional</span><select value={storeForm.ownerId} onChange={(e) => setStoreForm({ ...storeForm, ownerId: e.target.value })}><option value="">No owner assigned</option>{owners.map((owner) => <option value={owner.id} key={owner.id}>{owner.name} — {owner.email}</option>)}</select></label>{!owners.length && <span className="input-hint">Create a user with the Store owner role to assign them here.</span>}</>}
      <div className="modal-actions"><button className="button button-quiet" type="button" onClick={() => setDialog('')}>Cancel</button><button className="button button-primary" disabled={submitting}>{submitting ? 'Creating…' : dialog === 'user' ? 'Create account' : 'Create store'}</button></div></form></section></div>}
    {selectedUser && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setSelectedUser(null)}><section className="modal detail-modal"><div className="modal-heading"><div><div className="eyebrow">ACCOUNT DETAILS</div><h2>{selectedUser.name}</h2></div><button className="icon-button close-button" onClick={() => setSelectedUser(null)} aria-label="Close">×</button></div><dl className="detail-list"><div><dt>Email</dt><dd>{selectedUser.email}</dd></div><div><dt>Address</dt><dd>{selectedUser.address || 'Not provided'}</dd></div><div><dt>Role</dt><dd><span className={`role-pill ${selectedUser.role}`}>{roleNames[selectedUser.role]}</span></dd></div>{selectedUser.role === 'store_owner' && <div><dt>Store average rating</dt><dd className="detail-rating"><Stars value={selectedUser.averageRating} /> <strong>{selectedUser.averageRating ?? 'No ratings yet'}</strong></dd></div>}</dl><button className="button button-primary button-full" onClick={() => setSelectedUser(null)}>Done</button></section></div>}
  </>;
}

function OwnerPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('submittedAt');
  const [direction, setDirection] = useState('desc');
  useEffect(() => {
    api.get('/owner/dashboard').then((response) => setData(response.data)).catch((requestError) => setError(getErrorMessage(requestError))).finally(() => setLoading(false));
  }, []);
  const toggleSort = (field) => {
    if (sort === field) setDirection(direction === 'asc' ? 'desc' : 'asc');
    else { setSort(field); setDirection('asc'); }
  };
  const sortedRatings = [...(data?.ratings || [])].sort((a, b) => {
    const result = sort === 'rating'
      ? Number(a.rating) - Number(b.rating)
      : sort === 'submittedAt'
        ? new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
        : String(a[sort]).localeCompare(String(b[sort]));
    return direction === 'asc' ? result : -result;
  });
  return <><PageHeading eyebrow="YOUR STORE" title={data?.store?.name || 'Your store.'} subtitle={data?.store?.address || 'A simple view of how customers feel about your business.'} />
    <PageState loading={loading} error={error} empty={data && !data.store ? 'No store has been assigned to your account yet. Please contact your administrator.' : ''}>
      <div className="owner-summary"><article className="stat-card owner-score"><div className="stat-top"><span>YOUR AVERAGE RATING</span><span className="stat-icon">★</span></div><strong>{data?.averageRating ?? '—'}</strong><div className="owner-stars"><Stars value={data?.averageRating} /><span>{data?.ratings?.length || 0} customer ratings</span></div></article><article className="owner-note"><span className="note-icon">✳</span><div><strong>Every review helps you grow.</strong><p>Thank customers for their feedback and use the patterns to make each visit even better.</p></div></article></div>
      <section className="table-panel"><div className="panel-heading"><div><h2>Recent customer feedback</h2><p>Customers who rated your store, newest first.</p></div><span className="count-pill">{data?.ratings?.length || 0} reviews</span></div>
      {data?.ratings?.length ? <div className="table-wrap"><table><thead><tr><SortableHeader label="CUSTOMER" field="name" sort={sort} direction={direction} onSort={toggleSort} /><SortableHeader label="EMAIL" field="email" sort={sort} direction={direction} onSort={toggleSort} /><SortableHeader label="RATING" field="rating" sort={sort} direction={direction} onSort={toggleSort} /><SortableHeader label="SUBMITTED" field="submittedAt" sort={sort} direction={direction} onSort={toggleSort} /></tr></thead><tbody>{sortedRatings.map((review) => <tr key={review.userId}><td><div className="table-person"><div className="avatar avatar-small">{review.name.charAt(0)}</div><strong>{review.name}</strong></div></td><td>{review.email}</td><td><div className="rating-cell"><Stars value={review.rating} /><strong>{review.rating}</strong></div></td><td className="muted-cell">{new Date(review.submittedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <div className="empty-inline">Your store has no reviews yet. They’ll appear here after the first customer rating.</div>}<div className="table-footer"><span>Only feedback for your assigned store is shown.</span><span>Storewise owner view</span></div></section>
    </PageState>
  </>;
}

function NotFound() {
  const { user } = useAuth();
  return <div className="state-card"><h2>That page isn’t here.</h2><Link className="text-button" to={user ? landing[user.role] : '/login'}>Back to your workspace →</Link></div>;
}

function AppRoutes() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/signup" element={<SignupPage />} />
    <Route path="/" element={<IndexRedirect />} />
    <Route path="/stores" element={<PrivateRoute roles={['user']}><AppShell><StoresPage /></AppShell></PrivateRoute>} />
    <Route path="/admin" element={<PrivateRoute roles={['admin']}><AppShell><AdminPage /></AppShell></PrivateRoute>} />
    <Route path="/admin/stores" element={<PrivateRoute roles={['admin']}><AppShell><AdminPage /></AppShell></PrivateRoute>} />
    <Route path="/admin/users" element={<PrivateRoute roles={['admin']}><AppShell><AdminPage /></AppShell></PrivateRoute>} />
    <Route path="/owner" element={<PrivateRoute roles={['store_owner']}><AppShell><OwnerPage /></AppShell></PrivateRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>;
}

function IndexRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? landing[user.role] : '/login'} replace />;
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}
