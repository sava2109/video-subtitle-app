import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoPlayer, { VideoSettings, SeekRequest } from '../components/VideoPlayer';
import SubtitleEditor from '../components/SubtitleEditor';
import SubtitleTimeline from '../components/SubtitleTimeline';
import TranscriptPanel from '../components/TranscriptPanel';
import ExportButton from '../components/ExportButton';
import { getVideo, transcribeVideo, updateAllSubtitles, importSRT } from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';
import {
  getMaxCharsPerLine,
  getMaxLines,
  DEFAULT_FONT_SIZE,
  DEFAULT_VERTICAL_POSITION,
  DEFAULT_MAX_BOX_WIDTH_PERCENT,
  DEFAULT_MAX_BOX_HEIGHT,
} from '../utils/subtitleLayout';

interface Subtitle {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

interface Project {
  id: string;
  video: {
    filename: string;
    originalName: string;
    duration?: number;
  };
  subtitles: Subtitle[];
  status: string;
}

interface TranscribeSettings {
  noiseReduction: boolean;
  noiseReductionLevel: number;
  highpassFilter: number;
  lowpassFilter: number;
}

// Трајање новог титла убаченог преко ➕ (у секундама)
const NEW_SUBTITLE_DURATION = 3;

const Editor: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile(900);

