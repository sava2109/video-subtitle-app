import React, { useState, useEffect, useRef } from 'react';
import { exportVideo, getExportStatus, downloadSRT, downloadVTT, updateAllSubtitles } from '../services/api';
import { VideoSettings } from './VideoPlayer';
import { useIsMobile } from '../hooks/useIsMobile';

interface Subtitle {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

interface ExportButtonProps {
  projectId: string;
  videoSettings?: VideoSettings;
  subtitles?: Subtitle[];
}

interface LastExport {
  savedTo: string;
  filename: string;
  downloadUrl: string;
}

const ExportButton: React.FC<ExportButtonProps> = ({ projectId, videoSettings, subtitles }) => {
  const isMobile = useIsMobile(500);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [lastExport, setLastExport] = useState<LastExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use settings from video preview
  const currentSettings = videoSettings || {
    aspectRatio: '16:9' as const,
    fontSize: 64,
    verticalPosition: 95,
    maxBoxWidthPercent: 92,
    maxBoxHeightPx: 145,
  };

  const baseUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';

  // Заустави поллинг ако се компонента угаси
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleExportVideo = async () => {
    try {
      setExporting(true);
      setProgress(0);
      setError(null);
      setLastExport(null);

      // Прво сачувај тренутне титлове да експорт види последње измене
      if (subtitles && subtitles.length > 0) {
        await updateAllSubtitles(projectId, subtitles);
      }

      const response = await exportVideo(projectId, {
        burnSubtitles: true,
        aspectRatio: currentSettings.aspectRatio,
        fontSize: currentSettings.fontSize,
        verticalPosition: currentSettings.verticalPosition,
        maxBoxWidthPercent: currentSettings.maxBoxWidthPercent,
        maxBoxHeightPx: currentSettings.maxBoxHeightPx,
      });

      const jobId = response?.data?.jobId;
      if (!response.success || !jobId) {
        throw new Error(response?.error || 'Експорт није покренут.');
      }

      // Прати напредак сваке секунде
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await getExportStatus(jobId);
          const job = statusRes?.data;
          if (!job) return;

          setProgress(job.progress ?? 0);

          if (job.status === 'done') {
            stopPolling();
            setExporting(false);
            setProgress(100);
            setLastExport({
              savedTo: job.savedTo || '',
              filename: job.filename || '',
              downloadUrl: job.downloadUrl,
            });
            window.open(`${baseUrl}${job.downloadUrl}`, '_blank');
          } else if (job.status === 'error') {
            stopPolling();
            setExporting(false);
            setError(job.error || 'Грешка при експортовању видеа.');
          }
        } catch {
          // прескочи неуспео упит — покушаће поново за 1s
        }
      }, 1000);
    } catch (err: any) {
      stopPolling();
      setExporting(false);
      console.error('Export error:', err);
      setError(err.response?.data?.error || err.message || 'Грешка при експортовању видеа.');
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
        style={{
          ...styles.mainButton,
          ...(exporting ? styles.mainButtonExporting : {}),
        }}
        onClick={() => setShowOptions(!showOptions)}
      >
        {exporting ? (
          <>
            {/* Прогрес испуна унутар самог дугмета */}
            <span style={{ ...styles.buttonProgressFill, width: `${progress}%` }} />
            <span style={styles.buttonLabel}>⏳ Експортовање… {progress}%</span>
          </>
        ) : (
          <span style={styles.buttonLabel}>🎬 Експортуј видео</span>
        )}
      </button>

      {showOptions && (
        <div
          style={
            isMobile
              ? {
                  ...styles.dropdown,
                  position: 'fixed',
                  left: '12px',
                  right: '12px',
                  top: 'auto',
                  bottom: '12px',
                  minWidth: 0,
                  maxHeight: '80vh',
                  overflowY: 'auto',
                }
              : styles.dropdown
          }
        >
          <div style={styles.previewInfo}>
            <p style={styles.previewText}>
              <strong>Тренутна подешавања:</strong><br/>
              📐 {currentSettings.aspectRatio} •
              📍 {currentSettings.verticalPosition}% висине •
              🔤 {currentSettings.fontSize}px<br/>
              ↔️ {currentSettings.maxBoxWidthPercent}% ширине •
              ↕️ {currentSettings.maxBoxHeightPx}px кутија
            </p>
            <p style={styles.hint}>
              ⚙️ Користи "Подешавања приказа" изнад видеа за измене.
              Титлови се аутоматски чувају пре експорта.
            </p>
          </div>

          <button
            style={{
              ...styles.exportButton,
              ...(exporting ? styles.exportButtonDisabled : {}),
            }}
            onClick={handleExportVideo}
            disabled={exporting}
          >
            {exporting ? `⏳ Обрада… ${progress}%` : '🎬 Експортуј видео са титловима'}
          </button>

          {exporting && (
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
              <span style={styles.progressLabel}>{progress}%</span>
            </div>
          )}

          {error && <div style={styles.errorBox}>❌ {error}</div>}

          {lastExport && (
            <div style={styles.savedBox}>
              <strong>✅ Сачувано:</strong>
              <div style={styles.savedPath}>{lastExport.savedTo}</div>
              <button
                style={styles.downloadAgainBtn}
                onClick={() => window.open(`${baseUrl}${lastExport.downloadUrl}`, '_blank')}
              >
                ⬇️ Преузми поново
              </button>
            </div>
          )}

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
    position: 'relative',
    overflow: 'hidden',
    padding: '12px 24px',
    background: 'linear-gradient(180deg, #37b24d, #2b8a3e)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
    minWidth: '210px',
    boxShadow: '0 2px 6px rgba(43,138,62,0.35)',
  },
  mainButtonExporting: {
    background: '#212529',
    cursor: 'progress',
  },
  buttonProgressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    background: 'linear-gradient(180deg, #37b24d, #2b8a3e)',
    transition: 'width 0.4s ease',
    zIndex: 0,
  },
  buttonLabel: {
    position: 'relative',
    zIndex: 1,
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
    minWidth: '340px',
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
    background: 'linear-gradient(180deg, #37b24d, #2b8a3e)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  exportButtonDisabled: {
    background: '#adb5bd',
    cursor: 'progress',
  },
  progressTrack: {
    position: 'relative',
    marginTop: '10px',
    height: '22px',
    backgroundColor: '#e9ecef',
    borderRadius: '11px',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    background: 'linear-gradient(90deg, #4dabf7, #1971c2)',
    transition: 'width 0.4s ease',
  },
  progressLabel: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    lineHeight: '22px',
    color: '#212529',
  },
  errorBox: {
    marginTop: '10px',
    padding: '10px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '6px',
    fontSize: '0.85rem',
  },
  savedBox: {
    marginTop: '10px',
    padding: '10px',
    backgroundColor: '#d4edda',
    color: '#155724',
    borderRadius: '6px',
    fontSize: '0.85rem',
  },
  savedPath: {
    margin: '6px 0',
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    wordBreak: 'break-all',
    backgroundColor: '#fff',
    padding: '6px',
    borderRadius: '4px',
    border: '1px solid #c3e6cb',
  },
  downloadAgainBtn: {
    padding: '6px 12px',
    backgroundColor: '#155724',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
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
