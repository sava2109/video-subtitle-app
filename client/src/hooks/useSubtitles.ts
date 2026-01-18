import { useState, useEffect, useCallback } from 'react';
import { getSubtitles, updateAllSubtitles } from '../services/api';

interface Subtitle {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

export const useSubtitles = (projectId: string | undefined) => {
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSubtitles = useCallback(async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await getSubtitles(projectId);
      if (response.success) {
        setSubtitles(response.data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadSubtitles();
  }, [loadSubtitles]);

  const updateSubtitle = (index: number, newText: string) => {
    setSubtitles((prev) =>
      prev.map((subtitle, i) =>
        i === index ? { ...subtitle, text: newText } : subtitle
      )
    );
  };

  const saveSubtitles = async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      await updateAllSubtitles(projectId, subtitles);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addSubtitle = (subtitle: Omit<Subtitle, 'id'>) => {
    setSubtitles((prev) => [
      ...prev,
      { ...subtitle, id: prev.length + 1 },
    ]);
  };

  const removeSubtitle = (id: number) => {
    setSubtitles((prev) =>
      prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, id: i + 1 }))
    );
  };

  return {
    subtitles,
    setSubtitles,
    loading,
    error,
    loadSubtitles,
    updateSubtitle,
    saveSubtitles,
    addSubtitle,
    removeSubtitle,
  };
};

export default useSubtitles;