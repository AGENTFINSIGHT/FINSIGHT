import { createClient } from '@supabase/supabase-js';

// Use anon key to verify user tokens via getUser()
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Authorization token required' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  req.user = user;
  next();
}
