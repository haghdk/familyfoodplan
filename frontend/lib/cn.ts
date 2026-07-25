type ClassNameValue = string | false | null | undefined;

export const cn = (...classNames: ClassNameValue[]) =>
  classNames.filter(Boolean).join(" ");
