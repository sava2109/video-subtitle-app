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
}

/**
 * Панел са целим говором — један ред у тексту = један титл.
 * Измена реда мења одговарајући титл; додати редови на крају постају
 * нови титлови, а обрисани редови бришу титлове са краја.
 */
const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ subtitles, onChange }) => {
  const toTranscript = (subs: Subtitle[]): string =>
    subs.map((s) => s.text.replace(/\s*\n\s*/g, ' ').trim()).join('\n');

  const [text, setText] = useState<string>(() => toTranscript(subtitles));
  const lastEmittedRef = useRef<string>(toTranscript(subtitles));

  // Ако се титлови промене споља (транскрипција, увоз, брисање...),
  // освежи текст — али не док корисник куца (не гази сопствену измену)
  useEffect(() => {
    const external = toTranscript(subtitles);
    if (external !== lastEmittedRef.current) {
      setText(external);
      lastEmittedRef.current = external;
    }
  }, [subtitles]);

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
    applyText(latinToCyrillic(text));
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>🗣️ Цео говор</h3>
        <button style={styles.cyrillicButton} onClick={handleConvertToCyrillic}>
          Аа → Ћирилица
        </button>
      </div>

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
  },
  title: {
    margin: 0,
    fontSize: '1.1rem',
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
