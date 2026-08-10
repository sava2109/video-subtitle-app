import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Шифра за приступ сајту. У производњи МОРА да дође из окружења —
// подразумевана вредност у коду би била видљива свакоме ко отвори
// јавни репозиторијум, па сервер радије одбија да се покрене.
const SITE_PASSWORD = process.env.SITE_PASSWORD || '';

if (!SITE_PASSWORD && IS_PRODUCTION) {
  console.error(
    '\n❌ SITE_PASSWORD није постављен!\n' +
    '   Сајт би остао без заштите, па се сервер неће покренути.\n' +
    '   Постави SITE_PASSWORD у .env фајлу и покрени поново.\n'
  );
  process.exit(1);
}

// Ван производње (локални развој) дозвољавамо рад без шифре
const DEV_PASSWORD = 'dev';
const EFFECTIVE_PASSWORD = SITE_PASSWORD || DEV_PASSWORD;

if (!SITE_PASSWORD) {
  console.warn(
    `⚠️  SITE_PASSWORD није постављен — за локални развој користи се "${DEV_PASSWORD}".`
  );
}

/**
 * У колачић се уписује ХЕШ шифре, а не сама шифра — тако шифра не стоји
 * у читљивом облику у прегледачу нити у логовима посредника.
 */
const AUTH_TOKEN = crypto
  .createHash('sha256')
  .update(EFFECTIVE_PASSWORD)
  .digest('hex');

/** Поређење отпорно на мерење времена одговора */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce((acc, cookie) => {
    const index = cookie.indexOf('=');
    if (index > 0) {
      acc[cookie.slice(0, index).trim()] = cookie.slice(index + 1).trim();
    }
    return acc;
  }, {} as Record<string, string>);
}

function buildAuthCookie(): string {
  // Secure само преко HTTPS — иначе прегледач не би примио колачић на localhost
  const flags = ['Path=/', 'HttpOnly', 'Max-Age=86400', 'SameSite=Lax'];
  if (IS_PRODUCTION) flags.push('Secure');
  return `site-auth=${AUTH_TOKEN}; ${flags.join('; ')}`;
}

/**
 * Штити руте на које је постављен: /api, /uploads и /exports.
 *
 * ПАЖЊА: middleware је монтиран преко app.use('/api', ...), а Express у том
 * случају СКИДА префикс са req.path — за захтев /api/videos овде је
 * req.path === '/videos'. Зато се за проверу путање мора користити
 * req.originalUrl, а неаутентификован захтев се увек одбија (раније је
 * провера req.path.startsWith('/api/') била нетачна, па су сви захтеви
 * пролазили без шифре).
 */
export const passwordAuth = (req: Request, res: Response, next: NextFunction) => {
  // Здравствена провера остаје доступна без шифре (за надзор/uptime)
  if (req.originalUrl.split('?')[0] === '/api/health') {
    return next();
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies['site-auth'] || '';

  const headerPassword = req.headers['x-site-password'];
  const queryPassword = req.query.password;
  const providedPassword =
    (typeof headerPassword === 'string' ? headerPassword : '') ||
    (typeof queryPassword === 'string' ? queryPassword : '');

  if (
    safeEqual(cookieToken, AUTH_TOKEN) ||
    (providedPassword !== '' && safeEqual(providedPassword, EFFECTIVE_PASSWORD))
  ) {
    return next();
  }

  // Овај middleware стоји само на заштићеним префиксима, па се сваки
  // непотврђен захтев одбија. Сам React (HTML/JS) се служи изван њега,
  // тако да страница за пријаву и даље може да се учита.
  return res.status(401).json({ error: 'Unauthorized', needsAuth: true });
};

// Login endpoint
export const loginHandler = (req: Request, res: Response) => {
  const { password } = req.body;

  if (typeof password === 'string' && safeEqual(password, EFFECTIVE_PASSWORD)) {
    res.setHeader('Set-Cookie', buildAuthCookie());
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
  const cookies = parseCookies(req.headers.cookie);
  const isAuthenticated = safeEqual(cookies['site-auth'] || '', AUTH_TOKEN);

  res.json({ authenticated: isAuthenticated });
};
