import React from 'react';

interface Subtitle {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

interface SubtitleTimelineProps {
  subtitles: Subtitle[];
  currentTime: number;
  duration: number;
  onSubtitleClick?: (subtitle: Subtitle) => void;
}

const SubtitleTimeline: React.FC<SubtitleTimelineProps> = ({
  subtitles,
  currentTime,
  duration,
  onSubtitleClick,
}) => {
  const actualDuration = duration || Math.max(...subtitles.map((s) => s.endTime), 60);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPosition = (time: number): number => {
    return (time / actualDuration) * 100;
  };

  const getWidth = (start: number, end: number): number => {
    return ((end - start) / actualDuration) * 100;
  };

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>⏱ Временска линија</h4>
      
      <div style={styles.timeline}>
        {/* Timeline background */}
        <div style={styles.track}>
          {/* Current time indicator */}
          <div
            style={{
              ...styles.currentIndicator,
              left: `${getPosition(currentTime)}%`,
            }}
          />

          {/* Subtitle blocks */}
          {subtitles.map((subtitle) => (
            <div
              key={subtitle.id}
              style={{
                ...styles.subtitleBlock,
                left: `${getPosition(subtitle.startTime)}%`,
                width: `${getWidth(subtitle.startTime, subtitle.endTime)}%`,
                backgroundColor:
                  currentTime >= subtitle.startTime && currentTime <= subtitle.endTime
                    ? '#007bff'
                    : '#6c757d',
              }}
              onClick={() => onSubtitleClick?.(subtitle)}
              title={subtitle.text}
            >
              <span style={styles.subtitleId}>{subtitle.id}</span>
            </div>
          ))}
        </div>

        {/* Time markers */}
        <div style={styles.markers}>
          <span>{formatTime(0)}</span>
          <span>{formatTime(actualDuration / 4)}</span>
          <span>{formatTime(actualDuration / 2)}</span>
          <span>{formatTime((actualDuration * 3) / 4)}</span>
          <span>{formatTime(actualDuration)}</span>
        </div>
      </div>

      <div style={styles.info}>
        Тренутно време: <strong>{formatTime(currentTime)}</strong> / {formatTime(actualDuration)}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '15px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    margin: '0 0 15px 0',
    fontSize: '1rem',
  },
  timeline: {
    position: 'relative',
  },
  track: {
    position: 'relative',
    height: '40px',
    backgroundColor: '#e9ecef',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  currentIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '2px',
    backgroundColor: '#dc3545',
    zIndex: 10,
    transition: 'left 0.1s linear',
  },
  subtitleBlock: {
    position: 'absolute',
    top: '5px',
    height: '30px',
    borderRadius: '3px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '20px',
    transition: 'background-color 0.2s',
  },
  subtitleId: {
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: 'bold',
  },
  markers: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '5px',
    fontSize: '0.75rem',
    color: '#666',
  },
  info: {
    marginTop: '10px',
    fontSize: '0.9rem',
    color: '#666',
  },
};

export default SubtitleTimeline;