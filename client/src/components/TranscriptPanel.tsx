import React, { useState, useEffect, useRef } from 'react';
import { latinToCyrillic } from '../utils/latinToCyrillic';

interface Subtitle {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

interface TranscriptPanelProps {
  subtitles: Subtitle[];
  onChange: (subtitles: Subtitle[]) => void;
  currentTime?: number;
  onSeek?: (time: number) => void;
}

/**
 * Панел са целим говором.
 *
 * 🧩 Блокови (подразумевано): сваки титл је засебан блок у тексту —
 * клик на блок отвара измену баш тог титла, а видео се премота на њега.
 *
 * ✏️ Текст: један ред у тексту = један титл (стари начин, за брзе
 * исправке целог говора одједном).
 */
const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  subtitles,
  onChange,
  currentTime,
  onSeek,
}) => {
  const toTranscript = (subs: Subtitle[]): string =>
    subs.map((s) => s.text.replace(/\s*\n\s*/g, ' ').trim()).join('\n');

  const [mode, setMode] = useState<'blocks' | 'text'>('blocks');
  const [text, setText] = useState<string>(() => toTranscript(subtitles));
  const lastEmittedRef = useRef<string>(toTranscript(subtitles));

  // Уређивање једног блока
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  // Ако се титлови промене споља (транскрипција, увоз, брисање...),
  // освежи текст — али не док корисник куца (не гази сопствену измену)
  useEffect(() => {
    const external = toTranscript(subtitles);
    if (external !== lastEmittedRef.current) {
      setText(external);
      lastEmittedRef.current = external;
    }
  }, [subtitles]);

  const emit = (updated: Subtitle[]) => {
    lastEmittedRef.current = toTranscript(updated);
    setText(lastEmittedRef.current);
    onChange(updated);
  };

  const applyText = (newText: string) => {
    setText(newText);

    const lines = newText.split('\n');
    const updated: Subtitle[] = [];

    const count = Math.min(lines.length, subtitles.length);
    for (let i = 0; i < count; i++) {
      updated.push({ ...subtitles[i], text: lines[i] });
    }

    // Додатни редови постају нови титлови након последњег
    if (lines.length > subtitles.length) {
      let lastEnd = subtitles.length > 0 ? subtitles[subtitles.length - 1].endTime : 0;
      for (let i = subtitles.length; i < lines.length; i++) {
        updated.push({
          id: i + 1,
          startTime: lastEnd,
          endTime: lastEnd + 3,
          text: lines[i],
        });
        lastEnd += 3;
      }
    }

    const renumbered = updated.map((s, i) => ({ ...s, id: i + 1 }));
    lastEmittedRef.current = toTranscript(renumbered);
    onChange(renumbered);
  };

  const handleConvertToCyrillic = () => {
    if (mode === 'text') {
      applyText(latinToCyrillic(text));
    } else {
      emit(subtitles.map((s) => ({ ...s, text: latinToCyrillic(s.text) })));
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startEdit = (s: Subtitle) => {
    setEditingId(s.id);
    setDraft(s.text.replace(/\s*\n\s*/g, ' ').trim());
    // Премотај видео на овај титл да се измена одмах види на снимку
    onSeek?.(s.startTime + 0.01);
  };

  const commitEdit = () => {
    if (editingId === null) return;
    const cleaned = draft.replace(/\s+/g, ' ').trim();
    emit(subtitles.map((s) => (s.id === editingId ? { ...s, text: cleaned } : s)));
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const isActive = (s: Subtitle) =>
    currentTime !== undefined && currentTime >= s.startTime && currentTime <= s.endTime;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>🗣️ Цео говор</h3>
        <div style={styles.headerButtons}>
          <button
            style={{ ...styles.modeButton, ...(mode === 'blocks' ? styles.modeButtonActive : {}) }}
            onClick={() => setMode('blocks')}
          >
            🧩 Блокови
          </button>
          <button
            style={{ ...styles.modeButton, ...(mode === 'text' ? styles.modeButtonActive : {}) }}
            onClick={() => setMode('text')}
          >
            ✏️ Текст
          </button>
          <button style={styles.cyrillicButton} onClick={handleConvertToCyrillic}>
            Аа → Ћирилица
          </button>
        </div>
      </div>

      {mode === 'blocks' ? (
        <>
          <p style={styles.hint}>
            Сваки блок = један титл. Кликни на блок да измениш текст — измена се одмах види на снимку.
          </p>
          <div style={styles.blocksWrap}>
            {subtitles.length === 0 ? (
              <span style={styles.empty}>
                Овде ће се појавити цео говор када генеришете или додате титлове...
              </span>
            ) : (
              subtitles.map((s) => {
                if (editingId === s.id) {
                  return (
                    <input
                      key={s.id}
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      style={{
                        ...styles.blockInput,
                        width: `${Math.min(60, Math.max(10, draft.length + 3))}ch`,
                      }}
                    />
                  );
                }
                const label = s.text.replace(/\s*\n\s*/g, ' ').trim();
                return (
                  <span
                    key={s.id}
                    style={{
                      ...styles.block,
                      ...(isActive(s) ? styles.blockActive : {}),
                      ...(label ? {} : styles.blockEmpty),
                    }}
                    title={`#${s.id} · ${formatTime(s.startTime)}–${formatTime(s.endTime)} — кликни за измену`}
                    onClick={() => startEdit(s)}
                  >
                    {label || `＋ титл #${s.id}`}
                  </span>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          <p style={styles.hint}>
            Један ред = један титл. Исправке овде се одмах виде у титловима и на снимку.
          </p>
          <textarea
            value={text}
            onChange={(e) => applyText(e.target.value)}
            style={styles.textarea}
            placeholder="Овде ће се појавити цео говор када генеришете или додате титлове..."
            rows={12}
          />
        </>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    padding: '15px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
    flexWrap: 'wrap',
    gap: '6px',
  },
  title: {
    margin: 0,
    fontSize: '1.1rem',
  },
  headerButtons: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  modeButton: {
    padding: '6px 10px',
    backgroundColor: '#fff',
    color: '#333',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  modeButtonActive: {
    backgroundColor: '#007bff',
    color: '#fff',
    borderColor: '#007bff',
  },
  cyrillicButton: {
    padding: '6px 12px',
    backgroundColor: '#6f42c1',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  hint: {
    margin: '0 0 8px 0',
    fontSize: '0.8rem',
    color: '#666',
  },
  blocksWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px',
    padding: '10px',
    border: '1px dashed #ccc',
    borderRadius: '6px',
    minHeight: '80px',
    maxHeight: '300px',
    overflowY: 'auto',
    lineHeight: 1.7,
  },
  block: {
    backgroundColor: '#eef3ff',
    border: '1px solid #c5d4f7',
    borderRadius: '6px',
    padding: '3px 8px',
    cursor: 'pointer',
    fontSize: '0.92rem',
    userSelect: 'none',
  },
  blockActive: {
    backgroundColor: '#1971c2',
    borderColor: '#1971c2',
    color: '#fff',
  },
  blockEmpty: {
    backgroundColor: '#fff4e6',
    borderColor: '#ffc078',
    color: '#e8590c',
  },
  blockInput: {
    padding: '3px 8px',
    border: '2px solid #007bff',
    borderRadius: '6px',
    fontSize: '0.92rem',
    fontFamily: 'inherit',
    outline: 'none',
    maxWidth: '100%',
  },
  empty: {
    color: '#999',
    fontSize: '0.9rem',
  },
  textarea: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '0.95rem',
    lineHeight: 1.6,
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
};

export default TranscriptPanel;
