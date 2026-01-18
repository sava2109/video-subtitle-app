import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VideoUploader from '../components/VideoUploader';
import { getVideos, deleteVideo } from '../services/api';

interface VideoProject {
  id: string;
  video: {
    originalName: string;
    duration?: number;
  };
  status: string;
  subtitleCount: number;
  createdAt: string;
}

const Home: React.FC = () => {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadProjects = async () => {
    try {
      const response = await getVideos();
      if (response.success) {
        setProjects(response.data || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleUploadSuccess = (projectId: string) => {
    navigate(`/editor/${projectId}`);
  };

  const handleDelete = async (projectId: string) => {
    if (window.confirm('Да ли сте сигурни да желите да обришете овај пројекат?')) {
      try {
        await deleteVideo(projectId);
        loadProjects();
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🎬 Видео Титловање</h1>
        <p style={styles.subtitle}>Аутоматско генерисање титлова на ћирилици</p>
      </header>

      <section style={styles.uploadSection}>
        <VideoUploader onSuccess={handleUploadSuccess} />
      </section>

      <section style={styles.projectsSection}>
        <h2 style={styles.sectionTitle}>📁 Моји Пројекти</h2>
        
        {loading ? (
          <p>Учитавање...</p>
        ) : projects.length === 0 ? (
          <p style={styles.emptyMessage}>Нема пројеката. Уплоадујте видео да бисте почели!</p>
        ) : (
          <div style={styles.projectGrid}>
            {projects.map((project) => (
              <div key={project.id} style={styles.projectCard}>
                <div style={styles.projectInfo}>
                  <h3 style={styles.projectName}>{project.video.originalName}</h3>
                  <p style={styles.projectMeta}>
                    ⏱ {formatDuration(project.video.duration)} | 
                    📝 {project.subtitleCount} титлова |
                    📊 {project.status}
                  </p>
                </div>
                <div style={styles.projectActions}>
                  <button 
                    style={styles.editButton}
                    onClick={() => navigate(`/editor/${project.id}`)}
                  >
                    ✏️ Уреди
                  </button>
                  <button 
                    style={styles.deleteButton}
                    onClick={() => handleDelete(project.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
  },
  title: {
    fontSize: '2.5rem',
    color: '#333',
    marginBottom: '10px',
  },
  subtitle: {
    fontSize: '1.2rem',
    color: '#666',
  },
  uploadSection: {
    marginBottom: '40px',
  },
  projectsSection: {
    marginTop: '40px',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    color: '#333',
    marginBottom: '20px',
  },
  emptyMessage: {
    color: '#666',
    textAlign: 'center',
    padding: '40px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
  },
  projectGrid: {
    display: 'grid',
    gap: '20px',
  },
  projectCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    margin: '0 0 5px 0',
    fontSize: '1.1rem',
  },
  projectMeta: {
    margin: 0,
    fontSize: '0.9rem',
    color: '#666',
  },
  projectActions: {
    display: 'flex',
    gap: '10px',
  },
  editButton: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  deleteButton: {
    padding: '8px 12px',
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default Home;