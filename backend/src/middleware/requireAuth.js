import { getSessionUser } from '../services/authService.js';

function missingSessionError() {
  const error = new Error('Please sign in to use PlaceX.');
  error.statusCode = 401;
  error.code = 'AUTHENTICATION_REQUIRED';
  return error;
}

export async function requireAuth(req, _res, next) {
  const [scheme, token] = String(req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(missingSessionError());
  try {
    req.user = await getSessionUser(token);
    return next();
  } catch (error) {
    return next(error);
  }
}
