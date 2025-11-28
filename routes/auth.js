import express from 'express'
import bcrypt from 'bcryptjs'
import { supabase, supabaseAdmin } from '../lib/supabaseClient.js'

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body
    console.log('[AUTH][REGISTER] Incoming:', { name, email, hasPassword: Boolean(password), phone })

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' })
    }

    // Check existing user in Supabase public.users
    const { data: existingUsers, error: existingErr } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1)

    if (existingErr) {
      console.error('[AUTH][REGISTER] Check existing error:', existingErr.message)
      return res.status(500).json({ success: false, message: 'Internal error' })
    }
    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered' })
    }

    // Create Supabase auth user
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    })
    if (createErr || !created?.user) {
      console.error('[AUTH][REGISTER] Supabase createUser error:', createErr?.message)
      return res.status(500).json({ success: false, message: 'Failed to create auth user' })
    }
    const authUser = created.user

    // Optional legacy hash (if we want to keep local password reference) – can remove later
    const hashedPassword = await bcrypt.hash(password, 10)

    // Insert profile row
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('users')
      .insert([
        {
          auth_user_id: authUser.id,
            name,
            email,
            password: hashedPassword,
            phone: phone || null
        }
      ])
      .select('id,name,email,phone')
      .single()
    if (insertErr) {
      console.error('[AUTH][REGISTER] Insert profile error:', insertErr.message)
      return res.status(500).json({ success: false, message: 'Failed to create profile' })
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token: authUser.id, // client should sign in to obtain access token
      user: inserted
    })
  } catch (error) {
    console.error('[AUTH][REGISTER] Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    console.log('[AUTH][LOGIN] Attempt email=', email)
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' })
    }

    // Sign in via anon client to get session
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
    if (signInErr || !signInData?.user) {
      console.warn('[AUTH][LOGIN] Invalid credentials for email:', email)
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }

    // Fetch profile row
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('id,name,email,phone,address,city,avatar,is_seller,rating,total_reviews')
      .eq('auth_user_id', signInData.user.id)
      .single()
    if (profileErr) {
      console.error('[AUTH][LOGIN] Profile fetch error:', profileErr.message)
      return res.status(500).json({ success: false, message: 'Failed to fetch profile' })
    }

    res.json({
      success: true,
      message: 'Login successful',
      token: signInData.session?.access_token,
      refresh_token: signInData.session?.refresh_token,
      user: profile
    })
  } catch (error) {
    console.error('[AUTH][LOGIN] Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router;
