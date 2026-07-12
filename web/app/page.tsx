import { SkyHome } from "./directions/sky/SkyHome";
import { NestHome } from "./directions/nest/NestHome";
import { AvionHome } from "./directions/avion/AvionHome";
import { SherwoodHome } from "./directions/sherwood/SherwoodHome";

// La dirección de arte se elige al build por subdominio: NEXT_PUBLIC_DIRECTION.
// sherwood = la dirección scroll-driven premium (temática Robin Hood, v2).
export default function Home() {
  const dir = process.env.NEXT_PUBLIC_DIRECTION ?? "sherwood";
  switch (dir) {
    case "sky":
      return <SkyHome />;
    case "avion":
      return <AvionHome />;
    case "nest":
      return <NestHome />;
    case "sherwood":
    default:
      return <SherwoodHome />;
  }
}
