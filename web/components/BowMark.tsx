/// La marca de RobinShare: un arco tensado disparando hacia adelante — el
/// guiño a Robin Hood (compartir con los que lo merecen). Línea simple, mismo
/// peso que el sistema mono/hairline. La flecha apunta a la derecha: la misma
/// dirección de los "→" de los CTAs.
export function BowMark({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* arco (belly hacia la derecha) */}
      <path d="M7 3 A 13 13 0 0 1 7 21" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      {/* cuerda */}
      <path d="M7 3 L7 21" stroke={color} strokeWidth="0.8" opacity="0.65" />
      {/* flecha */}
      <path d="M3 12 L21 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* punta */}
      <path d="M21 12 L16.8 9.9 M21 12 L16.8 14.1" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* plumas del nock */}
      <path d="M3 12 L5.4 9.9 M3 12 L5.4 14.1" stroke={color} strokeWidth="1" opacity="0.7" strokeLinecap="round" />
    </svg>
  );
}
