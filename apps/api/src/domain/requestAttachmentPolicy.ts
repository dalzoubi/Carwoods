import { validationError } from './errors.js';
import type { UploadMediaType } from './requestValidation.js';

export function validateVideoDurationSeconds(
  mediaType: UploadMediaType,
  durationSeconds: number | undefined,
  maxDurationSeconds: number
): void {
  if (mediaType !== 'VIDEO') return;
  if (!Number.isFinite(durationSeconds) || Number(durationSeconds) <= 0) {
    throw validationError('missing_video_duration');
  }
  if (Number(durationSeconds) > maxDurationSeconds) {
    throw Object.assign(validationError('video_too_long'), {
      max_seconds: maxDurationSeconds,
    });
  }
}
