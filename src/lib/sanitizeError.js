export function sanitizeError(err) {
    if (err == null) return { message: 'Unknown error' };
    if (typeof err === 'string') return { message: err };
    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            code: err.code ?? undefined,
            status: err.status ?? err.statusCode ?? undefined,
        };
    }
    if (typeof err === 'object') {
        const code = err.code ?? err.errorCode ?? undefined;
        const status = err.status ?? err.statusCode ?? err.httpStatus ?? undefined;
        const message = err.message ?? err.error ?? err.statusText ?? 'Unknown error';
        return { code, status, message };
    }
    return { message: String(err) };
}
