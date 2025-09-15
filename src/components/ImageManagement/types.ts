// src/components/ImageManagement/types.ts
export interface ImageItem {
  id: string;
  name: string;
  url: string;
  brand_id: string;
  brand_name: string;
  size: number;
  uploaded_at: string;
  content_type: string;
}

export interface Brand {
  id: string;
  brand_name: string;
  brand_normalized: string;
  logo_url?: string;
  is_active: boolean;
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}
