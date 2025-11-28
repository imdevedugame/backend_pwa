import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { supabaseAdmin } from '../lib/supabaseClient.js'

// NOTE: This route now expects files sent as base64 or using form-data streaming handled manually.
// For simplicity we accept JSON { files: [{ name, base64 }] }

const router = express.Router();

// POST upload images
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { files } = req.body // expecting array of { name, base64 }
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success:false,message:'No files provided' })
    }
    const results = []
    for (const f of files.slice(0,5)) {
      if (!f?.name || !f?.base64) continue
      const buffer = Buffer.from(f.base64, 'base64')
      const filename = `products/${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`
      const { data, error } = await supabaseAdmin.storage
        .from('product-images')
        .upload(filename, buffer, { contentType: 'image/*', upsert: false })
      if (error) {
        console.error('[UPLOAD] Error:', error.message)
        continue
      }
      const publicUrl = supabaseAdmin.storage.from('product-images').getPublicUrl(data.path).data.publicUrl
      results.push({ filename: f.name, path: publicUrl })
    }
    if (results.length === 0) return res.status(500).json({ success:false,message:'Failed to upload files' })
    res.json({ success:true,message:'Files uploaded successfully', files: results })
  } catch (error) {
    res.status(500).json({ success:false,message:error.message })
  }
})

export default router;
