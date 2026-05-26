import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';

const router        = Router();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET /api/history
router.get('/', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('analyses')
    .select('id, created_at, file_name, file_type, file_url, currency, total_debit, total_credit, txn_count')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/history/:id
router.get('/:id', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('analyses')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (error) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// DELETE /api/history/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // 1. Fetch the analysis to get the file_url
    const { data: analysis, error: fetchErr } = await supabaseAdmin
      .from('analyses')
      .select('file_url')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchErr) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // 2. If a statement file is stored, delete it from Supabase Storage
    if (analysis && analysis.file_url && analysis.file_url.includes('/storage/v1/object/')) {
      try {
        const parts = analysis.file_url.split('/storage/v1/object/');
        const pathPart = parts[1];
        const pathParts = pathPart.split('/');
        const bucket = pathParts[1];
        const storagePath = pathParts.slice(2).join('/');

        const { error: rmErr } = await supabaseAdmin.storage
          .from(bucket)
          .remove([storagePath]);

        if (rmErr) {
          console.error(`Failed to delete storage file: ${storagePath}`, rmErr.message);
        } else {
          console.log(`Successfully deleted storage file: ${storagePath}`);
        }
      } catch (parseErr) {
        console.error('Error parsing file URL for deletion:', parseErr.message);
      }
    }

    // 3. Delete the database row
    const { error: deleteErr } = await supabaseAdmin
      .from('analyses')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (deleteErr) return res.status(500).json({ error: deleteErr.message });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/history/:id/file
router.get('/:id/file', authMiddleware, async (req, res) => {
  try {
    const { data: analysis, error } = await supabaseAdmin
      .from('analyses')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !analysis) return res.status(404).json({ error: 'Analysis not found' });
    if (!analysis.file_url) return res.status(404).json({ error: 'No file associated with this analysis' });

    // Parse bucket and storage path from the file_url
    // e.g. https://...supabase.co/storage/v1/object/public/statements/userId/filename.pdf
    const urlStr = analysis.file_url;
    if (!urlStr.includes('/storage/v1/object/')) {
      return res.status(400).json({ error: 'Invalid file URL' });
    }
    const parts = urlStr.split('/storage/v1/object/');
    const pathPart = parts[1];
    const pathParts = pathPart.split('/');
    const bucket = pathParts[1]; // "statements" or "snapshots"
    const storagePath = pathParts.slice(2).join('/'); // "userId/filename.pdf"

    const { data, error: dlError } = await supabaseAdmin.storage
      .from(bucket)
      .download(storagePath);

    if (dlError || !data) {
      console.error('Storage download error:', dlError);
      return res.status(500).json({ error: 'Failed to download file from storage' });
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    
    let contentType = 'application/pdf';
    if (analysis.file_type === 'image') {
      if (analysis.file_name.toLowerCase().endsWith('.png')) contentType = 'image/png';
      else if (analysis.file_name.toLowerCase().endsWith('.webp')) contentType = 'image/webp';
      else if (analysis.file_name.toLowerCase().endsWith('.gif')) contentType = 'image/gif';
      else contentType = 'image/jpeg';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${analysis.file_name}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
