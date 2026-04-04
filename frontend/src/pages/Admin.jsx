import { useState, useEffect } from 'react';
import { getAdminStats, getAdminUsers, getAdminUserDetails, changeAdminUserLevel, sendAdminNotification, deleteAdminUser, getAdminList, addAdmin, removeAdmin, login } from '../api';
import toast from 'react-hot-toast';
import { FiUsers, FiMail, FiTrash2, FiShield, FiAlertTriangle, FiActivity, FiDatabase, FiClock, FiSearch, FiX, FiChevronDown, FiChevronUp, FiEye, FiServer, FiBook, FiBarChart2, FiUserPlus, FiLock, FiLogIn } from 'react-icons/fi';

const levelLabels = { foundation: 'Foundation', inter: 'Intermediate', final: 'Final' };
const levelColors = { foundation: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', inter: 'bg-blue-500/20 text-blue-400 border-blue-500/30', final: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };

const emailTemplates = [
  { name: '🚀 Platform Update', subject: 'MVPrep - New Features!', content: '<h2 style="color: #a855f7;">Platform Update 🚀</h2>\n<p>Hello Aspirant,</p>\n<p>We just shipped exciting new features to help you ace your CA exams!</p>\n<p>Log in now to explore what\'s new.</p>' },
  { name: '📅 Exam Reminder', subject: 'MVPrep - Exam Approaching!', content: '<h2 style="color: #f59e0b;">Exam Reminder ⏰</h2>\n<p>Dear Aspirant,</p>\n<p>Your exam date is approaching fast! Make sure your revision plan is on track.</p>\n<p>Open your dashboard now and focus on high-priority chapters.</p>' },
  { name: '🎉 Welcome', subject: 'Welcome to MVPrep!', content: '<h2 style="color: #22c55e;">Welcome Aboard! 🎉</h2>\n<p>Hi there,</p>\n<p>Thank you for joining MVPrep - your ultimate CA Revision Architect.</p>\n<p>Start by setting up your exam date and exploring your personalized dashboard!</p>' },
  { name: '⚠️ Maintenance', subject: 'MVPrep - Scheduled Maintenance', content: '<h2 style="color: #ef4444;">Scheduled Maintenance 🔧</h2>\n<p>Dear User,</p>\n<p>We will be performing scheduled maintenance on [DATE] from [TIME] to [TIME].</p>\n<p>The platform may be briefly unavailable during this window. We apologize for any inconvenience.</p>' },
];

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [adminEmails, setAdminEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminLoginEmail, setAdminLoginEmail] = useState('');
  const [adminLoginPassword, setAdminLoginPassword] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  
  const [notifyForm, setNotifyForm] = useState({
    targetUserId: 'all',
    subject: '',
    htmlContent: ''
  });

  const fetchData = async () => {
    try {
      const [usersRes, statsRes, adminsRes] = await Promise.all([getAdminUsers(), getAdminStats(), getAdminList()]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
      setAdminEmails(adminsRes.data);
      setLoading(false);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || "You are not authorized to view this page.");
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminLoginLoading(true);
    try {
      const res = await login({ email: adminLoginEmail, password: adminLoginPassword });
      localStorage.setItem('token', res.data.token);
      toast.success('Authenticated! Verifying admin access...', { icon: '🔐' });
      setError(null);
      setLoading(true);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Check credentials.');
    }
    setAdminLoginLoading(false);
  };

  const handleDelete = async (id, email) => {
    if(!window.confirm(`⚠️ PERMANENT ACTION\n\nDelete user "${email}" and ALL their data?\n\nThis cannot be undone.`)) return;
    try {
      await deleteAdminUser(id);
      toast.success("User permanently deleted.");
      if (selectedUser?.id === id) setSelectedUser(null);
      fetchData();
    } catch(err) {
      toast.error(err.response?.data?.error || "Failed to delete user");
    }
  };

  const handleLevelChange = async (userId, newLevel) => {
    if(!window.confirm(`Change this user's level to ${levelLabels[newLevel]}?\n\nThis will wipe their current subjects and reseed with ${levelLabels[newLevel]} syllabus.`)) return;
    try {
      await changeAdminUserLevel(userId, newLevel);
      toast.success(`Level changed to ${levelLabels[newLevel]}!`);
      fetchData();
      if (selectedUser?.id === userId) viewUserDetails(userId);
    } catch(err) {
      toast.error(err.response?.data?.error || "Failed to change level");
    }
  };

  const viewUserDetails = async (userId) => {
    setUserDetailLoading(true);
    try {
      const res = await getAdminUserDetails(userId);
      setSelectedUser(res.data);
    } catch(err) {
      toast.error("Failed to load user details");
    }
    setUserDetailLoading(false);
  };

  const handleNotify = async (e) => {
    e.preventDefault();
    if(!notifyForm.subject || !notifyForm.htmlContent) return toast.error("Subject and Content are required");
    const toastId = toast.loading("Broadcasting notifications...");
    try {
      const res = await sendAdminNotification(notifyForm);
      toast.success(`Successfully sent ${res.data.sentCount || 0} email(s)!`, { id: toastId, icon: '🚀' });
      setNotifyForm(prev => ({ ...prev, subject: '' }));
    } catch(err) {
      toast.error(err.response?.data?.error || "Failed to send notifications", { id: toastId });
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminEmail.includes('@')) return toast.error("Enter a valid email");
    try {
      await addAdmin(newAdminEmail);
      toast.success(`${newAdminEmail} added as admin!`, { icon: '🛡️' });
      setNewAdminEmail('');
      fetchData();
    } catch(err) {
      toast.error(err.response?.data?.error || "Failed to add admin");
    }
  };

  const handleRemoveAdmin = async (email) => {
    if (!window.confirm(`Remove admin access for ${email}?`)) return;
    try {
      await removeAdmin(email);
      toast.success(`${email} removed from admins.`);
      fetchData();
    } catch(err) {
      toast.error(err.response?.data?.error || "Failed to remove admin");
    }
  };

  const applyTemplate = (template) => {
    setNotifyForm(prev => ({ ...prev, subject: template.subject, htmlContent: template.content }));
    toast.success(`Template "${template.name}" loaded!`, { icon: '📋' });
  };

  const formatUptime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="text-center mt-20 animate-pulse text-[var(--border)]">Verifying Master Clearance...</div>;

  if (error) return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 animate-fade-in">
      <div className="card w-full max-w-md bg-[var(--surface)] border border-red-900/30 p-8 shadow-[0_0_50px_rgba(239,68,68,0.1)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
          <FiShield size={120} />
        </div>
        
        <div className="text-center mb-8 relative">
          <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <FiLock size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Admin Portal</h1>
          <p className="text-[var(--text-muted)] text-sm italic">Master Clearance Required</p>
        </div>

        <form onSubmit={handleAdminLogin} className="space-y-5 relative">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 ml-1">Admin Identity</label>
            <div className="relative">
              <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input 
                type="email" 
                required
                placeholder="admin@mvprep.cloud"
                value={adminLoginEmail}
                onChange={(e) => setAdminLoginEmail(e.target.value)}
                className="w-full bg-black/40 border border-red-900/20 rounded-xl px-12 py-3.5 text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-red-500/50 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 ml-1">Access Cipher</label>
            <div className="relative">
              <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input 
                type="password" 
                required
                placeholder="••••••••••••"
                value={adminLoginPassword}
                onChange={(e) => setAdminLoginPassword(e.target.value)}
                className="w-full bg-black/40 border border-red-900/20 rounded-xl px-12 py-3.5 text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-red-500/50 transition-all text-sm"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={adminLoginLoading}
            className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 py-4 rounded-xl text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
          >
            {adminLoginLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <FiLogIn /> Authenticate
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-red-900/20 text-center">
          <p className="text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-tighter">
            <FiShield size={10} className="inline mr-1 text-red-500" /> Authorized Personnel Only
          </p>
          <div className="mt-4 flex justify-center gap-4 text-xs opacity-30">
            <span className="hover:opacity-100 transition-opacity cursor-help">IP: LOGGED</span>
            <span className="hover:opacity-100 transition-opacity cursor-help">MAC: VERIFIED</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <header className="border-b border-red-900/40 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400 flex items-center gap-3">
            <FiShield className="text-red-500" /> MVPrep Admin
          </h1>
          <p className="text-[var(--text-muted)] mt-2 italic flex items-center gap-2 text-sm">
            <FiAlertTriangle className="text-orange-400" /> Master Override Panel — handle with care.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Server Online
          </span>
          {stats && <span className="bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--border)] px-3 py-1.5 rounded-full font-medium">
            Uptime: {formatUptime(stats.serverUptime)}
          </span>}
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1">
        {[
          { id: 'overview', label: 'Overview', icon: <FiBarChart2 size={14} /> },
          { id: 'users', label: 'Users', icon: <FiUsers size={14} /> },
          { id: 'admins', label: 'Admins', icon: <FiLock size={14} /> },
          { id: 'notify', label: 'Notifications', icon: <FiMail size={14} /> },
          { id: 'system', label: 'System', icon: <FiServer size={14} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all
              ${activeTab === tab.id 
                ? 'bg-gradient-to-r from-red-600/80 to-orange-600/80 text-white shadow-lg shadow-red-500/20' 
                : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-hover)]'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>

      {/* ========== OVERVIEW TAB ========== */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card bg-gradient-to-br from-blue-900/30 to-[var(--surface)] border-l-4 border-l-blue-500">
              <FiUsers className="text-blue-400 mb-2" size={20} />
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider font-bold">Total Users</p>
              <p className="text-3xl font-black mt-1 text-white">{stats.totalUsers}</p>
              <p className="text-xs text-blue-400 mt-1 font-medium">+{stats.recentSignups} this week</p>
            </div>
            <div className="card bg-gradient-to-br from-emerald-900/30 to-[var(--surface)] border-l-4 border-l-emerald-500">
              <FiBook className="text-emerald-400 mb-2" size={20} />
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider font-bold">Total Subjects</p>
              <p className="text-3xl font-black mt-1 text-white">{stats.totalSubjects}</p>
              <p className="text-xs text-emerald-400 mt-1 font-medium">Across all users</p>
            </div>
            <div className="card bg-gradient-to-br from-purple-900/30 to-[var(--surface)] border-l-4 border-l-purple-500">
              <FiActivity className="text-purple-400 mb-2" size={20} />
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider font-bold">Total Chapters</p>
              <p className="text-3xl font-black mt-1 text-white">{stats.totalChapters}</p>
              <p className="text-xs text-purple-400 mt-1 font-medium">{stats.doneChapters} completed</p>
            </div>
            <div className="card bg-gradient-to-br from-orange-900/30 to-[var(--surface)] border-l-4 border-l-orange-500">
              <FiDatabase className="text-orange-400 mb-2" size={20} />
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider font-bold">Database Size</p>
              <p className="text-3xl font-black mt-1 text-white">{stats.dbSizeKB} KB</p>
              <p className="text-xs text-orange-400 mt-1 font-medium">SQLite WAL mode</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2"><FiBarChart2 className="text-blue-400" /> Chapter Status Breakdown</h3>
              <div className="space-y-4">
                {[
                  { label: 'Completed', count: stats.doneChapters, color: 'bg-emerald-500', pct: stats.totalChapters > 0 ? Math.round((stats.doneChapters/stats.totalChapters)*100) : 0 },
                  { label: 'Revising', count: stats.revisingChapters, color: 'bg-yellow-500', pct: stats.totalChapters > 0 ? Math.round((stats.revisingChapters/stats.totalChapters)*100) : 0 },
                  { label: 'Not Started', count: stats.notStartedChapters, color: 'bg-red-500', pct: stats.totalChapters > 0 ? Math.round((stats.notStartedChapters/stats.totalChapters)*100) : 0 },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[var(--text-muted)] font-medium">{item.label}</span>
                      <span className="font-bold text-white">{item.count} <span className="text-[var(--text-muted)] font-normal">({item.pct}%)</span></span>
                    </div>
                    <div className="w-full bg-[var(--surface-hover)] rounded-full h-2.5 overflow-hidden border border-[var(--border)]">
                      <div className={`${item.color} h-2.5 rounded-full transition-all duration-700`} style={{ width: `${item.pct}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2"><FiUsers className="text-purple-400" /> CA Level Distribution</h3>
              <div className="space-y-3">
                {['foundation', 'inter', 'final'].map(level => {
                  const found = stats.levelDistribution?.find(l => l.level === level);
                  const count = found?.count || 0;
                  const pct = stats.totalUsers > 0 ? Math.round((count / stats.totalUsers) * 100) : 0;
                  return (
                    <div key={level} className="flex items-center gap-4 p-3 bg-[var(--surface-hover)] rounded-xl border border-[var(--border)]">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${levelColors[level]}`}>
                        {levelLabels[level]}
                      </span>
                      <div className="flex-1">
                        <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden">
                          <div className={`h-2 rounded-full transition-all duration-700 ${level === 'foundation' ? 'bg-emerald-500' : level === 'inter' ? 'bg-blue-500' : 'bg-purple-500'}`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                      <span className="text-white font-bold text-sm min-w-[60px] text-right">{count} users</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== USERS TAB ========== */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:border-red-500/50 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white">
                  <FiX />
                </button>
              )}
            </div>
            <div className="text-xs text-[var(--text-muted)] font-medium px-1">
              Showing {filteredUsers.length} of {users.length} users
            </div>
            <div className="space-y-3">
              {filteredUsers.map(u => (
                <div key={u.id} className={`card group transition-all cursor-pointer hover:border-red-500/30 ${selectedUser?.id === u.id ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : ''}`}
                  onClick={() => viewUserDetails(u.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {u.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">{u.name}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${levelColors[u.level]}`}>
                        {levelLabels[u.level] || '?'}
                      </span>
                      {adminEmails.some(a => a.email === u.email) && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-red-500/20 text-red-400 border-red-500/30">Admin</span>
                      )}
                      <FiEye size={14} className="text-[var(--text-muted)] group-hover:text-white transition-colors" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[var(--text-muted)]">{u.done_chapters}/{u.total_chapters} chapters</span>
                      <span className="font-bold text-white">{u.progress}%</span>
                    </div>
                    <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-gradient-to-r from-red-500 to-orange-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${u.progress}%` }}></div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--border)]">
                    <span className="text-[10px] text-[var(--text-muted)]">Joined {new Date(u.created_at).toLocaleDateString()}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(u.id, u.email); }}
                      className="p-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500 hover:text-white transition-colors"
                      title="Delete User"
                    >
                      <FiTrash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <p className="text-center py-12 text-[var(--text-muted)]">No users match your search.</p>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {userDetailLoading && (
              <div className="card text-center py-12">
                <div className="animate-pulse text-[var(--text-muted)]">Loading user data...</div>
              </div>
            )}
            {!userDetailLoading && selectedUser && (
              <div className="card border-red-900/20 bg-[#100a0a] sticky top-6 space-y-5 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
                    {selectedUser.settings?.student_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">{selectedUser.settings?.student_name || 'Unknown'}</h3>
                    <p className="text-xs text-[var(--text-muted)]">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/40 rounded-lg p-3 border border-[var(--border)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Level</p>
                    <p className="font-bold text-white mt-1">{levelLabels[selectedUser.settings?.level] || 'Foundation'}</p>
                  </div>
                  <div className="bg-black/40 rounded-lg p-3 border border-[var(--border)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Exam Date</p>
                    <p className="font-bold text-white mt-1">{selectedUser.settings?.exam_date || 'Not set'}</p>
                  </div>
                  <div className="bg-black/40 rounded-lg p-3 border border-[var(--border)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Pomodoros</p>
                    <p className="font-bold text-white mt-1">{selectedUser.settings?.pomodoros_completed || 0}</p>
                  </div>
                  <div className="bg-black/40 rounded-lg p-3 border border-[var(--border)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Joined</p>
                    <p className="font-bold text-white mt-1">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="bg-black/40 rounded-lg p-3 border border-[var(--border)]">
                  <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold mb-2">Change Level (Admin Override)</p>
                  <div className="flex gap-2">
                    {['foundation', 'inter', 'final'].map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => handleLevelChange(selectedUser.id, lvl)}
                        disabled={selectedUser.settings?.level === lvl}
                        className={`flex-1 text-xs font-bold py-2 rounded-lg border transition-all
                          ${selectedUser.settings?.level === lvl 
                            ? `${levelColors[lvl]} cursor-not-allowed opacity-60` 
                            : 'bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-red-500/50'}`}
                      >
                        {levelLabels[lvl]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2"><FiBook size={14} /> Subjects ({selectedUser.subjects?.length})</h4>
                  <div className="space-y-3">
                    {selectedUser.subjects?.map(sub => (
                      <SubjectAccordion key={sub.id} subject={sub} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {!userDetailLoading && !selectedUser && (
              <div className="card text-center py-16 border-dashed">
                <FiEye size={32} className="mx-auto mb-4 text-[var(--text-muted)] opacity-40" />
                <p className="text-[var(--text-muted)] font-medium">Click a user to inspect their data</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== ADMINS TAB ========== */}
      {activeTab === 'admins' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="card border-red-900/20 bg-[#100a0a]">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white mb-2">
              <FiLock className="text-red-400" /> Admin Access Control
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Only users whose email appears below can access this admin panel. Add or remove admin privileges here.
            </p>

            {/* Add Admin Form */}
            <form onSubmit={handleAddAdmin} className="flex gap-3 mb-6">
              <div className="flex-1 relative">
                <FiUserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="email"
                  placeholder="Enter email to grant admin access..."
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black/40 border border-red-900/30 rounded-xl text-white placeholder:text-[var(--text-muted)] focus:border-red-500/50 focus:outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <FiUserPlus size={16} /> Add Admin
              </button>
            </form>

            {/* Admin List */}
            <div className="space-y-3">
              {adminEmails.map((admin, idx) => (
                <div key={admin.email} className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-[var(--border)] group hover:border-red-500/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-700 to-red-500 flex items-center justify-center text-white font-bold text-sm">
                      <FiShield size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-white">{admin.email}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {idx === 0 ? 'Primary Admin' : `Admin #${idx + 1}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveAdmin(admin.email)}
                    className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                    title="Revoke Admin Access"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {adminEmails.length <= 1 && (
              <p className="text-xs text-orange-400 mt-4 flex items-center gap-1.5">
                <FiAlertTriangle size={12} /> You must have at least one admin. The last admin cannot be removed.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ========== NOTIFY TAB ========== */}
      {activeTab === 'notify' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleNotify} className="lg:col-span-2 card border-blue-900/20 bg-[#0a0f18] space-y-5">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <FiMail className="text-blue-400" /> Compose Communication
            </h2>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Target Audience</label>
              <select 
                value={notifyForm.targetUserId}
                onChange={e => setNotifyForm({...notifyForm, targetUserId: e.target.value})}
                className="w-full bg-black/40 border border-blue-900/30 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="all">🚀 Broadcast to ALL Users ({users.length})</option>
                {users.map(u => <option key={u.id} value={u.id}>Direct: {u.name} ({u.email})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Email Subject</label>
              <input 
                type="text" required
                placeholder="Important Platform Update..."
                value={notifyForm.subject}
                onChange={e => setNotifyForm({...notifyForm, subject: e.target.value})}
                className="w-full bg-black/40 border border-blue-900/30 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">HTML Content Payload</label>
              <textarea 
                required
                value={notifyForm.htmlContent}
                onChange={e => setNotifyForm({...notifyForm, htmlContent: e.target.value})}
                className="w-full h-56 bg-black/40 border border-blue-900/30 rounded-lg p-3 text-sm text-gray-300 font-mono focus:outline-none focus:border-blue-500 transition-colors leading-relaxed"
                placeholder="<h2>Your HTML content here...</h2>"
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all flex justify-center items-center gap-2 text-lg"
            >
              <FiMail /> Execute Communication
            </button>
          </form>
          <div className="space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2"><FiBook /> Quick Templates</h3>
            {emailTemplates.map((tmpl, idx) => (
              <button
                key={idx}
                onClick={() => applyTemplate(tmpl)}
                className="w-full text-left p-4 card hover:border-blue-500/30 transition-all group"
              >
                <p className="font-bold text-white group-hover:text-blue-400 transition-colors">{tmpl.name}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 truncate">{tmpl.subject}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ========== SYSTEM TAB ========== */}
      {activeTab === 'system' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><FiServer /> Server Info</h3>
            {[
              { label: 'Server Status', value: 'Online', color: 'text-green-400' },
              { label: 'Server Uptime', value: formatUptime(stats.serverUptime), color: 'text-blue-400' },
              { label: 'Database Engine', value: 'SQLite 3 (WAL Mode)', color: 'text-purple-400' },
              { label: 'Database Size', value: `${stats.dbSizeKB} KB`, color: 'text-orange-400' },
              { label: 'Backend Port', value: '3001', color: 'text-white' },
              { label: 'Frontend Port', value: '5173', color: 'text-white' },
              { label: 'Runtime', value: 'Node.js', color: 'text-emerald-400' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center py-2 border-b border-[var(--border)] last:border-0">
                <span className="text-sm text-[var(--text-muted)]">{item.label}</span>
                <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
          <div className="card space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><FiDatabase /> Data Summary</h3>
            {[
              { label: 'Total Users', value: stats.totalUsers },
              { label: 'Total Subjects', value: stats.totalSubjects },
              { label: 'Total Chapters', value: stats.totalChapters },
              { label: 'Completed Chapters', value: stats.doneChapters },
              { label: 'Revising Chapters', value: stats.revisingChapters },
              { label: 'Not Started Chapters', value: stats.notStartedChapters },
              { label: 'New Users (7 days)', value: stats.recentSignups },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center py-2 border-b border-[var(--border)] last:border-0">
                <span className="text-sm text-[var(--text-muted)]">{item.label}</span>
                <span className="text-sm font-bold text-white">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="card md:col-span-2 bg-red-500/5 border-red-900/30">
            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-3"><FiAlertTriangle /> Danger Zone</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              These actions are destructive and irreversible. Proceed with extreme caution.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  if(window.confirm("This will delete ALL user accounts and ALL data. Are you absolutely sure?")) {
                    toast.error("Mass delete is disabled for safety.");
                  }
                }}
                className="px-6 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg font-bold text-sm hover:bg-red-500 hover:text-white transition-all"
              >
                Purge All Users
              </button>
              <button 
                onClick={() => toast.success("Database compacted!", { icon: '💾' })}
                className="px-6 py-2.5 bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-muted)] rounded-lg font-bold text-sm hover:text-white transition-all"
              >
                Compact Database
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectAccordion({ subject }) {
  const [open, setOpen] = useState(false);
  const statusColor = (status) => {
    if (status === 'Done') return 'text-emerald-400';
    if (status === 'Revising') return 'text-yellow-400';
    return 'text-red-400';
  };
  return (
    <div className="bg-black/40 rounded-lg border border-[var(--border)] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 hover:bg-[var(--surface-hover)] transition-colors">
        <div className="text-left">
          <p className="font-bold text-white text-sm">{subject.name}</p>
          <p className="text-[10px] text-[var(--text-muted)]">{subject.progress}% covered · {subject.chapters?.length} chapters</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 bg-black/60 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-blue-400 h-1.5 rounded-full" style={{ width: `${subject.progress}%` }}></div>
          </div>
          {open ? <FiChevronUp size={14} className="text-[var(--text-muted)]" /> : <FiChevronDown size={14} className="text-[var(--text-muted)]" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-[var(--border)] pt-2">
          {subject.chapters?.map(ch => (
            <div key={ch.id} className="flex items-center justify-between text-xs py-1">
              <span className="text-[var(--text-muted)] truncate flex-1 mr-2">{ch.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-mono text-[var(--text-muted)]">{ch.marks}m</span>
                <span className={`font-bold ${statusColor(ch.status)}`}>{ch.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
