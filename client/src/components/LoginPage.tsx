import React, { useState } from 'react';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        onLogin();
      } else {
        setError(data.error || 'Погрешна шифра!');
      }
    } catch (err) {
      setError('Грешка при повезивању са сервером.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }}>
        <h1 style={{
          color: '#fff',
          textAlign: 'center',
          marginBottom: '10px',
          fontSize: '28px',
        }}>
          🎬 Video Subtitle App
        </h1>
        <p style={{
          color: 'rgba(255, 255, 255, 0.7)',
          textAlign: 'center',
          marginBottom: '30px',
        }}>
          Унесите шифру за приступ
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Шифра..."
            style={{
              width: '100%',
              padding: '15px 20px',
              fontSize: '16px',
              borderRadius: '10px',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              outline: 'none',
              marginBottom: '15px',
              boxSizing: 'border-box',
            }}
            autoFocus
          />

          {error && (
            <div style={{
              color: '#ff6b6b',
              textAlign: 'center',
              marginBottom: '15px',
              padding: '10px',
              background: 'rgba(255, 107, 107, 0.1)',
              borderRadius: '8px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '16px',
              fontWeight: 'bold',
              borderRadius: '10px',
              border: 'none',
              background: loading ? '#666' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
          >
            {loading ? 'Проверавам...' : 'Пријави се'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
