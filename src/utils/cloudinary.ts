import { v2 as cloudinary } from 'cloudinary';
import { cloudinaryConfig, hasCloudinary } from '../config/env.js';

const folder = cloudinaryConfig.folder || 'bunzimeal/uploads';

export function configureCloudinary() {
  if (!hasCloudinary) {
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_URL or individual Cloudinary env vars.');
  }
  cloudinary.config({
    cloud_name: cloudinaryConfig.cloudName,
    api_key: cloudinaryConfig.apiKey,
    api_secret: cloudinaryConfig.apiSecret,
    secure: true,
  });
}

export async function uploadImageBuffer(
  buffer: Buffer,
  opts?: { folder?: string; public_id?: string; resource_type?: 'image' | 'auto' }
) {
  configureCloudinary();
  const timeoutMs = 25000;
  const targetFolder = (opts?.folder || folder).replace(/\/$/, '');

  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Image upload timed out')), timeoutMs);
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: targetFolder,
        resource_type: opts?.resource_type || 'image',
        public_id: opts?.public_id,
      },
      (error: unknown, result: { secure_url?: string; public_id?: string } | undefined) => {
        clearTimeout(timer);
        if (error || !result?.secure_url || !result.public_id) {
          return reject(error || new Error('Cloudinary upload failed'));
        }
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    uploadStream.on('error', (err: unknown) => {
      clearTimeout(timer);
      reject(err || new Error('Cloudinary upload stream error'));
    });
    uploadStream.end(buffer);
  });
}

export async function uploadRecipeImage(buffer: Buffer, filename?: string) {
  const result = await uploadImageBuffer(buffer, {
    public_id: filename?.replace(/\.[^/.]+$/, ''),
  });
  return { url: result.secure_url };
}

export default uploadImageBuffer;
