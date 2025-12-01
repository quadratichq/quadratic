import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';

interface UseSpeechToTextOptions {
  onTranscriptionComplete?: (text: string) => void;
  languageCode?: string;
}

interface UseSpeechToTextReturn {
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  toggleRecording: () => Promise<void>;
}

export const useSpeechToText = (options: UseSpeechToTextOptions = {}): UseSpeechToTextReturn => {
  const { onTranscriptionComplete, languageCode = 'en-US' } = options;
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine the best mimeType supported by the browser
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav',
      ];

      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error('No supported audio format found');
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType });
          
          // Convert blob to base64
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1]; // Remove data URL prefix

            try {
              // Call the API
              const endpoint = `${apiClient.getApiUrl()}/v0/ai/speech-to-text`;
              const token = await authClient.getTokenOrRedirect();
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  audio: base64Audio,
                  mimeType: selectedMimeType,
                  languageCode,
                } satisfies ApiTypes['/v0/ai/speech-to-text.POST.request']),
              });

              if (!response.ok) {
                throw new Error(`Speech-to-text API error: ${response.statusText}`);
              }

              const data = await response.json();
              const parsedData = ApiSchemas['/v0/ai/speech-to-text.POST.response'].parse(data);
              
              if (parsedData.text && onTranscriptionComplete) {
                onTranscriptionComplete(parsedData.text);
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to transcribe audio');
            } finally {
              setIsProcessing(false);
            }
          };

          reader.onerror = () => {
            setError('Failed to read audio data');
            setIsProcessing(false);
          };

          reader.readAsDataURL(audioBlob);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to transcribe audio');
          setIsProcessing(false);
        } finally {
          // Stop all tracks
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
    }
  }, [languageCode, onTranscriptionComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isRecording]);

  return {
    isRecording,
    isProcessing,
    error,
    startRecording,
    stopRecording,
    toggleRecording,
  };
};

