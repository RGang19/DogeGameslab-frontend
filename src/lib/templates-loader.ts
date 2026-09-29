type TemplateModule = typeof import("./templates");

let modulePromise: Promise<TemplateModule> | null = null;

export function loadTemplateModule(): Promise<TemplateModule> {
  if (!modulePromise) modulePromise = import("./templates");
  return modulePromise;
}

export async function getGameTemplates() {
  const mod = await loadTemplateModule();
  return mod.gameTemplates;
}

export async function findGameTemplate(id: string) {
  const templates = await getGameTemplates();
  return templates.find((template) => template.id === id) ?? null;
}
