import express from 'express'
import { supabaseAdmin } from '../lib/supabaseClient.js'

const router = express.Router();

// GET all categories
router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('name', { ascending: true })
    if (error) throw error
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET category by ID
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('id', req.params.id)
      .single()
    if (error?.code === 'PGRST116') { // not found
      return res.status(404).json({ success: false, message: 'Category not found' })
    }
    if (error) throw error
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router;
