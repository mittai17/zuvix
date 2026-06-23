import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';

const WAKE_WORDS = ['hey jarvis', 'hey zuvix'];

export interface WakeWordContextValue {
  isListening: boolean;
  setIsListening: (val: boolean) => void;
  transcript: string;
  hasPermission: boolean;
  startBackgroundListening: () => Promise<void>;
  stopBackgroundListening: () => void;
}

const WakeWordContext = createContext<WakeWordContextValue | null>(null);

export function WakeWordProvider({ children }: { children: ReactNode }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(isListening);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);
  
  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);
      // We can stop the stream immediately since SpeechRecognition handles its own audio
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.error("Microphone permission denied:", err);
      setHasPermission(false);
      return false;
    }
  };

  const startBackgroundListening = useCallback(async () => {
    const granted = await requestPermission();
    if (!granted) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition API not supported in this browser.");
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    // Continuous mode allows it to keep running and sending results
    recognition.continuous = true;
    // We want interim results so we can catch the wake word immediately
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptChunk = event.results[i][0].transcript.toLowerCase();
        if (event.results[i].isFinal) {
          final += transcriptChunk;
        } else {
          interim += transcriptChunk;
        }
      }
      
      const currentTranscript = (final + ' ' + interim).trim();
      setTranscript(currentTranscript);

      // Trigger the active listening state if wake word is recognized
      if (!isListeningRef.current && WAKE_WORDS.some(word => currentTranscript.includes(word))) {
        setIsListening(true);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setHasPermission(false);
      }
      // no-speech or aborted are expected during background listening
    };

    recognition.onend = () => {
      // Auto-restart to act as a background daemon, as long as it's the current recognition instance
      if (recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch (err) {
          console.error("Failed to restart recognition:", err);
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error("Failed to start recognition:", err);
    }
  }, []);

  const stopBackgroundListening = useCallback(() => {
    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition.stop();
      } catch (err) {}
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      stopBackgroundListening();
    };
  }, [stopBackgroundListening]);

  return (
    <WakeWordContext.Provider value={{
      isListening,
      setIsListening,
      transcript,
      hasPermission,
      startBackgroundListening,
      stopBackgroundListening
    }}>
      {children}
    </WakeWordContext.Provider>
  );
}

export function useWakeWord() {
  const ctx = useContext(WakeWordContext);
  if (!ctx) {
    throw new Error('useWakeWord must be used within a WakeWordProvider');
  }
  return ctx;
}
