export interface ApiSuccess<T> {
  ok: true;
  data: T;
  requestId?: string;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export function success<T>(data: T, requestId?: string): ApiSuccess<T> {
  return { ok: true, data, requestId };
}

export function failure(code: string, message: string, requestId?: string, details?: unknown): ApiError {
  return {
    ok: false,
    error: { code, message, details },
    requestId
  };
}
