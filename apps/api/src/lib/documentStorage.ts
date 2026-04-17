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

const DEFAULT_CONTAINER = 'carwoods-documents-prod';
const SAS_START_SKEW_MS = 15 * 60 * 1000;
let ensuredContainerKey: string | null = null;

function getStorageConfig(): StorageConfig | null {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim();
  const containerName = process.env.DOCUMENT_STORAGE_CONTAINER_NAME?.trim()
    || DEFAULT_CONTAINER;
  if (!accountName || !accountKey || !containerName) return null;
  return { accountName, accountKey, containerName };
}

function encodeBlobPath(path: string): string {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function toBlobBaseUrl(config: StorageConfig, storagePath: string): string {
  return `https://${config.accountName}.blob.core.windows.net/${encodeURIComponent(
    config.containerName
  )}/${encodeBlobPath(storagePath)}`;
}

function getContainerClient(config: StorageConfig) {
  const accountUrl = `https://${config.accountName}.blob.core.windows.net`;
  const credential = new StorageSharedKeyCredential(config.accountName, config.accountKey);
  const serviceClient = new BlobServiceClient(accountUrl, credential);
  return serviceClient.getContainerClient(config.containerName);
}

export async function ensureDocumentContainer(): Promise<boolean> {
  const config = getStorageConfig();
  if (!config) return false;
  const cacheKey = `${config.accountName}/${config.containerName}`;
  if (ensuredContainerKey === cacheKey) return true;
  const containerClient = getContainerClient(config);
  await containerClient.createIfNotExists();
  ensuredContainerKey = cacheKey;
  return true;
}

export function buildDocumentUploadUrl(
  storagePath: string,
  contentType: string,
  expiresInSeconds: number
): string | null {
  const config = getStorageConfig();
  if (!config) return null;
  const now = new Date();
  const startsOn = new Date(now.getTime() - SAS_START_SKEW_MS);
  const expiresOn = new Date(now.getTime() + Math.max(1, expiresInSeconds) * 1000);
  const credential = new StorageSharedKeyCredential(config.accountName, config.accountKey);
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
    credential
  ).toString();
  return `${toBlobBaseUrl(config, storagePath)}?${sasToken}`;
}

export function buildDocumentReadUrl(storagePath: string, expiresInSeconds: number): string | null {
  const config = getStorageConfig();
  if (!config) return null;
  const now = new Date();
  const startsOn = new Date(now.getTime() - SAS_START_SKEW_MS);
  const expiresOn = new Date(now.getTime() + Math.max(1, expiresInSeconds) * 1000);
  const credential = new StorageSharedKeyCredential(config.accountName, config.accountKey);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: config.containerName,
      blobName: storagePath,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    credential
  ).toString();
  return `${toBlobBaseUrl(config, storagePath)}?${sasToken}`;
}

export async function deleteDocumentBlobIfExists(storagePath: string): Promise<void> {
  const config = getStorageConfig();
  if (!config) return;
  const containerClient = getContainerClient(config);
  await containerClient.getBlockBlobClient(storagePath).deleteIfExists();
}
