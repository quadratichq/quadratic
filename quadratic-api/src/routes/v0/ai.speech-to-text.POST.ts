import type { Response } from 'express';
import { speechClient } from '../../ai/providers';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/ai/speech-to-text.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/ai/speech-to-text.POST.response']>) {
  const { body } = parseRequest(req, schema);
  const { audio, mimeType, languageCode = 'en-US' } = body;

  // Convert base64 audio to buffer
  const audioBuffer = Buffer.from(audio, 'base64');

  // Determine encoding based on mimeType
  let encoding: 'WEBM_OPUS' | 'MP3' | 'LINEAR16' | 'FLAC' | 'MULAW' | 'AMR' | 'AMR_WB' | 'OGG_OPUS' | 'SPEEX_WITH_HEADER_BYTE' | undefined;
  let sampleRateHertz: number | undefined;

  if (mimeType.includes('webm') || mimeType.includes('opus')) {
    encoding = 'WEBM_OPUS';
  } else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
    encoding = 'MP3';
  } else if (mimeType.includes('flac')) {
    encoding = 'FLAC';
  } else if (mimeType.includes('wav') || mimeType.includes('linear')) {
    encoding = 'LINEAR16';
    sampleRateHertz = 16000; // Default sample rate for LINEAR16
  } else {
    // Default to WEBM_OPUS for browser recordings
    encoding = 'WEBM_OPUS';
  }

  // Configure the request
  const requestConfig: any = {
    encoding: encoding,
    languageCode: languageCode,
    model: 'latest_long',
    useEnhanced: true,
    enableAutomaticPunctuation: true,
    enableSpokenPunctuation: false,
    enableSpokenEmojis: false,
  };

  // Only set sampleRateHertz for LINEAR16 encoding
  if (encoding === 'LINEAR16' && sampleRateHertz) {
    requestConfig.sampleRateHertz = sampleRateHertz;
  }

  const request = {
    config: requestConfig,
    audio: {
      content: audioBuffer,
    },
  };

  try {
    // Perform the transcription
    const [response] = await speechClient.recognize(request);
    
    if (!response.results || response.results.length === 0) {
      return res.status(200).json({ text: '' });
    }

    // Get the first alternative from the first result
    const transcription = response.results
      .map((result) => result.alternatives?.[0]?.transcript)
      .filter(Boolean)
      .join(' ');

    const data: ApiTypes['/v0/ai/speech-to-text.POST.response'] = {
      text: transcription || '',
    };

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}

