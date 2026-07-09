'use client';

import { useRef, useState } from 'react';
import { extractRepxFromFile } from '@/lib/repx';
import type { RepxExtractResult } from '@/lib/repx';

const REPX_FEATURES = [
  { value: 'extract-images', label: 'Đọc ảnh / logo nhúng' },
  {
    value: 'add-qhns-cccd',
    label: 'Thêm Mã QHNS & Căn cước công dân',
  },
] as const;

type RepxFeature = (typeof REPX_FEATURES)[number]['value'];

export default function RepxExtractor() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feature, setFeature] = useState<RepxFeature>('extract-images');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RepxExtractResult | null>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.repx')) {
      setError('Vui lòng chọn file .repx');
      return;
    }

    setFileName(file.name);
    setLoading(true);
    setError('');
    setResult(null);

    if (feature !== 'extract-images') {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError(
        'Tính năng "Thêm Mã QHNS & Căn cước công dân" đang phát triển — chưa xử lý file.',
      );
      return;
    }

    try {
      const data = await extractRepxFromFile(file);
      setResult(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không đọc được file REPX.';
      setError(message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const embeddedImages =
    result?.images.filter((img) => img.source === 'embedded') ?? [];
  const otherImages =
    result?.images.filter((img) => img.source !== 'embedded') ?? [];

  return (
    <div className="container">
      <header className="header">
        <h1>Xử lý REPX 1.0</h1>
        <p>
          Chọn tính năng và upload file .repx. Hiện chỉ{' '}
          <strong>Đọc ảnh / logo nhúng</strong> đã hoạt động.
        </p>
      </header>

      <div className="feature-select">
        <label htmlFor="repx-feature">Tính năng</label>
        <select
          id="repx-feature"
          value={feature}
          onChange={(e) => {
            setFeature(e.target.value as RepxFeature);
            setError('');
            setResult(null);
          }}
          disabled={loading}
        >
          {REPX_FEATURES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="upload-box">
        <input
          ref={fileInputRef}
          type="file"
          accept=".repx"
          onChange={handleFileChange}
          disabled={loading}
          id="repx-file-input"
          hidden
        />
        <label
          htmlFor="repx-file-input"
          className={`upload-btn ${loading ? 'disabled' : ''}`}
        >
          {loading ? 'Đang đọc file...' : 'Chọn file .repx'}
        </label>
        {fileName && <div className="file-name">File: {fileName}</div>}
      </div>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div className="result">
          <div className="summary">
            <strong>Tổng quan:</strong> {result.summary.totalPictureBoxes}{' '}
            PictureBox — {result.summary.embeddedCount} ảnh nhúng,{' '}
            {result.summary.boundCount} bind/không có ảnh,{' '}
            {result.summary.urlCount} URL — định dạng:{' '}
            <strong>{result.format.toUpperCase()}</strong>
            {result.format === 'codedom' &&
              result.codedomMeta?.devExpressVersion && (
                <> (DevExpress v{result.codedomMeta.devExpressVersion})</>
              )}
          </div>

          {embeddedImages.length > 0 && (
            <section>
              <h2>Ảnh nhúng ({embeddedImages.length})</h2>
              <div className="image-grid">
                {embeddedImages.map((img) => (
                  <article key={img.name} className="image-card">
                    {img.dataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.dataUrl} alt={img.name} />
                    )}
                    <div className="image-meta">
                      <strong>{img.name}</strong>
                      <span>{img.mimeType}</span>
                      <span>
                        {img.resourceKey ? `Resource: ${img.resourceKey}` : ''}
                        {img.sizeBytes != null
                          ? `${img.resourceKey ? ' · ' : ''}${(img.sizeBytes / 1024).toFixed(1)} KB`
                          : ''}
                      </span>
                      {img.dataUrl && (
                        <a href={img.dataUrl} download={`${img.name}.png`}>
                          Tải ảnh
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {otherImages.length > 0 && (
            <section>
              <h2>PictureBox khác ({otherImages.length})</h2>
              <table>
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Loại</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {otherImages.map((img) => (
                    <tr key={img.name}>
                      <td>{img.name}</td>
                      <td>{img.source}</td>
                      <td>{img.expression || img.imageUrl || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {embeddedImages.length === 0 && otherImages.length === 0 && (
            <p className="muted">Không tìm thấy XRPictureBox trong file.</p>
          )}
        </div>
      )}
    </div>
  );
}
