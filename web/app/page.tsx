import { SkyHome } from "./directions/sky/SkyHome";

// La dirección de arte se elige al build por subdominio: NEXT_PUBLIC_DIRECTION = sky | nest | avion.
// Cada una es un MUNDO distinto (no un recolor). Sky es la default hasta que Nest/Avion tengan sus assets.
export default function Home() {
  const dir = process.env.NEXT_PUBLIC_DIRECTION ?? "sky";
  switch (dir) {
    case "sky":
    default:
      return <SkyHome />;
  }
}
