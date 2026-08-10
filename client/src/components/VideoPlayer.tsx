import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  AspectRatio,
  TARGET_DIMS,
  LINE_HEIGHT_RATIO,
  LINE_GAP_RATIO,
  BOX_PADDING_RATIO,
  DEFAULT_FONT_SIZE,
  DEFAULT_VERTICAL_POSITION,
  DEFAULT_MAX_BOX_WIDTH_PERCENT,
  DEFAULT_MAX_BOX_HEIGHT,
  getMaxCharsPerLine,
  getMaxLines,
  getDisplayTextAtTime,
} from '../utils/subtitleLayout';
import { useIsMobile } from '../hooks/useIsMobile';
import { ensureCyrillic } from '../utils/latinToCyrillic';

interface Subtitle {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

export interface VideoSettings {
  aspectRatio: AspectRatio;
  fontSize: number; // пиксели у ИЗЛАЗНОМ видеу (нпр. на 1080p)
  verticalPosition: number; // доња ивица титла, % висине видеа од врха
  maxBoxWidthPercent: number; // макс. ширина кутије, % ширине видеа
  maxBoxHeightPx: number; // макс. висина кутије у px излазног видеа
}

export interface SeekRequest {
  time: number;
  nonce: number;
}

interface VideoPlayerProps {
  videoUrl: string;
  subtitles: Subtitle[];
  onTimeUpdate?: (time: number) => void;
  settings?: VideoSettings;
  onSettingsChange?: (settings: VideoSettings) => void;
  onAddSubtitleAtCurrentTime?: () => void;
  seekRequest?: SeekRequest | null;
}

// Брзи избори вертикалне позиције
const POSITION_PRESETS: Array<{ label: string; value: number }> = [
  { label: '⬆️ Горе', value: 15 },
  { label: '⏺️ Средина', value: 55 },
  { label: '⬇️ Доле', value: 95 },
];

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  subtitles,
  onTimeUpdate,
  settings: externalSettings,
  onSettingsChange,
  onAddSubtitleAtCurrentTime,
  seekRequest,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile(600);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [wrapperHeight, setWrapperHeight] = useState(0);
  const [settings, setSettings] = useState<VideoSettings>(externalSettings || {
    aspectRatio: '16:9',
    fontSize: DEFAULT_FONT_SIZE,
    verticalPosition: DEFAULT_VERTICAL_POSITION,
    maxBoxWidthPercent: DEFAULT_MAX_BOX_WIDTH_PERCENT,
    maxBoxHeightPx: DEFAULT_MAX_BOX_HEIGHT,
  });

  // Sync with external settings
  useEffect(() => {
    if (externalSettings) {
      setSettings(externalSettings);
    }
  }, [externalSettings]);

  // Захтев за премотавање споља (клик на траку или титл)
  useEffect(() => {
    if (seekRequest && videoRef.current) {
      videoRef.current.currentTime = seekRequest.time;
    }
  }, [seekRequest]);

