// routes/logout/+server.ts
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies }) => {
  // 🔹 Borramos la cookie JWT
  cookies.delete('jwt', { path: '/' });

  // 🔹 Redirigimos al login
  throw redirect(302, '/');
};
