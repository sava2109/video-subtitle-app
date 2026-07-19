import React from 'react';
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
  maxCharsPerLine?: number;
  maxLines?: number;
}

const SubtitleEditor: React.FC<SubtitleEditorProps> = ({
  subtitles,
  currentTime,
  onChange,
  onInsertAtCurrentTime,
  maxCharsPerLine = 40,
  maxLines = 2,
}) => {
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

  const handleTextChange = (id: number, newText: string) => {
    const updated = subtitles.map((s) =>
      s.id === id ? { ...s, text: newText } : s
    );
    onChange(updated);
  };

  const handleTimeChange = (id: number, field: 'startTime' | 'endTime', value: string) => {
    const time = parseTime(value);
    const updated = subtitles.map((s) =>
      s.id === id ? { ...s, [field]: time } : s
    );
    onChange(updated);
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

  const isActive = (subtitle: Subtitle) => {
    return currentTime >= subtitle.startTime && currentTime <= subtitle.endTime;
  };

  const isTooLong = (text: string) => {
    return wrapText(text, maxCharsPerLine).length > maxLines;
  };

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
          subtitles.map((subtitle) => (
            <div
              key={subtitle.id}
              style={{
                ...styles.item,
                ...(isActive(subtitle) ? styles.activeItem : {}),
              }}
            >
              <div style={styles.itemHeader}>
                <span style={styles.itemId}>#{subtitle.id}</span>
                <button
                  style={styles.deleteButton}
                  onClick={() => handleDelete(subtitle.id)}
                >
                  ×
                </button>
              </div>

              <div style={styles.timeRow}>
                <label style={styles.timeLabel}>
                  Почетак:
                  <input
                    type="text"
                    value={formatTime(subtitle.startTime)}
                    onChange={(e) => handleTimeChange(subtitle.id, 'startTime', e.target.value)}
                    style={styles.timeInput}
                  />
                </label>
                <label style={styles.timeLabel}>
                  Крај:
                  <input
                    type="text"
                    value={formatTime(subtitle.endTime)}
                    onChange={(e) => handleTimeChange(subtitle.id, 'endTime', e.target.value)}
                    style={styles.timeInput}
                  />
                </label>
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
          ))
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
  itemId: {
    fontSize: '0.8rem',
    color: '#666',
    fontWeight: 'bold',
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
    gap: '15px',
    marginBottom: '8px',
  },
  timeLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.85rem',
    color: '#666',
  },
  timeInput: {
    width: '80px',
    padding: '4px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '0.85rem',
  },
  textInput: {
    width: '100%',
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
};

export default SubtitleEditor;