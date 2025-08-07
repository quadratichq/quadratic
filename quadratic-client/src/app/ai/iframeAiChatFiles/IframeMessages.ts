export type DbFile = {
  chatId: string;
  fileId: string;
  name: string;
  mimeType: string;
  lastModified: number;
  size: number;
  data: ArrayBuffer;
};

export type FromIframeReady = {
  type: 'iframe-indexeddb-ready';
};

export type ToIframeSaveFiles = {
  type: 'save-files';
  dbFiles: DbFile[];
};
export type FromIframeSaveFilesResponse = {
  type: 'save-files-response';
  success: boolean;
  dbFiles: DbFile[];
  error?: any;
};

export type ToIframeGetFiles = {
  type: 'get-files';
  chatId: string;
};
export type FromIframeGetFilesResponse = {
  type: 'get-files-response';
  dbFiles: DbFile[];
  error?: any;
};

export type ToIframeDeleteFiles = {
  type: 'delete-files';
  chatId: string;
  fileIds: string[];
};
export type FromIframeDeleteFilesResponse = {
  type: 'delete-files-response';
  success: boolean;
  fileIds: string[];
  error?: any;
};

export type ToIframeMessages = ToIframeSaveFiles | ToIframeGetFiles | ToIframeDeleteFiles;
export type FromIframeMessages =
  | FromIframeReady
  | FromIframeSaveFilesResponse
  | FromIframeGetFilesResponse
  | FromIframeDeleteFilesResponse;
