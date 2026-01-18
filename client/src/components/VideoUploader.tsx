import React, { useState, useRef } from 'react';
import { uploadVideo } from '../services/api';

interface VideoUploaderProps {
  onSuccess?: (projectId: string) => void;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ onSuccess }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file type
    const validTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-matroska', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      setError('Неподржан формат видеа. Користите MP4, AVI, MOV, MKV или WebM.');
      return;
    }

    // Validate file size (500MB)
    if (file.size > 500 * 1024 * 1024) {
      setError('Видео је превелик. Максимална величина је 500MB.');
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const response = await uploadVideo(file);
      
      if (response.success && response.data?.projectId) {
        setProgress(100);
        if (onSuccess) {
          onSuccess(response.data.projectId);
        }
      } else {
        throw new Error(response.error || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.message || 'Грешка при уплоаду видеа.');
    } finally {
      setUploading(false);
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.dropzone,
          ...(dragActive ? styles.dropzoneActive : {}),
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          onChange={handleChange}
          style={styles.input}
        />

        {uploading ? (
          <div style={styles.uploadingState}>
            <div style={styles.spinner}>⏳</div>
            <p>Уплоадовање... {progress}%</p>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <div style={styles.defaultState}>
            <div style={styles.icon}>🎬</div>
            <p style={styles.mainText}>Превуците видео овде</p>
            <p style={styles.subText}>или</p>
            <button style={styles.button} onClick={onButtonClick}>
              Изаберите фајл
            </button>
            <p style={styles.formatText}>MP4, AVI, MOV, MKV, WebM (до 500MB)</p>
          </div>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    width: '100%',
  },
  dropzone: {
    border: '3px dashed #ccc',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center',
    backgroundColor: '#fafafa',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  dropzoneActive: {
    borderColor: '#007bff',
    backgroundColor: '#e7f1ff',
  },
  input: {
    display: 'none',
  },
  defaultState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  uploadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px',
  },
  icon: {
    fontSize: '4rem',
  },
  spinner: {
    fontSize: '3rem',
    animation: 'spin 1s linear infinite',
  },
  mainText: {
    fontSize: '1.3rem',
    color: '#333',
    margin: 0,
  },
  subText: {
    color: '#666',
    margin: 0,
  },
  button: {
    padding: '12px 30px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  formatText: {
    fontSize: '0.85rem',
    color: '#999',
    margin: 0,
  },
  progressBar: {
    width: '200px',
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007bff',
    transition: 'width 0.3s ease',
  },
  error: {
    marginTop: '15px',
    padding: '10px 15px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '4px',
    textAlign: 'center',
  },
};

export default VideoUploader;