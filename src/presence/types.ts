export interface UserPresence {
  cursor?: {
    x: number;
    y: number;
    visible: boolean;
  };
  name: string;
  email?: string;
  color: string;
}
