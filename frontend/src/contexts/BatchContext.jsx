import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { extractTextFromPDF, splitIntoChunks, mergeChunkResults } from '../utils/pdfExtractor';
import { analyzeText } from '../utils/apiClient';

const BatchContext = createContext(null);

export const S = { pending: 'pending', analyzing: 'analyzing', done: 'done', failed: 'failed' };

export function BatchProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [running, setRunning] = useState(false);
  const queueRef = useRef([]);
  const stopFlag = useRef(false);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const addFiles = (files) => {
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf');
    if (!pdfs.length) return;
    setQueue(prev => {
      const existingNames = new Set(prev.map(q => q.name));
      const newItems = pdfs
        .filter(f => !existingNames.has(f.name))
        .map(f => ({ id: `${f.name}_${Math.random()}`, file: f, name: f.name, status: S.pending, result: null, error: null, progress: null }));
      return [...prev, ...newItems];
    });
  };

  const removeItem = (id) => setQueue(prev => prev.filter(q => q.id !== id));
  const clearDone = () => setQueue(prev => prev.filter(q => q.status !== S.done));

  const retryItem = (id) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: S.pending, error: null, progress: null } : q));
  };

  const stopAll = () => {
    stopFlag.current = true;
    setRunning(false);
  };

  /** Update a single item in the queue by id */
  const updateItem = (id, patch) =>
    setQueue(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));

  /**
   * Analyze one file — handles chunking transparently.
   * For large PDFs (> 48K chars of extracted text) the text is split into pages-aligned
   * chunks, each analyzed separately, then the results are merged.
   */
  const analyzeFile = async (item) => {
    // Mark as analyzing
    updateItem(item.id, { status: S.analyzing, progress: null });

    // 1. Extract text
    const text = await extractTextFromPDF(item.file);
    if (!text.trim()) throw new Error('No text found in PDF.');

    if (stopFlag.current) throw new Error('Stopped by user.');

    // 2. Split into chunks if needed
    const chunks = splitIntoChunks(text);
    const totalChunks = chunks.length;

    if (totalChunks === 1) {
      // Fast path — small PDF, single request
      updateItem(item.id, { progress: null }); // no chunk label needed
      const result = await analyzeText(text, item.name, 'pdf');
      return result;
    }

    // 3. Large PDF — process each chunk
    const chunkResults = [];
    for (let i = 0; i < totalChunks; i++) {
      if (stopFlag.current) throw new Error('Stopped by user.');

      updateItem(item.id, {
        progress: `Chunk ${i + 1} / ${totalChunks} — analyzing…`,
      });

      const chunkLabel = `${item.name} [chunk ${i + 1}/${totalChunks}]`;
      const result = await analyzeText(chunks[i], chunkLabel, 'pdf');
      chunkResults.push(result);

      // Small delay between chunk calls to reduce rate-limit pressure
      if (i < totalChunks - 1) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    // 4. Merge all chunk results
    updateItem(item.id, { progress: 'Merging chunks…' });
    return mergeChunkResults(chunkResults);
  };

  const runAll = async () => {
    if (running) return;
    stopFlag.current = false;
    setRunning(true);

    // Convert any failed items back to pending so they get retried
    setQueue(prev => {
      const next = prev.map(q => q.status === S.failed ? { ...q, status: S.pending, error: null, progress: null } : q);
      queueRef.current = next;
      return next;
    });

    while (!stopFlag.current) {
      const currentItem = queueRef.current.find(q => q.status === S.pending);

      if (!currentItem) break;

      let success = false;
      let lastErrorMsg = '';
      const maxRetries = 2;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (stopFlag.current) break;

        try {
          if (attempt > 0) {
            updateItem(currentItem.id, {
              status: S.analyzing,
              progress: `Retrying (attempt ${attempt}/${maxRetries})…`,
            });
            // Progressive cooldown before retry: 3s, 6s
            await new Promise(r => setTimeout(r, 3000 * attempt));
          }

          const result = await analyzeFile(currentItem);
          setQueue(prev => prev.map(q =>
            q.id === currentItem.id ? { ...q, status: S.done, result, progress: null } : q
          ));
          success = true;
          break;
        } catch (err) {
          lastErrorMsg = err.message;
          console.warn(`Attempt ${attempt + 1} for ${currentItem.name} failed:`, err.message);
          
          if (stopFlag.current || err.message === 'Stopped by user.') {
            break;
          }
        }
      }

      if (stopFlag.current) {
        // Revert to pending on manual stop
        setQueue(prev => prev.map(q =>
          q.id === currentItem.id ? { ...q, status: S.pending, progress: null } : q
        ));
        break;
      }

      if (!success) {
        setQueue(prev => prev.map(q =>
          q.id === currentItem.id ? { ...q, status: S.failed, error: lastErrorMsg, progress: null } : q
        ));
      }

      // Medium delay between files to give APIs room to process request streams
      await new Promise(r => setTimeout(r, 2000));
    }

    // Revert any still-analyzing items to pending if stopped
    if (stopFlag.current) {
      setQueue(prev => prev.map(q =>
        q.status === S.analyzing ? { ...q, status: S.pending, progress: null } : q
      ));
    }

    setRunning(false);
  };

  return (
    <BatchContext.Provider value={{ queue, setQueue, running, addFiles, removeItem, clearDone, retryItem, runAll, stopAll }}>
      {children}
    </BatchContext.Provider>
  );
}

export function useBatch() {
  const context = useContext(BatchContext);
  if (!context) {
    throw new Error('useBatch must be used within a BatchProvider');
  }
  return context;
}
