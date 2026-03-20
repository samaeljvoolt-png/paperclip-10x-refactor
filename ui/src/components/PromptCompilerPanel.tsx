import type { PromptCompilerCompileResponse, PromptCompilerLanguagePreference } from "@paperclipai/shared";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";

interface PromptCompilerPanelProps {
  rawRequest: string;
  additionalContext: string;
  preferredLanguage: PromptCompilerLanguagePreference;
  compiled: PromptCompilerCompileResponse | null;
  isCompiling: boolean;
  disabled?: boolean;
  onRawRequestChange: (value: string) => void;
  onAdditionalContextChange: (value: string) => void;
  onPreferredLanguageChange: (value: PromptCompilerLanguagePreference) => void;
  onCompile: () => void;
  onApply: () => void;
}

function gateTone(gateStatus: string) {
  switch (gateStatus) {
    case "pass":
      return "text-emerald-600 border-emerald-500/40 bg-emerald-500/10";
    case "revise":
      return "text-amber-600 border-amber-500/40 bg-amber-500/10";
    default:
      return "text-red-600 border-red-500/40 bg-red-500/10";
  }
}

export function PromptCompilerPanel(props: PromptCompilerPanelProps) {
  const {
    rawRequest,
    additionalContext,
    preferredLanguage,
    compiled,
    isCompiling,
    disabled,
    onRawRequestChange,
    onAdditionalContextChange,
    onPreferredLanguageChange,
    onCompile,
    onApply,
  } = props;

  const validation = compiled?.validation ?? null;

  return (
    <div className="mx-4 mt-4 rounded-lg border border-border bg-muted/20">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Prompt Compiler
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Convierte una necesidad informal en una issue ejecutable con criterios de aceptación y routing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded border border-border bg-transparent px-2 py-1 text-xs outline-none"
            value={preferredLanguage}
            onChange={(event) => onPreferredLanguageChange(event.target.value as PromptCompilerLanguagePreference)}
            disabled={disabled || isCompiling}
          >
            <option value="auto">Idioma automático</option>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
          <Button
            size="sm"
            variant="secondary"
            onClick={onCompile}
            disabled={disabled || isCompiling || rawRequest.trim().length === 0}
          >
            {isCompiling ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {isCompiling ? "Compilando..." : "Compilar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Necesidad informal</label>
            <textarea
              className="min-h-[110px] w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none"
              placeholder="Describe lo que necesitas en lenguaje natural."
              value={rawRequest}
              onChange={(event) => onRawRequestChange(event.target.value)}
              disabled={disabled || isCompiling}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Contexto adicional</label>
            <textarea
              className="min-h-[88px] w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none"
              placeholder="Findings verificados, restricciones, links o contexto que no quieres perder."
              value={additionalContext}
              onChange={(event) => onAdditionalContextChange(event.target.value)}
              disabled={disabled || isCompiling}
            />
          </div>
        </div>

        <div className="space-y-3">
          {compiled ? (
            <>
              <div className="rounded-md border border-border bg-background/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{compiled.brief.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {compiled.brief.intentType} · idioma {compiled.brief.language}
                    </div>
                  </div>
                  <span className={cn("rounded-full border px-2 py-1 text-[11px] font-medium uppercase", gateTone(validation?.gateStatus ?? "reject"))}>
                    {validation?.gateStatus ?? "reject"} · {validation?.score ?? 0}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{compiled.brief.objective}</p>
              </div>

              <div className="rounded-md border border-border bg-background/70 p-3">
                <div className="text-xs font-medium text-muted-foreground">Deliverables</div>
                <ul className="mt-2 space-y-1 text-sm">
                  {compiled.brief.deliverables.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-md border border-border bg-background/70 p-3">
                <div className="text-xs font-medium text-muted-foreground">Acceptance criteria</div>
                <ul className="mt-2 space-y-1 text-sm">
                  {compiled.brief.acceptanceCriteria.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>

              {validation && (validation.hardFails.length > 0 || validation.warnings.length > 0) ? (
                <div className="rounded-md border border-border bg-background/70 p-3 text-sm">
                  {validation.hardFails.length > 0 ? (
                    <>
                      <div className="text-xs font-medium text-destructive">Hard fails</div>
                      <ul className="mt-2 space-y-1">
                        {validation.hardFails.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {validation.warnings.length > 0 ? (
                    <>
                      <div className="mt-3 text-xs font-medium text-amber-600">Warnings</div>
                      <ul className="mt-2 space-y-1">
                        {validation.warnings.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ) : null}

              <Button
                size="sm"
                onClick={onApply}
                disabled={disabled || isCompiling || validation?.gateStatus === "reject"}
              >
                Aplicar brief compilado
              </Button>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              Compila primero para ver el brief, su score y aplicar el draft al formulario de la issue.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
