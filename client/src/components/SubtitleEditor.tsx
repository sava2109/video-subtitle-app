import React, { useEffect, useRef } from 'react';
import { wrapText } from '../utils/subtitleLayout';

interface Subtitle {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

interface SubtitleEditorProps {
  subtitles: Subtitle[];
  currentTime: number;
  onChange: (subtitles: Subtitle[]) => void;
  onInsertAtCurrentTime?: () => void;
  onSeek?: (time: number) => void;
  onMergeWithNext?: (id: number) => void;
  onSplit?: (id: number) => void;
  maxCharsPerLine?: number;
  maxLines?: number;
}

// Изнад овог броја знакова у секунди титл је тешко прочитати
const CPS_WARN_THRESHOLD = 17;

const round2 = (n: number) => Math.round(n * 100) / 100;

const SubtitleEditor: React.FC<SubtitleEditorProps> = ({
  subtitles,
  currentTime,
  onChange,
  onInsertAtCurrentTime,
  onSeek,
  onMergeWithNext,
  onSplit,
  maxCharsPerLine = 40,
  maxLines = 2,
}) => {
  const activeItemRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const [mins, secMs] = parts;
      const [secs, ms = '0'] = secMs.split('.');
      return parseInt(mins) * 60 + parseInt(secs) + parseInt(ms) / 100;
    }
    return 0;
  };

  const isActive = (subtitle: Subtitle) => {
    return currentTime >= subtitle.startTime && currentTime <= subtitle.endTime;
  };

  const activeId = subtitles.find(isActive)?.id ?? null;

  // Аутоматски скролуј листу до титла који се тренутно приказује
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  const handleTextChange = (id: number, newText: string) => {
    const updated = subtitles.map((s) =>
      s.id === id ? { ...s, text: newText } : s
    );
    onChange(updated);
  };

  const setTime = (id: number, field: 'startTime' | 'endTime', value: number) => {
    const updated = subtitles.map((s) => {
      if (s.id !== id) return s;
      if (field === 'startTime') {
        return { ...s, startTime: round2(Math.max(0, Math.min(value, s.endTime - 0.1))) };
      }
      return { ...s, endTime: round2(Math.max(value, s.startTime + 0.1)) };
    });
    onChange(updated);
  };

  const handleTimeChange = (id: number, field: 'startTime' | 'endTime', value: string) => {
    setTime(id, field, parseTime(value));
  };

  const nudgeTime = (id: number, field: 'startTime' | 'endTime', delta: number) => {
    const s = subtitles.find((x) => x.id === id);
    if (s) setTime(id, field, s[field] + delta);
  };

  const setToNow = (id: number, field: 'startTime' | 'endTime') => {
    setTime(id, field, currentTime);
  };

  const handleDelete = (id: number) => {
    const updated = subtitles.filter((s) => s.id !== id);
    // Re-number IDs
    onChange(updated.map((s, i) => ({ ...s, id: i + 1 })));
  };

  const handleAdd = () => {
    const lastSubtitle = subtitles[subtitles.length - 1];
    const newSubtitle: Subtitle = {
      id: subtitles.length + 1,
      startTime: lastSubtitle ? lastSubtitle.endTime : currentTime,
      endTime: lastSubtitle ? lastSubtitle.endTime + 3 : currentTime + 3,
      text: '',
    };
    onChange([...subtitles, newSubtitle]);
  };

  const isTooLong = (text: string) => {
    return wrapText(text, maxCharsPerLine).length > maxLines;
  };

  // Знакова у секунди (без размака) — мера читљивости титла
  const getCps = (s: Subtitle): number => {
    const duration = Math.max(0.1, s.endTime - s.startTime);
    return s.text.replace(/\s+/g, '').length / duration;
  };

  const renderTimeControls = (subtitle: Subtitle, field: 'startTime' | 'endTime', label: string) => (
    <label style={styles.timeLabel}>
      {label}
      <button
        style={styles.nudgeButton}
        title="−0.1 секунду"
        onClick={() => nudgeTime(subtitle.id, field, -0.1)}
      >
        −
      </button>
      <input
        type="text"
        value={formatTime(subtitle[field])}
        onChange={(e) => handleTimeChange(subtitle.id, field, e.target.value)}
        style={styles.timeInput}
      />
      <button
        style={styles.nudgeButton}
        title="+0.1 секунду"
        onClick={() => nudgeTime(subtitle.id, field, 0.1)}
      >
        +
      </button>
      <button
        style={styles.nowButton}
        title="Постави на тренутно време плејера"
        onClick={() => setToNow(subtitle.id, field)}
      >
        ⏱
      </button>
    </label>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>📝 Титлови</h3>
        <div style={styles.headerButtons}>
          {onInsertAtCurrentTime && (
            <button style={styles.insertButton} onClick={onInsertAtCurrentTime}>
              ➕ Овде ({formatTime(currentTime)})
            </button>
          )}
          <button style={styles.addButton} onClick={handleAdd}>
            + На крај
          </button>
        </div>
      </div>

      <div style={styles.list}>
        {subtitles.length === 0 ? (
          <p style={styles.empty}>Нема титлова. Генеришите их или додајте ручно.</p>
        ) : (
          subtitles.map((subtitle, index) => {
            const cps = getCps(subtitle);
            return (
              <div
                key={subtitle.id}
                ref={subtitle.id === activeId ? activeItemRef : undefined}
                style={{
                  ...styles.item,
                  ...(isActive(subtitle) ? styles.activeItem : {}),
                }}
              >
                <div style={styles.itemHeader}>
                  <div style={styles.itemHeaderLeft}>
                    {onSeek && (
                      <button
                        style={styles.seekButton}
                        title="Премотај видео на овај титл"
                        onClick={() => onSeek(subtitle.startTime)}
                      >
                        ▶
                      </button>
                    )}
                    <span style={styles.itemId}>#{subtitle.id}</span>
                    {subtitle.text.trim() && (
                      <span
                        style={{
                          ...styles.cpsBadge,
                          ...(cps > CPS_WARN_THRESHOLD ? styles.cpsWarn : {}),
                        }}
                        title={
                          cps > CPS_WARN_THRESHOLD
                            ? `Пребрзо за читање (${cps.toFixed(1)} знакова/с, преко ${CPS_WARN_THRESHOLD}) — продужи трајање или скрати текст`
                            : `Читљивост: ${cps.toFixed(1)} знакова у секунди`
                        }
                      >
                        {cps > CPS_WARN_THRESHOLD ? '⚠️ ' : ''}{cps.toFixed(0)} зн/с
                      </span>
                    )}
                  </div>
                  <div style={styles.itemHeaderRight}>
                    {onSplit && subtitle.text.trim() && (
                      <button
                        style={styles.toolButton}
                        title="Подели титл на два"
                        onClick={() => onSplit(subtitle.id)}
                      >
                        ✂️
                      </button>
                    )}
                    {onMergeWithNext && index < subtitles.length - 1 && (
                      <button
                        style={styles.toolButton}
                        title="Спој са следећим титлом"
                        onClick={() => onMergeWithNext(subtitle.id)}
                      >
                        🔗
                      </button>
                    )}
                    <button
                      style={styles.deleteButton}
                      title="Обриши титл"
                      onClick={() => handleDelete(subtitle.id)}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div style={styles.timeRow}>
                  {renderTimeControls(subtitle, 'startTime', 'Почетак:')}
                  {renderTimeControls(subtitle, 'endTime', 'Крај:')}
                </div>

                <textarea
                  value={subtitle.text}
                  onChange={(e) => handleTextChange(subtitle.id, e.target.value)}
                  style={styles.textInput}
                  rows={2}
                  placeholder="Унесите текст титла..."
                />

                {isTooLong(subtitle.text) && (
                  <div style={styles.tooLongWarning}>
                    ⚠️ Не стаје у кутију ({maxLines} {maxLines === 1 ? 'ред' : 'реда'}) — при експорту се дели у више титлова
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    borderBottom: '1px solid #eee',
  },
  title: {
    margin: 0,
    fontSize: '1.1rem',
  },
  headerButtons: {
    display: 'flex',
    gap: '8px',
  },
  insertButton: {
    padding: '6px 12px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
  addButton: {
    padding: '6px 12px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  tooLongWarning: {
    marginTop: '6px',
    fontSize: '0.75rem',
    color: '#856404',
    backgroundColor: '#fff3cd',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  list: {
    maxHeight: '400px',
    overflowY: 'auto',
    padding: '10px',
  },
  empty: {
    textAlign: 'center',
    color: '#666',
    padding: '30px',
  },
  item: {
    padding: '12px',
    marginBottom: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    border: '2px solid transparent',
  },
  activeItem: {
    borderColor: '#007bff',
    backgroundColor: '#e7f1ff',
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  itemHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  itemHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  seekButton: {
    width: '28px',
    height: '28px',
    backgroundColor: '#e7f1ff',
    color: '#1971c2',
    border: '1px solid #a5c9f5',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '0.75rem',
    lineHeight: '1',
  },
  itemId: {
    fontSize: '0.8rem',
    color: '#666',
    fontWeight: 'bold',
  },
  cpsBadge: {
    fontSize: '0.72rem',
    color: '#868e96',
    backgroundColor: '#f1f3f5',
    padding: '2px 6px',
    borderRadius: '10px',
  },
  cpsWarn: {
    color: '#c92a2a',
    backgroundColor: '#ffe3e3',
    fontWeight: 'bold',
  },
  toolButton: {
    width: '32px',
    height: '32px',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    lineHeight: '1',
  },
  deleteButton: {
    width: '32px',
    height: '32px',
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '1.1rem',
    lineHeight: '1',
  },
  timeRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '8px',
    flexWrap: 'wrap',
  },
  timeLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.85rem',
    color: '#666',
  },
  timeInput: {
    width: '70px',
    padding: '4px 6px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '0.85rem',
    textAlign: 'center',
  },
  nudgeButton: {
    width: '24px',
    height: '26px',
    padding: 0,
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    lineHeight: '1',
    color: '#495057',
  },
  nowButton: {
    height: '26px',
    padding: '0 6px',
    backgroundColor: '#e7f1ff',
    border: '1px solid #a5c9f5',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    lineHeight: '1',
  },
  textInput: {
    width: '100%',
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
};

export default SubtitleEditor;
