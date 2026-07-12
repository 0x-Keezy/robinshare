import { SkyHome } from "./directions/sky/SkyHome";
import { NestHome } from "./directions/nest/NestHome";
import { AvionHome } from "./directions/avion/AvionHome";

// La dirección de arte se elige al build por subdominio: NEXT_PUBLIC_DIRECTION = sky | nest | avion.
// Cada una es un MUNDO distinto (no un recolor).
export default function Home() {
  const dir = process.env.NEXT_PUBLIC_DIRECTION ?? "nest";
  switch (dir) {
    case "sky":
      return <SkyHome />;
    case "avion":
      return <AvionHome />;
    case "nest":
    default:
      return <NestHome />;
  }
}
