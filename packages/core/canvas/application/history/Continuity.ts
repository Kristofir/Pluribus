import type { ElementId } from "../../domain/Element";
import type { HistoryTarget } from "../../domain/History";
import type { HistoryPorts, HistoryElement } from "./Ports";

/** New actions may establish continuity; inverses may only consume existing continuity. */
export async function captureTarget(
  ports: HistoryPorts,
  element: HistoryElement,
  action: string,
) {
  const previous = await ports.targets.get(element.id);
  const lineage =
    previous?.generation === element.generation &&
    previous.removed === element.removed
      ? previous.lineage
      : action;
  return { id: element.id, lineage };
}
export async function matchesTarget(
  ports: HistoryPorts,
  target: HistoryTarget,
  element: HistoryElement,
) {
  const binding = await ports.targets.get(target.id);
  return (
    binding?.lineage === target.lineage &&
    binding.generation === element.generation &&
    binding.removed === element.removed
  );
}
export async function saveTarget(
  ports: HistoryPorts,
  id: ElementId,
  lineage: string,
  generation: number,
  removed: boolean,
) {
  await ports.targets.save(id, { lineage, generation, removed });
}
