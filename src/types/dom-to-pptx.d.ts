declare module 'dom-to-pptx' {
  export interface DomToPptxOptions {
    fileName?: string;
    skipDownload?: boolean;
    autoEmbedFonts?: boolean;
    svgAsVector?: boolean;
    layout?: string;
    width?: number;
    height?: number;
  }

  export function exportToPptx(
    target: string | HTMLElement | Array<string | HTMLElement>,
    options?: DomToPptxOptions,
  ): Promise<Blob>;
}
