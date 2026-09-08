// ─── Storage Port ─────────────────────────────────────────────────────────
// Interface for file storage operations (S3, local, etc.)

export interface IStorageService {
  /**
   * Uploads a file to the storage backend.
   * @param key - The storage key (path) for the file
   * @param buffer - The file content as a Buffer
   * @param contentType - MIME type of the file (e.g., 'image/png')
   * @returns The storage key of the uploaded file
   */
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;

  /**
   * Deletes a file from the storage backend.
   * @param key - The storage key (path) of the file to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Generates a pre-signed URL for temporary access to a file.
   * @param key - The storage key (path) of the file
   * @param expiresInSeconds - URL expiration time in seconds (default: 7 days)
   * @returns A pre-signed URL string
   */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
