import type { InvocationContext } from '@azure/functions';

type LogLevel = 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;
type ContextLogger = InvocationContext & {
  info?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
  log?: (message: string) => void;
};

function toJsonLine(
  level: LogLevel,
  event: string,
  context: InvocationContext | undefined,
  fields: LogFields
): string {
  return JSON.stringify({
    level,
    event,
    functionName: context?.functionName,
    invocationId: context?.invocationId,
    ...fields,
  });
}

export function logInfo(
  context: InvocationContext | undefined,
  event: string,
  fields: LogFields = {}
): void {
  const message = toJsonLine('info', event, context, fields);
  const logger = context as ContextLogger | undefined;
  if (logger?.info) {
    logger.info(message);
    return;
  }
  if (logger?.log) {
    logger.log(message);
    return;
  }
  console.log(message);
}

export function logWarn(
  context: InvocationContext | undefined,
  event: string,
  fields: LogFields = {}
): void {
  const message = toJsonLine('warn', event, context, fields);
  const logger = context as ContextLogger | undefined;
  if (logger?.warn) {
    logger.warn(message);
    return;
  }
  if (logger?.log) {
    logger.log(message);
    return;
  }
  console.warn(message);
}

export function logError(
  context: InvocationContext | undefined,
  event: string,
  fields: LogFields = {}
): void {
  const message = toJsonLine('error', event, context, fields);
  const logger = context as ContextLogger | undefined;
  if (logger?.error) {
    logger.error(message);
    return;
  }
  if (logger?.log) {
    logger.log(message);
    return;
  }
  console.error(message);
}
