import { getUserFromToken, supabaseAdmin } from '../lib/supabaseClient.js';

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'No token provided' 
    });
  }

  getUserFromToken(token)
    .then(async (authUser) => {
      if (!authUser) {
        return res.status(401).json({ success: false, message: 'Invalid token' })
      }
      // Fetch profile row mapped by auth_user_id
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('id,auth_user_id,name,email,is_seller,rating,total_reviews')
        .eq('auth_user_id', authUser.id)
        .single()
      // Attach profile fallback if missing
      req.user = {
        auth_user_id: authUser.id,
        id: profile?.id, // numeric id may be undefined if profile not created yet
        email: authUser.email,
        is_seller: profile?.is_seller || false
      }
      next()
    })
    .catch(() => {
      return res.status(401).json({ success: false, message: 'Invalid token' })
    })
}

export function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token) {
    getUserFromToken(token)
      .then(async (authUser) => {
        if (authUser) {
          const { data: profile } = await supabaseAdmin
            .from('users')
            .select('id,auth_user_id,name,email,is_seller')
            .eq('auth_user_id', authUser.id)
            .single()
          req.user = {
            auth_user_id: authUser.id,
            id: profile?.id,
            email: authUser.email,
            is_seller: profile?.is_seller || false
          }
        }
        next()
      })
      .catch(() => next())
    return
  }
  next();
}
