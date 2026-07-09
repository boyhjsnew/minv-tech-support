export type RepxImageSourceType = 'embedded' | 'bound' | 'url';

export interface RepxExtractedImage {
  name: string;
  controlType: string;
  source: RepxImageSourceType;
  mimeType: string | null;
  base64: string | null;
  dataUrl: string | null;
  imageUrl: string | null;
  expression: string | null;
  sizeBytes: number | null;
  resourceKey?: string | null;
}

export interface RepxExtractResult {
  fileName: string;
  format: 'xml' | 'zip' | 'codedom';
  xmlSources: string[];
  images: RepxExtractedImage[];
  boundPictureBoxes: RepxExtractedImage[];
  codedomMeta?: {
    devExpressVersion: string | null;
    pictureBoxNames: string[];
    resourceKeys: string[];
  };
  summary: {
    totalPictureBoxes: number;
    embeddedCount: number;
    boundCount: number;
    urlCount: number;
  };
}
