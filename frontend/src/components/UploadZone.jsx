import { useState, useRef } from 'react';
import { Upload, Image, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { extractTextFromPDF } from '../utils/pdfExtractor';

const ACCEPTED_IMAGE = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export default function UploadZone({ onTextReady, onImageReady, loading }) {
  const [dragOver, setDragOver]     = useState(false);
  const [fileName, setFileName]     = useState('');
  const [mode, setMode]             = useState('upload');
  const [error, setError]           = useState('');
  const [extracting, setExtracting] = useState(false);
  const [imgPreview, setImgPreview] = useState('');
  const [imgFile, setImgFile]       = useState(null);
  const pdfRef   = useRef();
  const imgRef   = useRef();

  const switchMode = (m) => { setMode(m); setError(''); setFileName(''); setImgPreview(''); setImgFile(null); };

  const handlePDF = async (file) => {
    setError('');
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('Only PDF files here. Use "Snapshot" for images.'); return; }
    setFileName(file.name);
    setExtracting(true);
    try {
      const text = await extractTextFromPDF(file);
      if (!text.trim()) throw new Error('No text found. Try the Snapshot tab instead.');
      onTextReady(text, file.name, 'pdf', file);
    } catch (e) { setError(e.message); }
    finally { setExtracting(false); }
  };

  const handleImg = (file) => {
    setError('');
    if (!ACCEPTED_IMAGE.includes(file?.type)) { setError('Supported: PNG, JPG, WEBP, GIF'); return; }
    setImgFile(file);
    setFileName(file.name);
    const r = new FileReader();
    r.onload = e => setImgPreview(e.target.result);
    r.readAsDataURL(file);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    mode === 'image' ? handleImg(file) : handlePDF(file);
  };

  return (
    <div className="animate-fade-up">
      <div className="tabs mb-16">
        {[['upload', Upload, 'Upload PDF'], ['image', Image, 'Snapshot']].map(([id, Icon, label]) => (
          <button key={id} id={`tab-${id}`} className={`tab-btn ${mode === id ? 'active' : ''}`} onClick={() => switchMode(id)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {mode === 'upload' && (
        <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
          onClick={() => pdfRef.current.click()} id="pdf-dropzone"
          style={{ border: `2px dashed ${dragOver ? 'var(--blue)' : fileName ? 'var(--emerald)' : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-lg)', padding: '48px 32px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'var(--blue-glow)' : fileName ? 'var(--emerald-glow)' : 'var(--bg-secondary)', transition: 'all var(--transition)' }}>
          <input ref={pdfRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handlePDF(e.target.files[0])} />
          {extracting ? <div className="flex flex-col items-center gap-12"><div className="spinner" /><p className="text-sm text-muted">Reading PDF…</p></div>
            : fileName ? <div className="flex flex-col items-center gap-8"><CheckCircle2 size={40} color="var(--emerald)" /><p style={{ color: 'var(--emerald)', fontWeight: 600 }}>{fileName}</p></div>
            : <div className="flex flex-col items-center gap-12">
                <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--blue-glow)', border: '1px solid rgba(99,179,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Upload size={28} color="var(--blue)" /></div>
                <div><p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>Drop PDF here</p><p className="text-sm text-muted">or click to browse</p></div>
              </div>}
        </div>
      )}

      {mode === 'image' && (
        <div>
          {!imgPreview ? (
            <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
              onClick={() => imgRef.current.click()} id="image-dropzone"
              style={{ border: `2px dashed ${dragOver ? 'var(--purple)' : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-lg)', padding: '48px 32px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'var(--purple-glow)' : 'var(--bg-secondary)', transition: 'all var(--transition)' }}>
              <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImg(e.target.files[0])} />
              <div className="flex flex-col items-center gap-12">
                <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--purple-glow)', border: '1px solid rgba(183,148,244,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Image size={28} color="var(--purple)" /></div>
                <div><p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>Upload statement photo</p><p className="text-sm text-muted">PNG · JPG · WEBP · GIF · Analyzed by Gemini Vision</p></div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-subtle)', marginBottom: 14 }}>
                <img src={imgPreview} alt="Statement" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', background: 'var(--bg-primary)', display: 'block' }} />
                <button onClick={() => { setImgFile(null); setImgPreview(''); setFileName(''); }} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.7)', border: '1px solid var(--border-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><X size={14} /></button>
              </div>
              <p className="text-xs text-muted mb-16">📸 {fileName}</p>
              <button className="btn btn-primary" id="btn-analyze-image" onClick={() => onImageReady(imgFile, imgFile.name, 'image')} disabled={loading}><Image size={16} /> Analyze Snapshot</button>
            </div>
          )}
        </div>
      )}

      {error && <div className="alert alert-danger mt-16"><AlertCircle size={15} /><span>{error}</span></div>}
    </div>
  );
}
