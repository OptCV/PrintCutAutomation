export function askText(question: string, defaultValue?: string): string {
  const suffix = defaultValue === undefined ? "" : ` [${defaultValue}]`;
  const answer = prompt(`${question}${suffix}:`)?.trim();

  if (!answer) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`A value is required: ${question}`);
  }

  return answer;
}

export function askNumber(
  question: string,
  defaultValue?: number,
  options?: { minExclusive?: number; minInclusive?: number }
): number {
  for (;;) {
    const raw = askText(
      question,
      defaultValue === undefined ? undefined : String(defaultValue)
    );
    const value = Number(raw);

    if (!Number.isFinite(value)) {
      console.log("Please enter a valid number.");
      continue;
    }

    if (options?.minExclusive !== undefined && value <= options.minExclusive) {
      console.log(`Value must be greater than ${options.minExclusive}.`);
      continue;
    }

    if (options?.minInclusive !== undefined && value < options.minInclusive) {
      console.log(`Value must be at least ${options.minInclusive}.`);
      continue;
    }

    return value;
  }
}

export function askYesNo(question: string, defaultValue: boolean): boolean {
  const label = defaultValue ? "Y/n" : "y/N";

  for (;;) {
    const answer = prompt(`${question} [${label}]:`)?.trim().toLowerCase();

    if (!answer) return defaultValue;
    if (answer === "y" || answer === "yes") return true;
    if (answer === "n" || answer === "no") return false;

    console.log("Enter y or n.");
  }
}
