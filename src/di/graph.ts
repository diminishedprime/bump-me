import type { DependencyContainer } from "tsyringe";
import { App } from "#src/di/app";

export async function start(container: DependencyContainer) {
  return container.resolve(App).start();
}
