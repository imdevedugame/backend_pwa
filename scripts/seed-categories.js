#!/usr/bin/env node
import { supabaseAdmin } from '../lib/supabaseClient.js'

// Target categories (description optional; adjust table columns if needed)
const categories = [
  { name: 'Electronics', icon: '📱' },
  { name: 'Fashion', icon: '👗' },
  { name: 'Furniture', icon: '🪑' },
  { name: 'Books', icon: '📚' },
  { name: 'Sports', icon: '⚽' },
  { name: 'Toys', icon: '🎮' },
  { name: 'Home & Kitchen', icon: '🍳' },
  { name: 'Beauty', icon: '💄' },
  { name: 'Automotive', icon: '🚗' },
  { name: 'Other', icon: '🏷️' }
]

async function seed() {
  console.log('[Seed] Checking existing categories ...')
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('categories')
    .select('id,name,icon')

  if (fetchErr) {
    console.error('[Seed] Failed to fetch existing categories:', fetchErr.message)
    process.exit(1)
  }

  const existingNames = new Set((existing || []).map(c => c.name))
  const missing = categories.filter(c => !existingNames.has(c.name))

  if (missing.length === 0) {
    console.log('[Seed] No new categories to insert. Already complete.')
    console.table(existing.map(c => ({ id: c.id, name: c.name, icon: c.icon })))
    process.exit(0)
  }

  console.log(`[Seed] Inserting ${missing.length} new categories ...`) 
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('categories')
    .insert(missing)
    .select('id,name,icon')

  if (insertErr) {
    console.error('[Seed] Insert failed:', insertErr.message)
    process.exit(1)
  }

  const all = [...(existing || []), ...(inserted || [])]
  console.log(`[Seed] Done. Total categories now: ${all.length}`)
  console.table(all.map(c => ({ id: c.id, name: c.name, icon: c.icon })))
  process.exit(0)
}

seed()
