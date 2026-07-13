import { SkyHome } from "./directions/sky/SkyHome";
import { NestHome } from "./directions/nest/NestHome";
import { AvionHome } from "./directions/avion/AvionHome";
import { SherwoodHome } from "./directions/sherwood/SherwoodHome";
import { LegendHome } from "./directions/legend/LegendHome";
import { HoodHome } from "./directions/hood/HoodHome";
import { DecreeHome } from "./directions/decree/DecreeHome";
import { TerminalHome } from "./directions/terminal/TerminalHome";
import { MangaHome } from "./directions/manga/MangaHome";

// La dirección de arte se elige al build por subdominio: NEXT_PUBLIC_DIRECTION.
// LEGEND ganó el bake-off (2026-07-13) y es la identidad de RobinShare — default
// de producción. El resto queda archivado, navegable solo via /v/<dir>.
export default function Home() {
  const dir = process.env.NEXT_PUBLIC_DIRECTION ?? "legend";
  switch (dir) {
    case "sky":
      return <SkyHome />;
    case "avion":
      return <AvionHome />;
    case "nest":
      return <NestHome />;
    case "sherwood":
      return <SherwoodHome />;
    case "hood":
      return <HoodHome />;
    case "decree":
      return <DecreeHome />;
    case "terminal":
      return <TerminalHome />;
    case "manga":
      return <MangaHome />;
    case "legend":
    default:
      return <LegendHome />;
  }
}
