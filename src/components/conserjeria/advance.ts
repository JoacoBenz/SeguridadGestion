// Encadena los pasos del alta: al completar uno, la pantalla se desliza al
// siguiente. Sólo scroll — nunca focus: enfocar un input abriría el teclado
// del celular sin que el guardia lo haya pedido.

export function advanceTo(id: string | undefined): void {
  if (!id) return;
  // Un tick después, para que el estado que disparó el avance ya se haya
  // renderizado (el chip marcado, la foto lista) antes de mover la vista.
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
