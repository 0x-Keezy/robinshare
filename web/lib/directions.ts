/// Catálogo compartido del bake-off: hub + switcher leen de acá.
export const DIRECTIONS = [
  { code: "sherwood", name: "Sherwood", tag: "santuario · oscuro-frío", gen: 2, d: "Catedral fotográfica, serif editorial, la flecha macro se dispara hacia la luz." },
  { code: "legend", name: "Legend", tag: "brokerage · claro suizo", gen: 2, d: "Página blanca fintech, Archivo Black negro gigante, panel terminal con la pluma de luz." },
  { code: "hood", name: "Hood", tag: "película · dorado", gen: 2, d: "Film de dos escenas con letterbox: el arquero dispara, el ledger cae sobre el cofre." },
  { code: "decree", name: "Decree", tag: "edicto · pergamino", gen: 2, d: "Un decreto sobre pergamino real: blackletter, artículos romanos y sello de cera que se estampa." },
  { code: "terminal", name: "Terminal", tag: "CRT · fósforo", gen: 2, d: "La Bloomberg de Sherwood: boot sequence, headlines tipeados y tail -f del feed. Cero fotos." },
  { code: "manga", name: "Manga", tag: "shonen · tinta", gen: 2, d: "Capítulo semanal: splash del arquero anime, paneles de imprenta, FWOOSH!! y KA-CHING!" },
  { code: "sky", name: "Skywriter", tag: "v1 · brutalista", gen: 1, d: "Verde ácido y Anton a gritos, typewriter de destinatarios. Archivo del bake-off v1." },
  { code: "nest", name: "Night Nest", tag: "v1 · petirrojo", gen: 1, d: "El petirrojo cinematográfico con brasas y parallax. Archivo del bake-off v1." },
  { code: "avion", name: "Par Avion", tag: "v1 · postal", gen: 1, d: "Correo aéreo en papel: sello de cera, ruta punteada y avioncito. Archivo del bake-off v1." },
] as const;

export type DirectionCode = (typeof DIRECTIONS)[number]["code"];
