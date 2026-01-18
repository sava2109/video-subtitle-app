import { Request, Response, NextFunction } from 'express';

const SITE_PASSWORD = process.env.SITE_PASSWORD || 'DeteSava';

export const passwordAuth = (req: Request, res: Response, next: NextFunction) => {
  // Skip auth for API health check
  if (req.path === '/api/health') {
    return next();
  }

  // Check for password in session cookie or header
  const providedPassword = req.headers['x-site-password'] || req.query.password;
  
  // Check cookie
  const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const cookiePassword = cookies?.['site-auth'];

  if (cookiePassword === SITE_PASSWORD || providedPassword === SITE_PASSWORD) {
    return next();
  }

  // If it's an API request without auth, return 401
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/exports/')) {
    return res.status(401).json({ error: 'Unauthorized', needsAuth: true });
  }

  // For other requests, let the frontend handle it
  next();
};

// Login endpoint
export const loginHandler = (req: Request, res: Response) => {
  const { password } = req.body;
  
  if (password === SITE_PASSWORD) {
    res.setHeader('Set-Cookie', `site-auth=${SITE_PASSWORD}; Path=/; HttpOnly; Max-Age=86400; SameSite=Lax`);
    res.json({ success: true, message: 'Успешна пријава!' });
  } else {
    res.status(401).json({ success: false, error: 'Погрешна шифра!' });
  }
};

// Logout endpoint
export const logoutHandler = (req: Request, res: Response) => {
  res.setHeader('Set-Cookie', 'site-auth=; Path=/; HttpOnly; Max-Age=0');
  res.json({ success: true, message: 'Одјављени сте.' });
};

// Check auth status
export const checkAuthHandler = (req: Request, res: Response) => {
  const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const cookiePassword = cookies?.['site-auth'];
  const isAuthenticated = cookiePassword === SITE_PASSWORD;
  
  res.json({ authenticated: isAuthenticated });
};
