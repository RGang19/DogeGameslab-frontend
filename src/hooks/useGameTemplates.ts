import { useEffect, useState } from "react";
import { loadTemplateModule } from "@/lib/templates-loader";

export function useGameTemplates() {
  const [gameTemplates, setGameTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [themePresets, setThemePresets] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadTemplateModule().then((mod) => {
      if (cancelled) return;
      setGameTemplates(mod.gameTemplates);
      setThemePresets(mod.themePresets);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { gameTemplates, themePresets, loading, ready: !loading };
}
