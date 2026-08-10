import React, { useRef, useState } from 'react';

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
  onSeek?: (time: number) => void;
  /** Позива се када се блок превуче/развуче — нови почетак и крај титла */
  onTimeChange?: (id: number, startTime: number, endTime: number) => void;
}

type DragMode = 'move' | 'start' | 'end';

interface DragState {
  id: number;
  mode: DragMode;
  originStart: number;
  originEnd: number;
  originX: number;
  curStart: number;
  curEnd: number;
  moved: boolean;
}

const MIN_DURATION = 0.2; // минимално трајање титла у секундама

const round2 = (n: number) => Math.round(n * 100) / 100;

const SubtitleTimeline: React.FC<SubtitleTimelineProps> = ({
  subtitles,
  currentTime,
  duration,
  onSubtitleClick,
  onSeek,
  onTimeChange,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const actualDuration = duration || Math.max(...subtitles.map((s) => s.endTime), 60);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPosition = (time: number): number => {
    return Math.min(100, Math.max(0, (time / actualDuration) * 100));
  };

  const getWidth = (start: number, end: number): number => {
    return Math.max(0.4, ((end - start) / actualDuration) * 100);
  };

  // Клик на празан део траке — премотај на то време
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(actualDuration, ratio * actualDuration)));
  };

  const isActive = (s: Subtitle) => currentTime >= s.startTime && currentTime <= s.endTime;

  // ---- Превлачење блокова (померање и промена трајања) ----

  const beginDrag = (e: React.PointerEvent, s: Subtitle, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      id: s.id,
      mode,
      originStart: s.startTime,
      originEnd: s.endTime,
      originX: e.clientX,
      curStart: s.startTime,
      curEnd: s.endTime,
      moved: false,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const dt = ((e.clientX - drag.originX) / rect.width) * actualDuration;
    const len = drag.originEnd - drag.originStart;

    let curStart = drag.curStart;
    let curEnd = drag.curEnd;

    if (drag.mode === 'move') {
      curStart = Math.max(0, Math.min(drag.originStart + dt, actualDuration - len));
      curEnd = curStart + len;
    } else if (drag.mode === 'start') {
      curStart = Math.max(0, Math.min(drag.originStart + dt, drag.originEnd - MIN_DURATION));
    } else {
      curEnd = Math.max(drag.originStart + MIN_DURATION, Math.min(drag.originEnd + dt, actualDuration));
    }

    setDrag({
      ...drag,
      curStart,
      curEnd,
      moved: drag.moved || Math.abs(e.clientX - drag.originX) > 3,
    });
  };

  const handlePointerUp = (subtitle: Subtitle) => {
    if (!drag) return;
    if (drag.moved && onTimeChange) {
      onTimeChange(drag.id, round2(drag.curStart), round2(drag.curEnd));
    } else if (!drag.moved) {
      // Обичан клик без превлачења — премотај на титл
      onSubtitleClick?.(subtitle);
    }
    setDrag(null);
  };

  // Ознаке на лењиру (5 подеока)
  const rulerMarks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * actualDuration);

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h4 style={styles.title}>⏱ Временска линија</h4>
        <span style={styles.timeInfo}>
          <strong style={styles.currentTimeText}>{formatTime(currentTime)}</strong>
          <span style={styles.durationText}> / {formatTime(actualDuration)}</span>
        </span>
      </div>

      <div
        ref={trackRef}
        style={styles.track}
        onClick={handleTrackClick}
        title="Кликни за премотавање"
      >
        {/* Прогрес позадина — одгледани део */}
        <div style={{ ...styles.playedOverlay, width: `${getPosition(currentTime)}%` }} />

        {/* Блокови титлова */}
        {subtitles.map((subtitle) => {
          const active = isActive(subtitle);
          const hovered = hoveredId === subtitle.id;
          const dragging = drag?.id === subtitle.id;
          const start = dragging ? drag.curStart : subtitle.startTime;
          const end = dragging ? drag.curEnd : subtitle.endTime;
          return (
            <div
              key={subtitle.id}
              style={{
                ...styles.subtitleBlock,
                left: `${getPosition(start)}%`,
                width: `${getWidth(start, end)}%`,
                background: active
                  ? 'linear-gradient(180deg, #4dabf7, #1971c2)'
                  : subtitle.text.trim()
                    ? 'linear-gradient(180deg, #5c7cfa, #4263eb)'
                    : 'linear-gradient(180deg, #ffa94d, #f76707)', // празан титл — наранџаст
                transform: hovered || active || dragging ? 'scaleY(1.15)' : 'scaleY(1)',
                zIndex: dragging ? 7 : hovered ? 6 : active ? 5 : 3,
                boxShadow: dragging
                  ? '0 0 8px rgba(255,255,255,0.6)'
                  : active
                    ? '0 0 6px rgba(77,171,247,0.9)'
                    : 'none',
                cursor: dragging ? 'grabbing' : 'grab',
                transition: dragging ? 'none' : 'transform 0.12s ease, box-shadow 0.12s ease',
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => beginDrag(e, subtitle, 'move')}
              onPointerMove={handlePointerMove}
              onPointerUp={() => handlePointerUp(subtitle)}
              onMouseEnter={() => setHoveredId(subtitle.id)}
              onMouseLeave={() => setHoveredId(null)}
              title={`#${subtitle.id} (${formatTime(subtitle.startTime)}–${formatTime(subtitle.endTime)})\n${subtitle.text || '(празан титл)'}\nПревуци за померање, ивице за трајање`}
            >
              {/* Ручке за промену почетка/краја */}
              <div
                style={{ ...styles.edgeHandle, left: 0 }}
                onPointerDown={(e) => beginDrag(e, subtitle, 'start')}
              />
              <span style={styles.blockText}>
                {subtitle.text.trim() ? subtitle.text.replace(/\n/g, ' ') : `#${subtitle.id}`}
              </span>
              <div
                style={{ ...styles.edgeHandle, right: 0 }}
                onPointerDown={(e) => beginDrag(e, subtitle, 'end')}
              />
            </div>
          );
        })}

        {/* Плејхед */}
        <div style={{ ...styles.playhead, left: `${getPosition(currentTime)}%` }}>
          <div style={styles.playheadBubble}>{formatTime(currentTime)}</div>
        </div>
      </div>

      {/* Лењир */}
      <div style={styles.ruler}>
        {rulerMarks.map((t, i) => (
          <span key={i} style={styles.rulerMark}>{formatTime(t)}</span>
        ))}
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
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  title: {
    margin: 0,
    fontSize: '1rem',
  },
  timeInfo: {
    fontSize: '0.9rem',
  },
  currentTimeText: {
    color: '#1971c2',
    fontVariantNumeric: 'tabular-nums',
  },
  durationText: {
    color: '#868e96',
    fontVariantNumeric: 'tabular-nums',
  },
  track: {
    position: 'relative',
    height: '54px',
    background: 'linear-gradient(180deg, #343a40, #212529)',
    borderRadius: '8px',
    cursor: 'pointer',
    overflow: 'visible',
  },
  playedOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    background: 'rgba(77, 171, 247, 0.15)',
    borderRadius: '8px 0 0 8px',
    pointerEvents: 'none',
  },
  subtitleBlock: {
    position: 'absolute',
    top: '8px',
    height: '38px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 6px',
    minWidth: '14px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.25)',
    boxSizing: 'border-box',
    touchAction: 'none',
  },
  edgeHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '8px',
    cursor: 'ew-resize',
    backgroundColor: 'rgba(255,255,255,0.25)',
    touchAction: 'none',
  },
  blockText: {
    color: '#fff',
    fontSize: '0.72rem',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
    pointerEvents: 'none',
    margin: '0 6px',
  },
  playhead: {
    position: 'absolute',
    top: '-4px',
    bottom: '-4px',
    width: '2px',
    backgroundColor: '#fa5252',
    zIndex: 8,
    pointerEvents: 'none',
    transition: 'left 0.1s linear',
  },
  playheadBubble: {
    position: 'absolute',
    top: '-20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#fa5252',
    color: '#fff',
    fontSize: '0.68rem',
    fontWeight: 'bold',
    padding: '1px 6px',
    borderRadius: '10px',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  ruler: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '22px',
    fontSize: '0.72rem',
    color: '#868e96',
    fontVariantNumeric: 'tabular-nums',
  },
  rulerMark: {},
};

export default SubtitleTimeline;
