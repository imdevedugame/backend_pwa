import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { supabaseAdmin } from '../lib/supabaseClient.js'
import fs from 'fs';
import path from 'path';

const router = express.Router();

// GET user profile
router.get('/:id', async (req, res) => {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id,name,email,phone,address,city,avatar,is_seller,rating,total_reviews,created_at')
      .eq('id', req.params.id)
      .single()
    if (error?.code === 'PGRST116') return res.status(404).json({ success:false,message:'User not found' })
    if (error) throw error
    const { count: activeCount } = await supabaseAdmin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.params.id)
      .eq('is_sold', false)
    const { count: soldCount } = await supabaseAdmin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.params.id)
      .eq('is_sold', true)
    res.json({ success:true, data: { ...user, active_products: activeCount || 0, sold_products: soldCount || 0 } })
  } catch (error) {
    res.status(500).json({ success:false,message:error.message })
  }
})

// GET current user profile
router.get('/profile/me', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id,name,email,phone,address,city,avatar,is_seller,rating,total_reviews')
      .eq('id', req.user.id)
      .single()
    if (error?.code === 'PGRST116') return res.status(404).json({ success:false,message:'User not found' })
    if (error) throw error
    res.json({ success:true, data: user })
  } catch (error) {
    res.status(500).json({ success:false,message:error.message })
  }
})

// PUT update user profile
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, phone, address, city } = req.body
    if (parseInt(req.params.id) !== req.user.id) return res.status(403).json({ success:false,message:'Not authorized' })
    const update = {}
    if (name !== undefined) update.name = name
    if (phone !== undefined) update.phone = phone
    if (address !== undefined) update.address = address
    if (city !== undefined) update.city = city
    const { error } = await supabaseAdmin
      .from('users')
      .update(update)
      .eq('id', req.params.id)
    if (error) throw error
    res.json({ success:true,message:'Profile updated successfully' })
  } catch (error) {
    res.status(500).json({ success:false,message:error.message })
  }
})

// PUT become seller
router.put('/:id/become-seller', authMiddleware, async (req, res) => {
  try {
    if (parseInt(req.params.id) !== req.user.id) return res.status(403).json({ success:false,message:'Not authorized' })
    const { error } = await supabaseAdmin
      .from('users')
      .update({ is_seller: true })
      .eq('id', req.params.id)
    if (error) throw error
    res.json({ success:true,message:'You are now a seller' })
  } catch (error) {
    res.status(500).json({ success:false,message:error.message })
  }
})

export default router;
