import { useState, useCallback } from 'react';
import { Annotation, NormalizedPoint } from '../types';

export interface UseAnnotationsReturn {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  add: (annotation: Annotation) => void;
  update: (id: string, partial: Partial<Annotation>) => void;
  remove: (id: string) => void;
  select: (id: string | null) => void;
  clearAll: () => void;
  moveAnnotation: (id: string, dx: number, dy: number) => void;
}

const generateId = () => `ann-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

export const createAnnotationId = generateId;

export function useAnnotations(): UseAnnotationsReturn {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  const add = useCallback((annotation: Annotation) => {
    setAnnotations(prev => [...prev, annotation]);
    setSelectedAnnotationId(annotation.id);
  }, []);

  const update = useCallback((id: string, partial: Partial<Annotation>) => {
    setAnnotations(prev =>
      prev.map(a => a.id === id ? { ...a, ...partial } as Annotation : a)
    );
  }, []);

  const remove = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    setSelectedAnnotationId(prev => prev === id ? null : prev);
  }, []);

  const select = useCallback((id: string | null) => {
    setSelectedAnnotationId(id);
  }, []);

  const clearAll = useCallback(() => {
    setAnnotations([]);
    setSelectedAnnotationId(null);
  }, []);

  const moveAnnotation = useCallback((id: string, dx: number, dy: number) => {
    setAnnotations(prev =>
      prev.map(a => {
        if (a.id !== id) return a;
        const clamp = (v: number) => Math.max(0, Math.min(1, v));
        switch (a.type) {
          case 'pin':
            return { ...a, position: { x: clamp(a.position.x + dx), y: clamp(a.position.y + dy) } };
          case 'rectangle':
            return {
              ...a,
              topLeft: { x: clamp(a.topLeft.x + dx), y: clamp(a.topLeft.y + dy) },
              bottomRight: { x: clamp(a.bottomRight.x + dx), y: clamp(a.bottomRight.y + dy) },
            };
          case 'arrow':
            return {
              ...a,
              start: { x: clamp(a.start.x + dx), y: clamp(a.start.y + dy) },
              end: { x: clamp(a.end.x + dx), y: clamp(a.end.y + dy) },
            };
          case 'sketch':
            return { ...a, points: a.points.map(p => ({ x: clamp(p.x + dx), y: clamp(p.y + dy) })) };
          default:
            return a;
        }
      })
    );
  }, []);

  return { annotations, selectedAnnotationId, add, update, remove, select, clearAll, moveAnnotation };
}
