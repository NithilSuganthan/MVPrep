import { useState } from 'react';
import { login, register, generateAuthenticationOptions, verifyAuthentication } from '../api';
import { startAuthentication } from '@simplewebauthn/browser';
import toast from 'react-hot-toast';

export default function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', name: '', level: 'foundation' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const call = isLogin ? login : register;
      const res = await call(formData);
      localStorage.setItem('token', res.data.token);
      toast.success(isLogin ? "Welcome back!" : "Account created!", { icon: '👋' });
      onAuthSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    try {
      toast.loading("Waiting for your security key...", { id: 'auth' });
      const optionsRes = await generateAuthenticationOptions();
      const asseResp = await startAuthentication(optionsRes.data);
      const verifyRes = await verifyAuthentication(asseResp);
      
      if (verifyRes.data.success) {
        localStorage.setItem('token', verifyRes.data.token);
        toast.success("Signed in with Passkey!", { id: 'auth', icon: '🔑' });
        onAuthSuccess();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Passkey authentication failed.", { id: 'auth' });
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="card w-full max-w-md p-8 shadow-2xl border-t-4 border-t-[var(--primary)] text-center relative overflow-hidden">
        
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-[var(--primary)] blur-[60px] opacity-20"></div>

        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--primary)] to-blue-400">
          MVPrep
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-2 mb-8">
          Your ultimate CA Revision Architect.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Your Name</label>
                <input 
                  type="text" required
                  className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none transition-colors"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">CA Level</label>
                <select 
                  className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none transition-colors"
                  value={formData.level}
                  onChange={e => setFormData({...formData, level: e.target.value})}
                >
                  <option value="foundation">CA Foundation</option>
                  <option value="inter">CA Intermediate</option>
                  <option value="final">CA Final</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Email Address</label>
            <input 
              type="email" required
              className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none transition-colors"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Password</label>
            <input 
              type="password" required
              className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none transition-colors"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full btn-primary py-3 mt-4 text-lg"
          >
            {loading ? 'Authenticating...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {isLogin && (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <button 
              type="button" 
              onClick={handlePasskeyLogin}
              className="w-full py-3 text-lg font-bold flex items-center justify-center gap-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl hover:bg-white hover:text-black transition-colors"
            >
               🔑 Sign in with Passkey
            </button>
          </div>
        )}

        <div className="mt-6 text-sm text-[var(--text-muted)]">
          {isLogin ? "Don't have an account?" : "Already registered?"}
          <button 
            type="button" 
            className="ml-2 text-[var(--primary)] hover:underline font-medium focus:outline-none"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Create one." : "Sign in here."}
          </button>
        </div>

      </div>
    </div>
  );
}
