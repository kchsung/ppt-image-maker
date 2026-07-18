import type {
  GeneratedSlideImage,
  PptEditableShape,
  PptEditableSlideLayout,
  PptEditableTextBlock,
} from '@/types/models/pptMaker.model';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

interface PptSlidePreviewProps {
  image: GeneratedSlideImage;
  layout?: PptEditableSlideLayout | null;
  logoImageDataUrl?: string;
  alt: string;
  className?: string;
}

export function PptSlidePreview({ image, layout, logoImageDataUrl, alt, className }: PptSlidePreviewProps) {
  const imageSource = image.imageDataUrl ?? image.imageUrl;
  const isImageFallback = !layout || layout.visualStrategy === 'image-fallback';

  return (
    <div
      className={['relative aspect-video w-full overflow-hidden bg-surface-muted', className].filter(Boolean).join(' ')}
      style={{ containerType: 'inline-size' }}
    >
      {imageSource ? (
        <img src={imageSource} alt={alt} className="absolute inset-0 h-full w-full object-fill" />
      ) : null}
      {!isImageFallback && layout ? (
        <>
          {layout.shapes.map((shape) => <PreviewShape key={shape.id} shape={shape} />)}
          {layout.textBlocks.map((block) => (
            <PreviewTextBlock key={block.id} block={block} logoImageDataUrl={logoImageDataUrl} />
          ))}
        </>
      ) : null}
    </div>
  );
}

function PreviewShape({ shape }: { shape: PptEditableShape }) {
  const isLine = shape.type === 'line';
  return (
    <span
      aria-hidden="true"
      className="absolute block"
      style={{
        left: `${(shape.x / SLIDE_W) * 100}%`,
        top: `${(shape.y / SLIDE_H) * 100}%`,
        width: `${(shape.w / SLIDE_W) * 100}%`,
        height: isLine ? 0 : `${(shape.h / SLIDE_H) * 100}%`,
        backgroundColor: isLine ? 'transparent' : shape.fillColor ? `#${shape.fillColor}` : 'transparent',
        opacity: 1 - (shape.transparency ?? 0) / 100,
        border: `${shape.lineWidth ?? 0.75}px solid ${shape.lineColor ? `#${shape.lineColor}` : 'transparent'}`,
        borderRadius: shape.type === 'roundRect' || shape.type === 'ellipse' ? '8%' : undefined,
        transform: isLine && shape.h ? `rotate(${Math.atan2(shape.h, shape.w) * (180 / Math.PI)}deg)` : undefined,
        transformOrigin: 'left center',
      }}
    />
  );
}

function PreviewTextBlock({
  block,
  logoImageDataUrl,
}: {
  block: PptEditableTextBlock;
  logoImageDataUrl?: string;
}) {
  const textStyle = {
    left: `${(block.x / SLIDE_W) * 100}%`,
    top: `${(block.y / SLIDE_H) * 100}%`,
    width: `${(block.w / SLIDE_W) * 100}%`,
    height: `${(block.h / SLIDE_H) * 100}%`,
    fontSize: `calc(${block.fontSize / (72 * SLIDE_W)} * 100cqw)`,
    color: `#${block.color ?? '0B2454'}`,
    fontWeight: block.bold ? 700 : 400,
    textAlign: block.align ?? 'left',
    fontFamily: 'Pretendard, "Noto Sans KR", Arial, sans-serif',
  } as const;

  if (block.role === 'logo' && logoImageDataUrl) {
    return (
      <span className="absolute flex items-center justify-center" style={textStyle}>
        <img src={logoImageDataUrl} alt="Logo" className="h-full w-full object-contain" />
      </span>
    );
  }

  return (
    <span
      className="absolute flex items-center overflow-hidden leading-[1.15]"
      style={{
        ...textStyle,
        justifyContent: block.align === 'center' ? 'center' : block.align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      {block.text}
    </span>
  );
}
