export const MAX_REQUEST_PHOTOS = 10;
export const MAX_REQUEST_VIDEOS = 2;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const PHOTO_MIME_PREFIXES = ['image/'];
const VIDEO_MIME_PREFIXES = ['video/'];
const FILE_MIME_ALLOWED = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export type UploadMediaType = 'PHOTO' | 'VIDEO' | 'FILE';

export function detectMediaType(contentType: string): UploadMediaType | null {
  const mime = contentType.trim().toLowerCase();
  if (!mime) return null;
  if (PHOTO_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) return 'PHOTO';
  if (VIDEO_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) return 'VIDEO';
  if (FILE_MIME_ALLOWED.includes(mime)) return 'FILE';
  return null;
}

export function maxBytesForMediaType(mediaType: UploadMediaType): number {
  if (mediaType === 'PHOTO') return MAX_PHOTO_BYTES;
  if (mediaType === 'VIDEO') return MAX_VIDEO_BYTES;
  return MAX_FILE_BYTES;
}

