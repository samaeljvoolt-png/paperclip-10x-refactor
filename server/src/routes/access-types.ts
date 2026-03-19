export type JoinDiagnostic = {
  code: string;
  level: "info" | "warn";
  message: string;
  hint?: string;
};

