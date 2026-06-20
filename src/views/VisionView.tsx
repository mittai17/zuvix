import { useState, useRef } from 'react';
import { config } from '../config';
import { Image, Upload, Search, Loader, Camera, Eye } from 'lucide-react';

const API = config.API_BASE;

export default function VisionView() {
  const [imageData, setImageData] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('Describe this image in detail. What do you see?');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewUrl(dataUrl);
      setImageData(dataUrl);
      setResult(null);
    };
    reader.readAsDataURL(file);
  }

  function handleUrl() {
    const url = window.prompt('Enter image URL:');
    if (url) {
      setPreviewUrl(url);
      setImageData(url);
      setResult(null);
    }
  }

  async function analyze() {
    if (!imageData) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/vision/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData, prompt }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Eye size={18} /> Vision Analysis
      </h2>

      {/* Upload */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderRadius: 12, padding: 16, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={() => fileRef.current?.click()} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
            border: 'none', background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            <Upload size={14} /> Upload Image
          </button>
          <button onClick={handleUrl} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
            border: '1px solid var(--card-border)', background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer',
          }}>
            <Camera size={14} /> Image URL
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        </div>

        {previewUrl && (
          <div style={{ marginBottom: 12 }}>
            <img src={previewUrl} alt="Preview" style={{
              maxWidth: '100%', maxHeight: 300, borderRadius: 8,
              border: '1px solid var(--card-border)', objectFit: 'contain',
            }} />
          </div>
        )}

        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={2}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)',
            background: 'rgba(0,0,0,0.2)', color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical',
            marginBottom: 12,
          }}
        />

        <button onClick={analyze} disabled={loading || !imageData} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8,
          border: 'none', background: loading || !imageData ? '#555' : '#3b82f6', color: '#fff',
          fontSize: 13, fontWeight: 600, cursor: loading || !imageData ? 'not-allowed' : 'pointer',
        }}>
          {loading ? <Loader size={16} className="spin" /> : <Search size={16} />}
          {loading ? 'Analyzing...' : 'Analyze Image'}
        </button>
        {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</p>}
      </div>

      {/* Result */}
      {result && (
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image size={14} />
            Analysis
            {result.processingTime && (
              <span style={{ color: '#555', fontWeight: 400, fontSize: 10 }}>{result.processingTime}ms</span>
            )}
            <span style={{ color: '#555', fontWeight: 400, fontSize: 10 }}>· {result.model}</span>
          </div>

          {result.description && (
            <div style={{
              padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 8,
              fontSize: 13, color: '#ccc', lineHeight: 1.6, marginBottom: 12,
            }}>
              {result.description}
            </div>
          )}

          {result.objects && result.objects.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4 }}>Detected Objects</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {result.objects.map((obj: string, i: number) => (
                  <span key={i} style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 11,
                    background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
                    border: '1px solid rgba(59,130,246,0.2)',
                  }}>{obj}</span>
                ))}
              </div>
            </div>
          )}

          {result.text && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4 }}>Extracted Text</div>
              <pre style={{
                padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 8,
                fontSize: 12, color: '#10b981', maxHeight: 200, overflow: 'auto',
                whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)',
              }}>{result.text}</pre>
            </div>
          )}

          {result.error && (
            <p style={{ color: '#ef4444', fontSize: 12 }}>{result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
