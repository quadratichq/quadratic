import {
  ImageContentSchema,
  PdfFileContentSchema,
  TextFileContentSchema,
  type ImageContent,
  type PdfFileContent,
  type TextFileContent,
} from '../../typesAndSchemasAI';

export const isSupportedImageMimeType = (mimeType: string): mimeType is ImageContent['mimeType'] => {
  return ImageContentSchema.shape.mimeType.safeParse(mimeType).success;
};

export const isSupportedPdfMimeType = (mimeType: string): mimeType is PdfFileContent['mimeType'] => {
  return PdfFileContentSchema.shape.mimeType.safeParse(mimeType).success;
};

export const isSupportedTextMimeType = (mimeType: string): mimeType is TextFileContent['mimeType'] => {
  return TextFileContentSchema.shape.mimeType.safeParse(mimeType).success;
};

export const isSupportedMimeType = (
  mimeType: string
): mimeType is ImageContent['mimeType'] | PdfFileContent['mimeType'] | TextFileContent['mimeType'] => {
  return isSupportedImageMimeType(mimeType) || isSupportedPdfMimeType(mimeType) || isSupportedTextMimeType(mimeType);
};

export const getFileTypeLabel = (mimeType: string): string => {
  if (isSupportedImageMimeType(mimeType)) return 'Image';
  if (isSupportedPdfMimeType(mimeType)) return 'PDF';
  if (isSupportedTextMimeType(mimeType)) return 'Text';
  return 'Unknown';
};

export const dataUrlToMimeTypeAndData = (dataUrl: string) => {
  return {
    mimeType: dataUrl.split(';')?.[0]?.split(':')?.[1],
    data: dataUrl.split(',')?.[1],
  };
};

export const getDataBase64String = (content: ImageContent | PdfFileContent | TextFileContent) => {
  return `data:${content.mimeType};base64,${content.data}`;
};
