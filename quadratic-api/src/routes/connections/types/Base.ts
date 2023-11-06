export interface ConnectionField {
  name: string;
  description: string;
  type: string | number | boolean;
  sensitive: 'AWS_SECRET' | 'ENCRYPTED' | 'PLAINTEXT';
  required: boolean;
  default?: string;
}

export interface ConnectionConfiguration {
  name: string;
  type: string;
  description: string;
  connectionFields: ConnectionField[];
  cellLevelInput: 'SINGLE_QUERY_EDITOR';
}
