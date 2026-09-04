import { notFound } from "next/navigation";
import { SkyHome } from "../../directions/sky/SkyHome";
import { NestHome } from "../../directions/nest/NestHome";
import { AvionHome } from "../../directions/avion/AvionHome";
import { SherwoodHome } from "../../directions/sherwood/SherwoodHome";
import { LegendHome } from "../../directions/legend/LegendHome";
import { HoodHome } from "../../directions/hood/HoodHome";
import { DecreeHome } from "../../directions/decree/DecreeHome";
import { TerminalHome } from "../../directions/terminal/TerminalHome";
import { MangaHome } from "../../directions/manga/MangaHome";
import { TapeHome } from "../../directions/tape/TapeHome";
import { VersionSwitcher } from "@/components/VersionSwitcher";

// Preview de TODAS las direcciones en un solo dev server: /v/sherwood, /v/legend, /v/hood…
// (prod sigue eligiendo por NEXT_PUBLIC_DIRECTION en app/page.tsx)
const DIRS: Record<string, React.ComponentType> = {
  tape: TapeHome,
  sherwood: SherwoodHome,
  legend: LegendHome,
  hood: HoodHome,
  decree: DecreeHome,
  terminal: TerminalHome,
  manga: MangaHome,
  sky: SkyHome,
  nest: NestHome,
  avion: AvionHome,
};

export function generateStaticParams() {
  return Object.keys(DIRS).map((dir) => ({ dir }));
}

export default async function DirectionPreview({
  params,
  searchParams,
}: {
  params: Promise<{ dir: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { dir } = await params;
  const { embed } = await searchParams;
  const Comp = DIRS[dir];
  if (!Comp) notFound();
  // `?embed=1` lo usa /v/compare, que mete dos direcciones en iframes: adentro no puede dibujarse
  // el switcher flotante o quedarian tres pastillas encimadas en la misma pantalla.
  return (
    <>
      <Comp />
      {embed !== "1" && <VersionSwitcher current={dir} />}
    </>
  );
}