  // Прати стварну висину прегледа да би фонт био пропорционалан излазном видеу
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const measure = () => setWrapperHeight(wrapper.clientHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [settings.aspectRatio]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;

      if (onTimeUpdate) {
        onTimeUpdate(currentTime);
      }

      // Find current subtitle
      const subtitle = subtitles.find(
        (s) => currentTime >= s.startTime && currentTime <= s.endTime
      );

      if (subtitle?.text) {
        // Исто преламање и подела као при експорту — укључујући
        // конверзију у ћирилицу коју експорт увек ради
        setCurrentSubtitle(
          getDisplayTextAtTime(
            ensureCyrillic(subtitle.text),
            subtitle.startTime,
            subtitle.endTime,
            currentTime,
            settings.aspectRatio,
            settings.fontSize,
            settings.maxBoxWidthPercent,
            settings.maxBoxHeightPx
          )
        );
      } else {
        setCurrentSubtitle('');
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [subtitles, onTimeUpdate, settings]);

  const updateSettings = (newSettings: Partial<VideoSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    if (onSettingsChange) {
      onSettingsChange(updated);
    }
  };

  const handleAddSubtitle = useCallback(() => {
    // Паузирај снимак па додај титл на тренутном времену
    videoRef.current?.pause();
    if (onAddSubtitleAtCurrentTime) {
      onAddSubtitleAtCurrentTime();
    }
  }, [onAddSubtitleAtCurrentTime]);

  const targetDims = TARGET_DIMS[settings.aspectRatio];
  // Колико је преглед мањи од излазног видеа — фонт се скалира истим односом
  const previewScale = wrapperHeight > 0 ? wrapperHeight / targetDims.height : 0;
  const previewFontPx = settings.fontSize * previewScale;

  const getSubtitlePosition = (): React.CSSProperties => ({
    position: 'absolute',
    left: '50%',
    // Доња ивица титла стоји на verticalPosition % висине — исто као у експорту
    top: `${settings.verticalPosition}%`,
    transform: 'translate(-50%, -100%)',
    maxWidth: `${settings.maxBoxWidthPercent}%`,
    textAlign: 'center',
  });

  const getAspectRatioStyle = (): React.CSSProperties => {
    switch (settings.aspectRatio) {
      case '9:16':
        return { maxWidth: '400px', aspectRatio: '9/16', margin: '0 auto' };
      case '1:1':
        return { maxWidth: '500px', aspectRatio: '1/1', margin: '0 auto' };
      case '16:9':
      default:
        return { maxWidth: '100%', aspectRatio: '16/9' };
    }
  };

  const maxChars = getMaxCharsPerLine(
    settings.aspectRatio, settings.fontSize, settings.maxBoxWidthPercent
  );
  const maxLines = getMaxLines(settings.fontSize, settings.maxBoxHeightPx);
  const minBoxHeight = Math.ceil(settings.fontSize * LINE_HEIGHT_RATIO);

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <button
          style={styles.settingsToggle}
          onClick={() => setShowSettings(!showSettings)}
        >
          ⚙️ Подешавања приказа
        </button>
        {onAddSubtitleAtCurrentTime && (
          <button style={styles.addSubtitleButton} onClick={handleAddSubtitle}>
            ➕ Додај титл овде
          </button>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={styles.settingsPanel}>
          <div style={styles.settingGroup}>
            <span style={{ ...styles.settingLabel, minWidth: isMobile ? '100%' : '220px' }}>📐 Формат:</span>
            <div style={styles.buttonGroup}>
              {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  style={{
                    ...styles.optionButton,
                    ...(settings.aspectRatio === ratio ? styles.optionButtonActive : {}),
                  }}
                  onClick={() => updateSettings({ aspectRatio: ratio })}
                >
                  {ratio === '16:9' && '🖥️ '}
                  {ratio === '9:16' && '📱 '}
                  {ratio === '1:1' && '⬛ '}
                  {ratio}
                </button>
              ))}
            </div>
            <span style={styles.charHint}>
              Извоз: {targetDims.width}×{targetDims.height} px
            </span>
          </div>

          <div style={styles.settingGroup}>
            <span style={{ ...styles.settingLabel, minWidth: isMobile ? '100%' : '220px' }}>
              📍 Позиција по висини: {settings.verticalPosition}%
            </span>
            <div style={styles.buttonGroup}>
              {POSITION_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  style={{
                    ...styles.optionButton,
                    ...(settings.verticalPosition === preset.value ? styles.optionButtonActive : {}),
                  }}
                  onClick={() => updateSettings({ verticalPosition: preset.value })}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min="8"
              max="98"
              value={settings.verticalPosition}
              onChange={(e) => updateSettings({ verticalPosition: parseInt(e.target.value) })}
              style={{ ...styles.slider, width: isMobile ? '100%' : '150px' }}
            />
          </div>

          <div style={styles.settingGroup}>
            <span style={{ ...styles.settingLabel, minWidth: isMobile ? '100%' : '220px' }}>
              🔤 Величина фонта: {settings.fontSize}px
            </span>
            <input
              type="range"
              min="24"
              max="120"
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
              style={{ ...styles.slider, width: isMobile ? '100%' : '150px' }}
            />
            <span style={styles.charHint}>у извезеном видеу</span>
          </div>

          <div style={styles.settingGroup}>
            <span style={{ ...styles.settingLabel, minWidth: isMobile ? '100%' : '220px' }}>
              ↔️ Макс. ширина кутије: {settings.maxBoxWidthPercent}%
            </span>
            <input
              type="range"
              min="30"
              max="98"
              value={settings.maxBoxWidthPercent}
              onChange={(e) => updateSettings({ maxBoxWidthPercent: parseInt(e.target.value) })}
              style={{ ...styles.slider, width: isMobile ? '100%' : '150px' }}
            />
            <span style={styles.charHint}>≈ {maxChars} кар. по реду</span>
          </div>

          <div style={styles.settingGroup}>
            <span style={{ ...styles.settingLabel, minWidth: isMobile ? '100%' : '220px' }}>
              ↕️ Макс. висина кутије: {settings.maxBoxHeightPx}px
            </span>
            <input
              type="range"
              min={minBoxHeight}
              max="400"
              value={Math.max(minBoxHeight, settings.maxBoxHeightPx)}
              onChange={(e) => updateSettings({ maxBoxHeightPx: parseInt(e.target.value) })}
              style={{ ...styles.slider, width: isMobile ? '100%' : '150px' }}
            />
            <span style={styles.charHint}>
              стаје {maxLines} {maxLines === 1 ? 'ред' : maxLines < 5 ? 'реда' : 'редова'} — вишак иде у нови титл
            </span>
          </div>
        </div>
      )}

