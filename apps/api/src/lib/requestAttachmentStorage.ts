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

export function buildAttachmentReadUrl(
  storagePath: string,
  expiresInSeconds: number
): string | null {
  const config = getStorageConfig();
  if (!config) return null;
  const now = new Date();
  const expiresOn = new Date(now.getTime() + Math.max(1, expiresInSeconds) * 1000);
  const sharedKeyCredential = new StorageSharedKeyCredential(config.accountName, config.accountKey);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: config.containerName,
      blobName: storagePath,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: now,
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
  const expiresOn = new Date(now.getTime() + Math.max(1, expiresInSeconds) * 1000);
  const sharedKeyCredential = new StorageSharedKeyCredential(config.accountName, config.accountKey);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: config.containerName,
      blobName: storagePath,
      permissions: BlobSASPermissions.parse('cw'),
      startsOn: now,
      expiresOn,
      protocol: SASProtocol.Https,
      contentType,
    },
    sharedKeyCredential
  ).toString();
  return `${toBlobBaseUrl(config, storagePath)}?${sasToken}`;
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
