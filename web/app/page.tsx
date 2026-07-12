import { SkyHome } from "./directions/sky/SkyHome";
import { NestHome } from "./directions/nest/NestHome";
import { AvionHome } from "./directions/avion/AvionHome";
import { SherwoodHome } from "./directions/sherwood/SherwoodHome";
import { LegendHome } from "./directions/legend/LegendHome";
import { HoodHome } from "./directions/hood/HoodHome";

// La dirección de arte se elige al build por subdominio: NEXT_PUBLIC_DIRECTION.
// v2 (Robin Hood): sherwood (3D leyenda) · legend (3D corporativo) · hood (2.5D cine).
export default function Home() {
  const dir = process.env.NEXT_PUBLIC_DIRECTION ?? "sherwood";
  switch (dir) {
    case "sky":
      return <SkyHome />;
    case "avion":
      return <AvionHome />;
    case "nest":
      return <NestHome />;
    case "legend":
      return <LegendHome />;
    case "hood":
      return <HoodHome />;
    case "sherwood":
    default:
      return <SherwoodHome />;
  }
}
