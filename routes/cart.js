import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { supabaseAdmin } from '../lib/supabaseClient.js'

function parseImages(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr)) return arr.filter(Boolean);
      } catch (_) {}
    }
    return trimmed.split(',').map(s => s.replace(/^[\"\[]+|[\"\]]+$/g,'').trim()).filter(Boolean);
  }
  return [];
}

const router = express.Router();

// GET cart items
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('cart')
      .select('id,quantity,product_id,products:products(id,name,price,images,condition,user_id,users:users(id,name))')
      .eq('user_id', req.user.id)
      .order('added_at', { ascending: false })
    if (error) throw error
    const mapped = (data||[]).filter(i => i.products && !i.products.is_sold).map(i => ({
      id: i.id,
      quantity: i.quantity,
      product_id: i.product_id,
      name: i.products.name,
      price: i.products.price,
      images: parseImages(i.products.images),
      condition: i.products.condition,
      seller_id: i.products.users?.id,
      seller_name: i.products.users?.name
    }))
    res.json({ success: true, data: mapped, total: mapped.reduce((s,x)=>s + x.price * x.quantity,0) })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST add to cart
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body
    if (!product_id) return res.status(400).json({ success:false,message:'Product ID is required' })
    // Ensure product exists & not sold
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id,is_sold')
      .eq('id', product_id)
      .single()
    if (prodErr?.code === 'PGRST116') return res.status(404).json({ success:false,message:'Product not found' })
    if (prodErr) throw prodErr
    if (product.is_sold) return res.status(400).json({ success:false,message:'Product already sold' })
    // Check existing cart item
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('cart')
      .select('id,quantity')
      .eq('user_id', req.user.id)
      .eq('product_id', product_id)
      .limit(1)
    if (existErr) throw existErr
    if (existing && existing.length > 0) {
      const newQty = existing[0].quantity + quantity
      const { error } = await supabaseAdmin
        .from('cart')
        .update({ quantity: newQty })
        .eq('id', existing[0].id)
      if (error) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('cart')
        .insert([{ user_id: req.user.id, product_id, quantity }])
      if (error) throw error
    }
    res.status(201).json({ success:true,message:'Item added to cart' })
  } catch (error) {
    res.status(500).json({ success:false,message:error.message })
  }
})

// PUT update cart item quantity
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { quantity } = req.body
    if (!quantity || quantity < 1) return res.status(400).json({ success:false,message:'Invalid quantity' })
    const { data: item, error: itemErr } = await supabaseAdmin
      .from('cart')
      .select('id,user_id')
      .eq('id', req.params.id)
      .single()
    if (itemErr?.code === 'PGRST116') return res.status(404).json({ success:false,message:'Cart item not found' })
    if (itemErr) throw itemErr
    if (item.user_id !== req.user.id) return res.status(403).json({ success:false,message:'Not authorized' })
    const { error } = await supabaseAdmin
      .from('cart')
      .update({ quantity })
      .eq('id', req.params.id)
    if (error) throw error
    res.json({ success:true,message:'Cart updated' })
  } catch (error) {
    res.status(500).json({ success:false,message:error.message })
  }
})

// DELETE remove from cart
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: item, error: itemErr } = await supabaseAdmin
      .from('cart')
      .select('id,user_id')
      .eq('id', req.params.id)
      .single()
    if (itemErr?.code === 'PGRST116') return res.status(404).json({ success:false,message:'Cart item not found' })
    if (itemErr) throw itemErr
    if (item.user_id !== req.user.id) return res.status(403).json({ success:false,message:'Not authorized' })
    const { error } = await supabaseAdmin
      .from('cart')
      .delete()
      .eq('id', req.params.id)
    if (error) throw error
    res.json({ success:true,message:'Item removed from cart' })
  } catch (error) {
    res.status(500).json({ success:false,message:error.message })
  }
})

export default router;
