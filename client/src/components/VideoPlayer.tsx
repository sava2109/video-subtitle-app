import React, { useRef, useEffect, useState } from 'react';

interface Subtitle {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

type AspectRatio = '16:9' | '9:16' | '1:1';
type SubtitlePosition = 'top' | 'center' | 'bottom';

export interface VideoSettings {
  aspectRatio: AspectRatio;
  subtitlePosition: SubtitlePosition;
  fontSize: number;
}

interface VideoPlayerProps {
  videoUrl: string;
  subtitles: Subtitle[];
  onTimeUpdate?: (time: number) => void;
  settings?: VideoSettings;
  onSettingsChange?: (settings: VideoSettings) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videoUrl, 
  subtitles, 
  onTimeUpdate,
  settings: externalSettings,
  onSettingsChange 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<VideoSettings>(externalSettings || {
    aspectRatio: '16:9',
    subtitlePosition: 'bottom',
    fontSize: 24,
  });

  // Sync with external settings
  useEffect(() => {
    if (externalSettings) {
      setSettings(externalSettings);
    }
  }, [externalSettings]);

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
      
      // Format subtitle text based on aspect ratio
      if (subtitle?.text) {
        setCurrentSubtitle(formatSubtitleForRatio(subtitle.text, settings.aspectRatio));
      } else {
        setCurrentSubtitle('');
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [subtitles, onTimeUpdate, settings.aspectRatio]);

  // Format subtitle text to fit aspect ratio (split long lines)
  const formatSubtitleForRatio = (text: string, ratio: AspectRatio): string => {
    // Široki limiti - cela širina ekrana
    const maxChars: Record<AspectRatio, number> = {
      '16:9': 50,
      '9:16': 70,  // Veoma široko za vertikalni format
      '1:1': 45,
    };
    const maxCharsPerLine = maxChars[ratio];
    
    // KRITIČNO: Ukloni SVE newline-ove i višestruke razmake
    const cleanText = text
      .replace(/[\r\n]+/g, ' ')  // svi tipovi newline-ova
      .replace(/\s+/g, ' ')       // višestruki razmaci
      .trim();
    
    console.log(`[Subtitle] Original: "${text.substring(0, 30)}..." Clean: "${cleanText.substring(0, 30)}..." Len: ${cleanText.length}, Max: ${maxCharsPerLine}`);
    
    // Ako stane u jedan red, vrati kao jedan red
    if (cleanText.length <= maxCharsPerLine) {
      return cleanText;
    }
    
    // Inače podeli na max 2 reda
    const words = cleanText.split(' ');
    const formattedLines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) formattedLines.push(currentLine);
        currentLine = word;
        if (formattedLines.length >= 2) break;
      }
    }
    if (currentLine && formattedLines.length < 2) {
      formattedLines.push(currentLine);
    }
    
    const result = formattedLines.join('\n');
    console.log(`[Subtitle] Result (${formattedLines.length} lines): "${result.substring(0, 50)}..."`);
    return result;
  };

  const updateSettings = (newSettings: Partial<VideoSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    if (onSettingsChange) {
      onSettingsChange(updated);
    }
  };

  const getSubtitlePosition = (): React.CSSProperties => {
    // Šira zona za 9:16 format
    const maxWidthByRatio: Record<AspectRatio, string> = {
      '16:9': '80%',
      '9:16': '98%',  // Maksimalna širina
      '1:1': '90%',
    };

    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 12px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: '4px',
      maxWidth: maxWidthByRatio[settings.aspectRatio],
      textAlign: 'center',
    };

    switch (settings.subtitlePosition) {
      case 'top':
        return { ...baseStyle, top: '30px' };
      case 'center':
        return { ...baseStyle, top: '50%', transform: 'translate(-50%, -50%)' };
      case 'bottom':
      default:
        return { ...baseStyle, bottom: '60px' };
    }
  };

  const getAspectRatioStyle = (): React.CSSProperties => {
    switch (settings.aspectRatio) {
      case '9:16':
        return { maxWidth: '520px', aspectRatio: '9/16', margin: '0 auto' };  // Još širi
      case '1:1':
        return { maxWidth: '500px', aspectRatio: '1/1', margin: '0 auto' };
      case '16:9':
      default:
        return { maxWidth: '100%', aspectRatio: '16/9' };
    }
  };

  const getMaxCharsInfo = (): string => {
    const chars: Record<AspectRatio, number> = { '16:9': 45, '9:16': 50, '1:1': 40 };
    return `${chars[settings.aspectRatio]} кар. × 2 реда`;
  };

  return (
    <div style={styles.container}>
      {/* Settings Toggle */}
      <button 
        style={styles.settingsToggle}
        onClick={() => setShowSettings(!showSettings)}
      >
        ⚙️ Подешавања приказа
      </button>

      {/* Settings Panel */}
      {showSettings && (
        <div style={styles.settingsPanel}>
          <div style={styles.settingGroup}>
            <span style={styles.settingLabel}>📐 Формат:</span>
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
            <span style={styles.charHint}>📝 Макс: {getMaxCharsInfo()}</span>
          </div>

          <div style={styles.settingGroup}>
            <span style={styles.settingLabel}>📍 Позиција титлова:</span>
            <div style={styles.buttonGroup}>
              {(['top', 'center', 'bottom'] as SubtitlePosition[]).map((pos) => (
                <button
                  key={pos}
                  style={{
                    ...styles.optionButton,
                    ...(settings.subtitlePosition === pos ? styles.optionButtonActive : {}),
                  }}
                  onClick={() => updateSettings({ subtitlePosition: pos })}
                >
                  {pos === 'top' && '⬆️ Горе'}
                  {pos === 'center' && '⏺️ Средина'}
                  {pos === 'bottom' && '⬇️ Доле'}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.settingGroup}>
            <span style={styles.settingLabel}>🔤 Величина фонта: {settings.fontSize}px</span>
            <input
              type="range"
              min="16"
              max="48"
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
              style={styles.slider}
            />
          </div>
        </div>
      )}

      {/* Video Container with aspect ratio preview */}
      <div style={{ ...styles.videoWrapper, ...getAspectRatioStyle() }}>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          style={styles.video}
        >
          Ваш прегледач не подржава видео.
        </video>
        
        {currentSubtitle && (
          <div style={getSubtitlePosition()}>
            <span style={{ 
              ...styles.subtitleText, 
              fontSize: `${settings.fontSize}px`,
              whiteSpace: 'pre-line'
            }}>
              {currentSubtitle}
            </span>
          </div>
        )}
      </div>

      {/* Preview indicator */}
      <div style={styles.previewInfo}>
        {settings.aspectRatio === '16:9' && '🖥️ YouTube / TV формат'}
        {settings.aspectRatio === '9:16' && '📱 TikTok / Reels / Stories формат'}
        {settings.aspectRatio === '1:1' && '⬛ Instagram / Facebook формат'}
        {' • '}
        Титлови: {settings.subtitlePosition === 'top' ? 'горе' : settings.subtitlePosition === 'center' ? 'средина' : 'доле'}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    width: '100%',
  },
  settingsToggle: {
    padding: '8px 16px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    marginBottom: '10px',
    fontSize: '0.9rem',
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
    minWidth: '180px',
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
    objectFit: 'contain',
    display: 'block',
  },
  subtitleText: {
    color: '#fff',
    textAlign: 'center',
    textShadow: '2px 2px 2px rgba(0,0,0,0.8)',
    lineHeight: '1.4',
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