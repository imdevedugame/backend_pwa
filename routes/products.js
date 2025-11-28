import express from 'express'
import { authMiddleware, optionalAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../lib/supabaseClient.js'

const router = express.Router();

// ===== Helper: parse images stored as comma-separated VARCHAR =====
function parseImages(rawImages) {
  if (!rawImages) return [];
  if (Array.isArray(rawImages)) return rawImages.filter(Boolean);
  if (typeof rawImages === 'string') {
    return rawImages
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

// ===== GET all products =====
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category_id, search, sort = 'newest', min_price, max_price, condition } = req.query
    let query = supabaseAdmin.from('products').select('id,user_id,category_id,name,description,price,condition,images,location,stock,is_sold,view_count,users:users(name,rating),categories:categories(name)')
      .eq('is_sold', false)

    if (category_id) query = query.eq('category_id', category_id)
    if (search) query = query.ilike('name', `%${search}%`) // simple name search
    if (min_price && !isNaN(Number(min_price))) query = query.gte('price', Number(min_price))
    if (max_price && !isNaN(Number(max_price))) query = query.lte('price', Number(max_price))
    if (condition) query = query.eq('condition', condition)

    if (sort === 'price_low') query = query.order('price', { ascending: true })
    else if (sort === 'price_high') query = query.order('price', { ascending: false })
    else if (sort === 'popular') query = query.order('view_count', { ascending: false })
    else query = query.order('id', { ascending: false })

    query = query.limit(100)

    const { data, error } = await query
    if (error) throw error
    const products = (data || []).map(p => ({
      ...p,
      seller_name: p.users?.name,
      rating: p.users?.rating,
      category_name: p.categories?.name,
      images: parseImages(p.images)
    }))
    res.json({ success: true, data: products, count: products.length })
  } catch (error) {
    console.error('[PRODUCTS][GET /] Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===== GET product by ID =====
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    // increment view_count
    await supabaseAdmin.rpc('increment_product_view', { product_id_input: Number(req.params.id) }).catch(() => {})
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id,user_id,category_id,name,description,price,condition,images,location,stock,is_sold,view_count,users:users(id,name,phone,address,city,avatar,rating,total_reviews),categories:categories(name)')
      .eq('id', req.params.id)
      .single()
    if (error?.code === 'PGRST116') return res.status(404).json({ success: false, message: 'Product not found' })
    if (error) throw error
    // fetch recent reviews (simplified: last 5 by seller)
    const { data: reviews } = await supabaseAdmin
      .from('reviews')
      .select('id,rating,comment,created_at,buyer_id')
      .eq('seller_id', data.users.id)
      .order('created_at', { ascending: false })
      .limit(5)
    res.json({
      success: true,
      data: {
        ...data,
        seller_id: data.users.id,
        seller_name: data.users.name,
        phone: data.users.phone,
        address: data.users.address,
        city: data.users.city,
        avatar: data.users.avatar,
        rating: data.users.rating,
        total_reviews: data.users.total_reviews,
        category_name: data.categories?.name,
        images: parseImages(data.images),
        reviews: reviews || []
      }
    })
  } catch (error) {
    console.error('[PRODUCTS][GET/:id] Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===== POST new product =====
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, category_id, price, condition, description, images, location, stock } = req.body
    if (!name || !category_id || !price || !condition || stock === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' })
    }
    const allowed = ['like_new','good','fair','poor']
    if (!allowed.includes(String(condition))) return res.status(400).json({ success: false, message: 'Invalid condition value' })
    const numericPrice = Number(price)
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) return res.status(400).json({ success: false, message: 'Invalid price value' })
    const numericStock = Number(stock)
    if (!Number.isInteger(numericStock) || numericStock < 0) return res.status(400).json({ success: false, message: 'Invalid stock value' })
    const imagesStr = Array.isArray(images) ? images.filter(Boolean).join(',') : String(images || '').trim()
    const { data, error } = await supabaseAdmin
      .from('products')
      .insert([
        {
          user_id: req.user.id,
          category_id,
          name,
          description: description || '',
          price: numericPrice,
          condition,
          images: imagesStr,
          location: location || '',
          stock: numericStock
        }
      ])
      .select('id')
      .single()
    if (error) throw error
    res.status(201).json({ success: true, message: 'Product listed successfully', product_id: data.id })
  } catch (error) {
    console.error('[PRODUCTS][POST /] Insert error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===== PUT update product =====
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, price, condition, description, images, location, stock } = req.body
    // Ownership check
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('products')
      .select('user_id')
      .eq('id', req.params.id)
      .single()
    if (existErr?.code === 'PGRST116') return res.status(404).json({ success: false, message: 'Product not found' })
    if (existErr) throw existErr
    if (existing.user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' })
    const update = {}
    if (name !== undefined) update.name = name
    if (price !== undefined) {
      const num = Number(price); if (!Number.isFinite(num) || num <= 0) return res.status(400).json({ success:false,message:'Invalid price value' }); update.price = num
    }
    if (condition !== undefined) update.condition = condition
    if (description !== undefined) update.description = description || ''
    if (images !== undefined) update.images = Array.isArray(images) ? images.filter(Boolean).join(',') : String(images||'').trim()
    if (location !== undefined) update.location = location || ''
    if (stock !== undefined) { const ns = Number(stock); if (!Number.isInteger(ns) || ns < 0) return res.status(400).json({ success:false,message:'Invalid stock value' }); update.stock = ns }
    const { error } = await supabaseAdmin
      .from('products')
      .update(update)
      .eq('id', req.params.id)
    if (error) throw error
    res.json({ success: true, message: 'Product updated successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===== DELETE product =====
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('user_id')
      .eq('id', req.params.id)
      .single()
    if (prodErr?.code === 'PGRST116') return res.status(404).json({ success:false,message:'Product not found' })
    if (prodErr) throw prodErr
    if (product.user_id !== req.user.id) return res.status(403).json({ success:false,message:'Not authorized' })
    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', req.params.id)
    if (error) throw error
    res.json({ success: true, message: 'Product deleted successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===== GET products by user =====
router.get('/user/:userId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id,user_id,category_id,name,description,price,condition,images,location,stock,is_sold,view_count,categories:categories(name)')
      .eq('user_id', req.params.userId)
      .order('id', { ascending: false })
      .limit(100)
    if (error) throw error
    const mapped = (data||[]).map(p => ({
      ...p,
      category_name: p.categories?.name,
      images: parseImages(p.images)
    }))
    res.json({ success: true, data: mapped })
  } catch (error) {
    console.error('[PRODUCTS][GET /user/:userId] Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router;
