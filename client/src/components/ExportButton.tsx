import React, { useState, useEffect } from 'react';
import { exportVideo, downloadSRT, downloadVTT } from '../services/api';
import { VideoSettings } from './VideoPlayer';

type AspectRatio = '16:9' | '9:16' | '1:1';
type SubtitlePosition = 'top' | 'center' | 'bottom';

interface ExportButtonProps {
  projectId: string;
  videoSettings?: VideoSettings;
}

const ExportButton: React.FC<ExportButtonProps> = ({ projectId, videoSettings }) => {
  const [exporting, setExporting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  // Use settings from video preview
  const currentSettings = videoSettings || {
    aspectRatio: '16:9' as AspectRatio,
    subtitlePosition: 'bottom' as SubtitlePosition,
    fontSize: 24,
  };

  const handleExportVideo = async () => {
    try {
      setExporting(true);
      const response = await exportVideo(projectId, {
        burnSubtitles: true,
        aspectRatio: currentSettings.aspectRatio,
        subtitlePosition: currentSettings.subtitlePosition,
        fontSize: currentSettings.fontSize,
      });
      
      if (response.success && response.data?.downloadUrl) {
        // Use relative URL in production
        const baseUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';
        window.open(`${baseUrl}${response.data.downloadUrl}`, '_blank');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Грешка при експортовању видеа.');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadSRT = async () => {
    try {
      const blob = await downloadSRT(projectId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'titlovi.srt';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Грешка при преузимању SRT фајла.');
    }
  };

  const handleDownloadVTT = async () => {
    try {
      const blob = await downloadVTT(projectId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'titlovi.vtt';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Грешка при преузимању VTT фајла.');
    }
  };

  return (
    <div style={styles.container}>
      <button
        style={styles.mainButton}
        onClick={() => setShowOptions(!showOptions)}
        disabled={exporting}
      >
        {exporting ? '⏳ Експортовање...' : '📤 Експортуј'}
      </button>

      {showOptions && (
        <div style={styles.dropdown}>
          <div style={styles.previewInfo}>
            <p style={styles.previewText}>
              <strong>Тренутна подешавања:</strong><br/>
              📐 {currentSettings.aspectRatio} • 
              📍 {currentSettings.subtitlePosition === 'top' ? 'горе' : currentSettings.subtitlePosition === 'center' ? 'средина' : 'доле'} • 
              🔤 {currentSettings.fontSize}px
            </p>
            <p style={styles.hint}>
              ⚙️ Користи "Подешавања приказа" изнад видеа за измене
            </p>
          </div>

          <button 
            style={styles.exportButton} 
            onClick={handleExportVideo}
            disabled={exporting}
          >
            🎬 {exporting ? 'Обрада...' : 'Експортуј видео'}
          </button>

          <hr style={styles.divider} />

          <div style={styles.subtitleDownloads}>
            <button style={styles.downloadBtn} onClick={handleDownloadSRT}>
              📄 Преузми SRT
            </button>
            <button style={styles.downloadBtn} onClick={handleDownloadVTT}>
              📄 Преузми VTT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'relative',
    display: 'inline-block',
  },
  mainButton: {
    padding: '12px 24px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '5px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    overflow: 'hidden',
    zIndex: 100,
    minWidth: '320px',
    padding: '16px',
  },
  previewInfo: {
    backgroundColor: '#f8f9fa',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '12px',
  },
  previewText: {
    margin: '0 0 8px 0',
    fontSize: '0.9rem',
    lineHeight: '1.6',
  },
  hint: {
    margin: '0',
    fontSize: '0.8rem',
    color: '#666',
  },
  divider: {
    margin: '12px 0',
    border: 'none',
    borderTop: '1px solid #eee',
  },
  exportButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  subtitleDownloads: {
    display: 'flex',
    gap: '8px',
  },
  downloadBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
};

export default ExportButton;