  const [project, setProject] = useState<Project | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTranscribeSettings, setShowTranscribeSettings] = useState(false);
  const srtInputRef = useRef<HTMLInputElement>(null);
  const [transcribeSettings, setTranscribeSettings] = useState<TranscribeSettings>({
    noiseReduction: true,
    noiseReductionLevel: 21,
    highpassFilter: 200,
    lowpassFilter: 3000,
  });
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    aspectRatio: '16:9',
    fontSize: DEFAULT_FONT_SIZE,
    verticalPosition: DEFAULT_VERTICAL_POSITION,
    maxBoxWidthPercent: DEFAULT_MAX_BOX_WIDTH_PERCENT,
    maxBoxHeightPx: DEFAULT_MAX_BOX_HEIGHT,
  });
  const [seekRequest, setSeekRequest] = useState<SeekRequest | null>(null);

  // Премотај видео на задато време (клик на траку или на титл)
  const seekTo = (time: number) => {
    setCurrentTime(time);
    setSeekRequest((prev) => ({ time, nonce: (prev?.nonce || 0) + 1 }));
  };

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const response = await getVideo(projectId!);
      if (response.success) {
        setProject(response.data);
        setSubtitles(response.data.subtitles || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTranscribe = async () => {
    try {
      setTranscribing(true);
      setError(null);
      setShowTranscribeSettings(false);
      const response = await transcribeVideo(projectId!, true, transcribeSettings);
      if (response.success) {
        setSubtitles(response.data.subtitles);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTranscribing(false);
    }
  };

  const handleSubtitleChange = (newSubtitles: Subtitle[]) => {
    setSubtitles(newSubtitles);
  };

  const handleSaveSubtitles = async () => {
    try {
      await updateAllSubtitles(projectId!, subtitles);
      alert('Титлови сачувани!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handleSubtitleClick = (subtitle: Subtitle) => {
    seekTo(subtitle.startTime);
  };

  /**
   * ➕ Убаци нови (празан) титл на тренутном времену.
   * Сви титлови који почињу после тог тренутка померају се за трајање
   * новог титла, а титл који је у том тренутку у току сече се на њему.
   */
  const handleInsertAtCurrentTime = () => {
    const t = Math.round(currentTime * 1000) / 1000;

    const shifted = subtitles.map((s) => {
      if (s.startTime >= t) {
        return {
          ...s,
          startTime: s.startTime + NEW_SUBTITLE_DURATION,
          endTime: s.endTime + NEW_SUBTITLE_DURATION,
        };
      }
      if (s.endTime > t) {
        // Титл у току — заврши га на месту убацивања
        return { ...s, endTime: t };
      }
      return s;
    });

    const newSubtitle: Subtitle = {
      id: 0,
      startTime: t,
      endTime: t + NEW_SUBTITLE_DURATION,
      text: '',
    };

    const all = [...shifted, newSubtitle]
      .sort((a, b) => a.startTime - b.startTime)
      .map((s, i) => ({ ...s, id: i + 1 }));

    setSubtitles(all);
  };

  /**
   * 📥 Увоз SRT фајла из било ког (бесплатног) алата.
   */
  const handleImportSRTFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const content = await file.text();
      const response = await importSRT(projectId!, content, true);
      if (response.success) {
        setSubtitles(response.data.subtitles);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      // Ресетуј input да исти фајл може поново да се изабере
      if (srtInputRef.current) srtInputRef.current.value = '';
    }
  };

  if (loading) {
    return <div style={styles.loading}>Учитавање...</div>;
  }

  if (!project) {
    return <div style={styles.error}>Пројекат није пронађен.</div>;
  }

  // Use relative URL in production
  const baseUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';
  const videoUrl = `${baseUrl}/uploads/${project.video.filename}`;

  const maxCharsPerLine = getMaxCharsPerLine(
    videoSettings.aspectRatio, videoSettings.fontSize, videoSettings.maxBoxWidthPercent
  );
  const maxLines = getMaxLines(videoSettings.fontSize, videoSettings.maxBoxHeightPx);

  return (
    <div style={{ ...styles.container, padding: isMobile ? '12px' : '20px' }}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate('/')}>
          ← Назад
        </button>
        <h1 style={styles.title}>{project.video.originalName}</h1>
      </header>

      {error && <div style={styles.errorBanner}>{error}</div>}

      <input
        ref={srtInputRef}
        type="file"
        accept=".srt"
        style={{ display: 'none' }}
        onChange={handleImportSRTFile}
      />

      <div style={{ ...styles.mainContent, gridTemplateColumns: isMobile ? '1fr' : '1fr 400px' }}>
        <div style={styles.videoSection}>
          <VideoPlayer
            videoUrl={videoUrl}
            subtitles={subtitles}
            onTimeUpdate={handleTimeUpdate}
            settings={videoSettings}
            onSettingsChange={setVideoSettings}
            onAddSubtitleAtCurrentTime={handleInsertAtCurrentTime}
            seekRequest={seekRequest}
          />

          <div style={styles.controls}>
            {subtitles.length === 0 ? (
              <div style={styles.transcribeControls}>
                <button
                  style={styles.transcribeButton}
                  onClick={handleTranscribe}
                  disabled={transcribing}
                >
                  {transcribing ? '⏳ Транскрибовање...' : '🎤 Генериши Титлове'}
                </button>
                <button
                  style={styles.settingsBtn}
                  onClick={() => setShowTranscribeSettings(!showTranscribeSettings)}
                  disabled={transcribing}
                >
                  ⚙️
                </button>
                <button
                  style={styles.importBtn}
                  onClick={() => srtInputRef.current?.click()}
                >
                  📥 Увези SRT
                </button>
              </div>
            ) : (
              <>
                <button style={styles.saveButton} onClick={handleSaveSubtitles}>
                  💾 Сачувај
                </button>
                <ExportButton
                  projectId={projectId!}
                  videoSettings={videoSettings}
                  subtitles={subtitles}
                />
                <button
                  style={styles.importBtn}
                  onClick={() => srtInputRef.current?.click()}
                >
                  📥 Увези SRT
                </button>
                <button
                  style={styles.retranscribeBtn}
                  onClick={() => setShowTranscribeSettings(true)}
                >
                  🔄 Поново
                </button>
              </>
            )}
          </div>

          {/* Transcription Settings Panel */}
          {showTranscribeSettings && (
            <div style={styles.settingsPanel}>
              <h3 style={styles.settingsTitle}>🎤 Подешавања транскрипције</h3>

              <div style={styles.settingRow}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={transcribeSettings.noiseReduction}
                    onChange={(e) => setTranscribeSettings({
                      ...transcribeSettings,
                      noiseReduction: e.target.checked
                    })}
                  />
                  🔇 Уклањање позадинске буке
                </label>
              </div>

              {transcribeSettings.noiseReduction && (
                <>
                  <div style={styles.settingRow}>
                    <label style={styles.settingLabel}>
                      Ниво уклањања буке: {transcribeSettings.noiseReductionLevel}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={transcribeSettings.noiseReductionLevel}
                      onChange={(e) => setTranscribeSettings({
                        ...transcribeSettings,
                        noiseReductionLevel: parseInt(e.target.value)
                      })}
                      style={styles.slider}
                    />
                    <span style={styles.hint}>Веће = агресивније (може утицати на глас)</span>
                  </div>

                  <div style={styles.settingRow}>
                    <label style={styles.settingLabel}>
                      Highpass филтер: {transcribeSettings.highpassFilter} Hz
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="500"
                      step="50"
                      value={transcribeSettings.highpassFilter}
                      onChange={(e) => setTranscribeSettings({
                        ...transcribeSettings,
                        highpassFilter: parseInt(e.target.value)
                      })}
                      style={styles.slider}
                    />
                    <span style={styles.hint}>Уклања ниске фреквенције (клима, саобраћај)</span>
                  </div>

                  <div style={styles.settingRow}>
                    <label style={styles.settingLabel}>
                      Lowpass филтер: {transcribeSettings.lowpassFilter} Hz
                    </label>
                    <input
                      type="range"
                      min="2000"
                      max="8000"
                      step="500"
                      value={transcribeSettings.lowpassFilter}
                      onChange={(e) => setTranscribeSettings({
                        ...transcribeSettings,
                        lowpassFilter: parseInt(e.target.value)
                      })}
                      style={styles.slider}
                    />
                    <span style={styles.hint}>Фокус на глас (2000-4000 Hz оптимално)</span>
                  </div>
                </>
              )}

              <div style={styles.settingsActions}>
                <button style={styles.applyBtn} onClick={handleTranscribe} disabled={transcribing}>
                  {transcribing ? '⏳ Обрада...' : '🎤 Генериши са овим подешавањима'}
                </button>
                <button style={styles.cancelBtn} onClick={() => setShowTranscribeSettings(false)}>
                  Откажи
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={styles.editorSection}>
          <SubtitleTimeline
            subtitles={subtitles}
            currentTime={currentTime}
            duration={project.video.duration || 0}
            onSubtitleClick={handleSubtitleClick}
            onSeek={seekTo}
          />

          <TranscriptPanel
            subtitles={subtitles}
            onChange={handleSubtitleChange}
          />

          <SubtitleEditor
            subtitles={subtitles}
            currentTime={currentTime}
            onChange={handleSubtitleChange}
            onInsertAtCurrentTime={handleInsertAtCurrentTime}
            maxCharsPerLine={maxCharsPerLine}
            maxLines={maxLines}
          />
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px',
    gap: '20px',
    flexWrap: 'wrap',
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: '#f0f0f0',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    wordBreak: 'break-word',
  },
  loading: {
    textAlign: 'center',
    padding: '100px',
    fontSize: '1.2rem',
  },
  error: {
    textAlign: 'center',
    padding: '100px',
    color: '#dc3545',
  },
  errorBanner: {
    padding: '10px 20px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 400px',
    gap: '20px',
  },
  videoSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  controls: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  transcribeControls: {
    display: 'flex',
    gap: '5px',
    flexWrap: 'wrap',
  },
  transcribeButton: {
    padding: '12px 24px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  settingsBtn: {
    padding: '12px 14px',
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  importBtn: {
    padding: '12px 16px',
    backgroundColor: '#17a2b8',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  retranscribeBtn: {
    padding: '12px 16px',
    backgroundColor: '#ffc107',
    color: '#212529',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  saveButton: {
    padding: '12px 24px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  settingsPanel: {
    backgroundColor: '#f8f9fa',
    padding: '20px',
    borderRadius: '8px',
    marginTop: '10px',
  },
  settingsTitle: {
    margin: '0 0 15px 0',
    fontSize: '1.1rem',
  },
  settingRow: {
    marginBottom: '15px',
  },
  settingLabel: {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 'bold',
    fontSize: '0.9rem',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '0.95rem',
  },
  slider: {
    width: '100%',
    cursor: 'pointer',
  },
  hint: {
    display: 'block',
    fontSize: '0.8rem',
    color: '#666',
    marginTop: '3px',
  },
  settingsActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
  },
  applyBtn: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  cancelBtn: {
    padding: '10px 20px',
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  editorSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
};

export default Editor;