      {/* Video Container with aspect ratio preview */}
      <div ref={wrapperRef} style={{ ...styles.videoWrapper, ...getAspectRatioStyle() }}>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          style={styles.video}
        >
          Ваш прегледач не подржава видео.
        </video>

        {currentSubtitle && previewScale > 0 && (
          <div style={getSubtitlePosition()}>
            {/* Кутија по реду — исто као у експорту (засебан ред = засебна кутија),
                са размаком између редова да се позадине не преклапају */}
            {currentSubtitle.split('\n').map((line, i) => (
              <div
                key={i}
                style={{ marginTop: i > 0 ? `${previewFontPx * LINE_GAP_RATIO}px` : 0 }}
              >
                <span
                  style={{
                    ...styles.subtitleText,
                    fontSize: `${previewFontPx}px`,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    padding: `${Math.max(1, previewFontPx * BOX_PADDING_RATIO)}px`,
                    boxDecorationBreak: 'clone',
                  }}
                >
                  {line}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview indicator */}
      <div style={styles.previewInfo}>
        {settings.aspectRatio === '16:9' && '🖥️ YouTube / TV формат'}
        {settings.aspectRatio === '9:16' && '📱 TikTok / Reels / Stories формат'}
        {settings.aspectRatio === '1:1' && '⬛ Instagram / Facebook формат'}
        {' • '}
        Преглед = извоз (фонт {settings.fontSize}px на {targetDims.height}p, макс. {maxLines} {maxLines === 1 ? 'ред' : 'реда'})
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    width: '100%',
  },
  toolbar: {
    display: 'flex',
    gap: '10px',
    marginBottom: '10px',
    flexWrap: 'wrap',
  },
  settingsToggle: {
    padding: '8px 16px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  addSubtitleButton: {
    padding: '8px 16px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
  settingsPanel: {
    backgroundColor: '#f8f9fa',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  settingGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  settingLabel: {
    fontWeight: 'bold',
    minWidth: '220px',
    fontSize: '0.9rem',
  },
  buttonGroup: {
    display: 'flex',
    gap: '5px',
  },
  optionButton: {
    padding: '6px 12px',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  optionButtonActive: {
    backgroundColor: '#007bff',
    color: '#fff',
    borderColor: '#007bff',
  },
  charHint: {
    fontSize: '0.8rem',
    color: '#666',
    marginLeft: '10px',
  },
  slider: {
    width: '150px',
    cursor: 'pointer',
  },
  videoWrapper: {
    position: 'relative',
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    // 'cover' сече видео исто као crop при експорту — преглед = извоз
    objectFit: 'cover',
    display: 'block',
  },
  subtitleText: {
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'Arial, sans-serif',
    textShadow: '1px 1px 2px rgba(0,0,0,0.9)',
    lineHeight: LINE_HEIGHT_RATIO,
    display: 'inline-block',
  },
  previewInfo: {
    textAlign: 'center',
    padding: '10px',
    fontSize: '0.85rem',
    color: '#666',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    marginTop: '10px',
  },
};

export default VideoPlayer;
