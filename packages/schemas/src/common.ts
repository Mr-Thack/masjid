import { z } from 'zod';

export const ErrorCode = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export function error(code: ErrorCode, message: string): ErrorResponse {
  return { error: { code, message } };
}

export const httpStatus = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
} as const;

export const JsonResponse = <T>(data: T, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const ErrorJsonResponse = (code: ErrorCode, message: string): Response =>
  JsonResponse(error(code, message), httpStatus[code]);