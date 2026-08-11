// Checklist de primeros pasos del admin de un edificio nuevo.
//
// No guarda estado propio: cada paso se deduce de los datos que ya existen
// (unidades, residentes, PIN, paquetes). Así nunca miente — si el admin borra
// todo, el checklist reaparece solo — y no hay nada que migrar ni resetear.
//
// Módulo puro y testeable; el componente sólo lo renderiza.

export interface OnboardingInput {
  unitCount: number;
  residentCount: number;
  hasPin: boolean;
  packageCount: number;
}

export interface OnboardingStep {
  key: "unidades" | "residentes" | "pin" | "paquete";
  done: boolean;
  /** Un paso opcional no frena el "edificio listo" (el PIN: se puede operar con email). */
  optional: boolean;
}

export interface OnboardingState {
  steps: OnboardingStep[];
  /** Cuántos pasos están hechos, contando los opcionales. */
  doneCount: number;
  /** El checklist se muestra hasta que los pasos obligatorios estén completos. */
  show: boolean;
}

export function onboardingState(input: OnboardingInput): OnboardingState {
  const steps: OnboardingStep[] = [
    { key: "unidades", done: input.unitCount > 0, optional: false },
    { key: "residentes", done: input.residentCount > 0, optional: false },
    { key: "pin", done: input.hasPin, optional: true },
    { key: "paquete", done: input.packageCount > 0, optional: false },
  ];
  return {
    steps,
    doneCount: steps.filter((s) => s.done).length,
    show: steps.some((s) => !s.done && !s.optional),
  };
}
