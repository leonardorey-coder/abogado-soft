import { useState, useRef, useCallback, useEffect } from "react";

interface UseFileDragDropOptions {
  onDrop: (files: File[]) => void;
  disabled?: boolean;
}

export function useFileDragDrop({ onDrop, disabled = false }: UseFileDragDropOptions) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleWindowDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (e.dataTransfer?.types.includes("Files") && !disabled) {
        setIsDraggingOver(true);
      }
    },
    [disabled]
  );

  const handleWindowDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.types.includes("Files")) {
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDraggingOver(false);
      }
    }
  }, []);

  const handleWindowDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
  }, []);

  const handleWindowDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
      if (e.dataTransfer?.files.length) {
        onDrop(Array.from(e.dataTransfer.files));
      }
    },
    [onDrop]
  );

  useEffect(() => {
    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);
    return () => {
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, [handleWindowDragEnter, handleWindowDragLeave, handleWindowDragOver, handleWindowDrop]);

  return { isDraggingOver };
}
