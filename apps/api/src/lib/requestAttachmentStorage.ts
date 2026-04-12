import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';

type StorageConfig = {
  accountName: string;
  containerName: string;
  accountKey: string;
};

function getStorageConfig(): StorageConfig | null {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME?.trim();
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim();
  if (!accountName || !containerName || !accountKey) return null;
  return { accountName, containerName, accountKey };
}

function encodeBlobPath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function toBlobBaseUrl(config: StorageConfig, storagePath: string): string {
  return `https://${config.accountName}.blob.core.windows.net/${encodeURIComponent(
    config.containerName
  )}/${encodeBlobPath(storagePath)}`;
}

/** Azure recommends starting SAS slightly in the past to avoid intermittent "not yet valid" failures from clock skew. */
const SAS_START_SKEW_MS = 15 * 60 * 1000;

export function buildAttachmentReadUrl(
  storagePath: string,
  expiresInSeconds: number
): string | null {
  const config = getStorageConfig();
  if (!config) return null;
  const now = new Date();
  const startsOn = new Date(now.getTime() - SAS_START_SKEW_MS);
  const expiresOn = new Date(now.getTime() + Math.max(1, expiresInSeconds) * 1000);
  const sharedKeyCredential = new StorageSharedKeyCredential(config.accountName, config.accountKey);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: config.containerName,
      blobName: storagePath,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    sharedKeyCredential
  ).toString();
  return `${toBlobBaseUrl(config, storagePath)}?${sasToken}`;
}

export function buildAttachmentUploadUrl(
  storagePath: string,
  contentType: string,
  expiresInSeconds: number
): string | null {
  const config = getStorageConfig();
  if (!config) return null;
  const now = new Date();
  const startsOn = new Date(now.getTime() - SAS_START_SKEW_MS);
  const expiresOn = new Date(now.getTime() + Math.max(1, expiresInSeconds) * 1000);
  const sharedKeyCredential = new StorageSharedKeyCredential(config.accountName, config.accountKey);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: config.containerName,
      blobName: storagePath,
      permissions: BlobSASPermissions.parse('cw'),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
      contentType,
    },
    sharedKeyCredential
  ).toString();
  return `${toBlobBaseUrl(config, storagePath)}?${sasToken}`;
}

const MAX_DOWNLOAD_BYTES = 60 * 1024 * 1024;

export async function downloadAttachmentBuffer(storagePath: string): Promise<Buffer | null> {
  const config = getStorageConfig();
  if (!config) return null;
  const accountUrl = `https://${config.accountName}.blob.core.windows.net`;
  const credential = new StorageSharedKeyCredential(config.accountName, config.accountKey);
  const serviceClient = new BlobServiceClient(accountUrl, credential);
  const containerClient = serviceClient.getContainerClient(config.containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(storagePath);
  try {
    const props = await blockBlobClient.getProperties();
    const size = typeof props.contentLength === 'number' ? props.contentLength : 0;
    if (size > MAX_DOWNLOAD_BYTES) {
      throw new Error('attachment_too_large_for_download');
    }
    const buf = await blockBlobClient.downloadToBuffer();
    if (buf.length > MAX_DOWNLOAD_BYTES) {
      throw new Error('attachment_too_large_for_download');
    }
    return buf;
  } catch (e) {
    if (e instanceof Error && e.message === 'attachment_too_large_for_download') throw e;
    return null;
  }
}

export async function deleteAttachmentBlobIfExists(storagePath: string): Promise<void> {
  const config = getStorageConfig();
  if (!config) return;
  const accountUrl = `https://${config.accountName}.blob.core.windows.net`;
  const credential = new StorageSharedKeyCredential(config.accountName, config.accountKey);
  const serviceClient = new BlobServiceClient(accountUrl, credential);
  const containerClient = serviceClient.getContainerClient(config.containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(storagePath);
  await blockBlobClient.deleteIfExists();
}

export async function listAttachmentBlobPaths(prefix = ''): Promise<string[]> {
  const config = getStorageConfig();
  if (!config) return [];
  const accountUrl = `https://${config.accountName}.blob.core.windows.net`;
  const credential = new StorageSharedKeyCredential(config.accountName, config.accountKey);
  const serviceClient = new BlobServiceClient(accountUrl, credential);
  const containerClient = serviceClient.getContainerClient(config.containerName);
  const paths: string[] = [];
  for await (const blob of containerClient.listBlobsFlat(prefix ? { prefix } : undefined)) {
    if (typeof blob.name === 'string' && blob.name.trim()) {
      paths.push(blob.name);
    }
  }
  return paths;
}
