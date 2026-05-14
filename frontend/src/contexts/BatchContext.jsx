import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { extractTextFromPDF } from '../utils/pdfExtractor';
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
        .map(f => ({ id: `${f.name}_${Math.random()}`, file: f, name: f.name, status: S.pending, result: null, error: null }));
      return [...prev, ...newItems];
    });
  };

  const removeItem = (id) => setQueue(prev => prev.filter(q => q.id !== id));
  const clearDone = () => setQueue(prev => prev.filter(q => q.status !== S.done));

  const retryItem = (id) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: S.pending, error: null } : q));
  };

  const stopAll = () => {
    stopFlag.current = true;
    setRunning(false);
  };

  const runAll = async () => {
    if (running) return;
    stopFlag.current = false;
    setRunning(true);

    // Convert any failed items back to pending so they get retried
    setQueue(prev => {
      const next = prev.map(q => q.status === S.failed ? { ...q, status: S.pending, error: null } : q);
      queueRef.current = next; // Sync ref immediately
      return next;
    });

    while (!stopFlag.current) {
      // Get latest item from ref. Only look for pending.
      const currentItem = queueRef.current.find(q => q.status === S.pending);

      if (!currentItem) {
        break;
      }

      // Mark as analyzing
      setQueue(prev => prev.map(q => q.id === currentItem.id ? { ...q, status: S.analyzing } : q));
      
      try {
        const text = await extractTextFromPDF(currentItem.file);
        if (!text.trim()) throw new Error('No text found in PDF.');
        
        // Check stop flag before heavy network call just in case
        if (stopFlag.current) break;

        const result = await analyzeText(text, currentItem.name, 'pdf');
        setQueue(prev => prev.map(q => q.id === currentItem.id ? { ...q, status: S.done, result } : q));
      } catch (err) {
        setQueue(prev => prev.map(q => q.id === currentItem.id ? { ...q, status: S.failed, error: err.message } : q));
      }
      
      // Small delay between files to avoid rate limits, and gives React time to sync queueRef via useEffect
      await new Promise(r => setTimeout(r, 800));
    }

    // Process might have ended naturally or via stopFlag
    if (stopFlag.current) {
      // If stopped, revert any 'analyzing' back to 'pending'
      setQueue(prev => prev.map(q => q.status === S.analyzing ? { ...q, status: S.pending } : q));
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
