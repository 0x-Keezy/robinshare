import { notFound } from "next/navigation";
import { SkyHome } from "../../directions/sky/SkyHome";
import { NestHome } from "../../directions/nest/NestHome";
import { AvionHome } from "../../directions/avion/AvionHome";
import { SherwoodHome } from "../../directions/sherwood/SherwoodHome";

// Preview de TODAS las direcciones en un solo dev server: /v/sherwood, /v/sky, /v/nest…
// (prod sigue eligiendo por NEXT_PUBLIC_DIRECTION en app/page.tsx)
const DIRS: Record<string, React.ComponentType> = {
  sherwood: SherwoodHome,
  sky: SkyHome,
  nest: NestHome,
  avion: AvionHome,
};

export function generateStaticParams() {
  return Object.keys(DIRS).map((dir) => ({ dir }));
}

export default async function DirectionPreview({ params }: { params: Promise<{ dir: string }> }) {
  const { dir } = await params;
  const Comp = DIRS[dir];
  if (!Comp) notFound();
  return <Comp />;
}
