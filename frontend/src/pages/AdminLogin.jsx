import { useState } from 'react';
import { login } from '../api';
import toast from 'react-hot-toast';

export default function AdminLogin({ onAuthSuccess }) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(formData);
      // Wait, we also need to verify if the user is an admin.
      // Easiest is to save token, and App will load. 
      // The Admin component itself checks for _isAdmin and shows unauthorized if not.
      localStorage.setItem('token', res.data.token);
      toast.success("Admin Session Activated", { icon: '🛡️' });
      onAuthSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0a] px-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-900/20 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="card w-full max-w-md p-8 shadow-2xl border border-red-900/40 bg-black/60 backdrop-blur-md rounded-2xl relative z-10">
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-red-950/50 border border-red-900 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.2)]">
            <span className="text-3xl">🛡️</span>
          </div>
        </div>

        <h1 className="text-3xl font-black text-center text-white uppercase tracking-wider mb-1">
          System Admin
        </h1>
        <p className="text-red-400/60 text-center text-xs uppercase tracking-[0.2em] font-bold mb-8">
          Restricted Access Zone
        </p>

        <form onSubmit={handleSubmit} className="space-y-5 text-left">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-red-100/50 mb-2 hidden">Admin Code</label>
            <input 
              type="email" required
              placeholder="Admin Email Address"
              className="w-full bg-black/50 border border-red-900/30 rounded-xl p-4 text-white placeholder:text-zinc-600 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 focus:outline-none transition-all"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div>
            <input 
              type="password" required
              placeholder="Authorization Key"
              className="w-full bg-black/50 border border-red-900/30 rounded-xl p-4 text-white placeholder:text-zinc-600 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 focus:outline-none transition-all"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full bg-red-900 hover:bg-red-800 text-white font-bold tracking-widest uppercase py-4 rounded-xl mt-4 transition-all shadow-[0_0_20px_rgba(185,28,28,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Initialize Session'}
          </button>
        </form>

        <div className="mt-8 text-center">
           <a href="/" className="text-zinc-600 hover:text-zinc-400 text-xs tracking-wider uppercase transition-colors">
              Return to Public Portal
           </a>
        </div>
      </div>
    </div>
  );
}
