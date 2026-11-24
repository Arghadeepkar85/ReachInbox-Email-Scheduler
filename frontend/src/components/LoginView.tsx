import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';

export const LoginView: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const namePart = email.split('@')[0];
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    loginWithGoogle(undefined, {
      email,
      name: formattedName,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(formattedName)}&background=00A859&color=fff`,
      googleId: `email-${Date.now()}`,
    });
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white border border-gray-100 rounded-2xl p-10 shadow-[0_4px_25px_rgba(0,0,0,0.06)] text-center">
        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-8 tracking-tight">Login</h1>

        {/* Real Google OAuth Login Button matching Figma */}
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              loginWithGoogle(credentialResponse.credential);
            }}
            onError={() => {
              console.error('Google Sign-In Failed');
            }}
            theme="outline"
            shape="pill"
            size="large"
          />
        </div>

        {/* Divider matching Figma */}
        <div className="relative flex py-6 items-center">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="flex-shrink mx-4 text-xs text-gray-400">or sign up through email</span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>

        {/* Email / Password Form matching Figma */}
        <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email ID"
              className="w-full bg-[#F4F6F8] border border-transparent rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-[#F4F6F8] border border-transparent rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-lg text-sm font-semibold text-white bg-[#00A859] hover:bg-[#00924d] transition shadow-sm mt-2"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};
