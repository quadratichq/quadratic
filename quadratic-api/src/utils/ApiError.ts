export class ApiError extends Error {
  status: number;
  meta: any;

  constructor(status: number, message: string, meta?: any) {
    super(message);
    this.status = status;
    this.meta = meta ? meta : null;
  }
}
