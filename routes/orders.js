import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { supabaseAdmin } from '../lib/supabaseClient.js'

// Helper to parse images stored as comma-separated string
function parseImages(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    // Jika format lama JSON array: ["/uploads/a.png", ...]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr)) return arr.filter(Boolean);
      } catch (_) {
        // fallback ke pemisah koma di bawah
      }
    }
    // Format baru: koma dipisah atau satu path
    return trimmed.split(',').map(s => s.replace(/^[\"\[]+|[\"\]]+$/g,'').trim()).filter(Boolean);
  }
  return [];
}

const router = express.Router();

// GET all orders for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query
    let query = supabaseAdmin
      .from('orders')
      .select('id,buyer_id,seller_id,product_id,quantity,total_price,payment_method,shipping_address,notes,status,created_at,products:products(name,images),seller:users!orders_seller_id_fkey(name,avatar),buyer:users!orders_buyer_id_fkey(name)')
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    const mapped = (data||[]).map(o => ({
      ...o,
      product_name: o.products?.name,
      images: parseImages(o.products?.images),
      seller_name: o.seller?.name,
      seller_avatar: o.seller?.avatar,
      buyer_name: o.buyer?.name,
      total_amount: o.total_price
    }))
    res.json({ success:true, data: mapped })
  } catch (error) {
    res.status(500).json({ success:false,message:error.message })
  }
})

// GET order by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id,buyer_id,seller_id,product_id,quantity,total_price,payment_method,shipping_address,notes,status,created_at,products:products(name,images,description),seller:users!orders_seller_id_fkey(name,phone,address,avatar),buyer:users!orders_buyer_id_fkey(name,phone)')
      .eq('id', req.params.id)
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
      .single()
    if (error?.code === 'PGRST116') return res.status(404).json({ success:false,message:'Order not found' })
    if (error) throw error
    res.json({ success:true, data: {
      ...data,
      product_name: data.products?.name,
      images: parseImages(data.products?.images),
      description: data.products?.description,
      seller_name: data.seller?.name,
      seller_phone: data.seller?.phone,
      seller_address: data.seller?.address,
      seller_avatar: data.seller?.avatar,
      buyer_name: data.buyer?.name,
      buyer_phone: data.buyer?.phone,
      total_amount: data.total_price
    }})
  } catch (error) {
    res.status(500).json({ success:false,message:error.message })
  }
})

// POST create order
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { product_id, seller_id, quantity = 1, payment_method, shipping_address, notes } = req.body
    if (!product_id || !seller_id) return res.status(400).json({ success:false,message:'Product ID and seller ID are required' })
    // Fetch product
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id,price,stock')
      .eq('id', product_id)
      .single()
    if (prodErr?.code === 'PGRST116') return res.status(404).json({ success:false,message:'Product not found' })
    if (prodErr) throw prodErr
    if (product.stock !== null && product.stock !== undefined && quantity > product.stock) {
      return res.status(400).json({ success:false,message:'Insufficient stock' })
    }
    const total_price = product.price * quantity
    // Insert order
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('orders')
      .insert([
        {
          buyer_id: req.user.id,
          seller_id,
          product_id,
          quantity,
          total_price,
          payment_method: payment_method || 'transfer',
          shipping_address: shipping_address || '',
          notes: notes || ''
        }
      ])
      .select('id')
      .single()
    if (insertErr) throw insertErr
    // Decrement stock
    if (product.stock !== null && product.stock !== undefined) {
      const newStock = product.stock - quantity
      const { error: updErr } = await supabaseAdmin
        .from('products')
        .update({ stock: newStock, is_sold: newStock <= 0 })
        .eq('id', product_id)
      if (updErr) throw updErr
    }
    res.status(201).json({ success:true,message:'Order created successfully',order_id: inserted.id })
  } catch (error) {
    res.status(500).json({ success:false,message:error.message })
  }
})

// PUT update order status
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body
    if (!['pending','confirmed','shipped','delivered','cancelled'].includes(status)) return res.status(400).json({ success:false,message:'Invalid status' })
    // Ownership check
    const { data: order, error: ordErr } = await supabaseAdmin
      .from('orders')
      .select('seller_id,buyer_id,product_id')
      .eq('id', req.params.id)
      .single()
    if (ordErr?.code === 'PGRST116') return res.status(404).json({ success:false,message:'Order not found' })
    if (ordErr) throw ordErr
    if (order.seller_id !== req.user.id && order.buyer_id !== req.user.id) return res.status(403).json({ success:false,message:'Not authorized' })
    const { error } = await supabaseAdmin
      .from('orders')
      .update({ status })
      .eq('id', req.params.id)
    if (error) throw error
    if (status === 'delivered') {
      const { error: prodError } = await supabaseAdmin
        .from('products')
        .update({ is_sold: true })
        .eq('id', order.product_id)
      if (prodError) throw prodError
    }
    res.json({ success:true,message:'Order status updated' })
  } catch (error) {
    res.status(500).json({ success:false,message:error.message })
  }
})

// POST create review
router.post('/:id/review', authMiddleware, async (req, res) => {
  try {
    const { rating, comment } = req.body
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success:false,message:'Rating must be between 1 and 5' })
    const { data: order, error: ordErr } = await supabaseAdmin
      .from('orders')
      .select('buyer_id,seller_id')
      .eq('id', req.params.id)
      .single()
    if (ordErr?.code === 'PGRST116') return res.status(404).json({ success:false,message:'Order not found' })
    if (ordErr) throw ordErr
    if (order.buyer_id !== req.user.id) return res.status(403).json({ success:false,message:'Not authorized' })
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('order_id', req.params.id)
    if (existErr) throw existErr
    if (existing && existing.length > 0) return res.status(400).json({ success:false,message:'Review already exists' })
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('reviews')
      .insert([{ order_id: req.params.id, buyer_id: req.user.id, seller_id: order.seller_id, rating, comment: comment || '' }])
      .select('id')
      .single()
    if (insErr) throw insErr
    // Recalculate rating
    const { data: stats, error: statsErr } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('seller_id', order.seller_id)
    if (statsErr) throw statsErr
    const avg = stats && stats.length ? stats.reduce((s,r)=>s+r.rating,0)/stats.length : 5
    const { error: updErr } = await supabaseAdmin
      .from('users')
      .update({ rating: avg, total_reviews: stats.length })
      .eq('id', order.seller_id)
    if (updErr) throw updErr
    res.status(201).json({ success:true,message:'Review created successfully',review_id: inserted.id })
  } catch (error) {
    res.status(500).json({ success:false,message:error.message })
  }
})

export default router;
