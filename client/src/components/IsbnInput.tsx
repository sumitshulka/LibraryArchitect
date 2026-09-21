import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { normalizeIsbn } from "@/lib/isbn";

type IsbnInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function IsbnInput({ value, onValueChange, ...props }: IsbnInputProps) {
  return (
    <Input
      {...props}
      value={value}
      onChange={(event) => onValueChange(normalizeIsbn(event.target.value))}
      inputMode="text"
      autoComplete="off"
    />
  );
}