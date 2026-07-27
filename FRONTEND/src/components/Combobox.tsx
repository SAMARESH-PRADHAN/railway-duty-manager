import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
  searchValue?: string;
}

// interface Props {
//   options: ComboOption[];
//   value?: string;
//   onChange: (v: string) => void;
//   placeholder?: string;
//   emptyText?: string;
//   className?: string;
//   disabled?: boolean;
// }

// export function Combobox({ options, value, onChange, placeholder = "Select…", emptyText = "No results.", className, disabled }: Props) {
//   const [open, setOpen] = useState(false);
//   const selected = options.find((o) => o.value === value);
//   return (
//     <Popover open={open} onOpenChange={setOpen}>
//       <PopoverTrigger asChild>
//         <Button
//           type="button"
//           variant="outline"
//           role="combobox"
//           disabled={disabled}
//           className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
//         >
//           <span className="truncate">{selected ? selected.label : placeholder}</span>
//           <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
//         </Button>
//       </PopoverTrigger>
//       <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-[95vw]" align="start">
//         <Command>
//           <CommandInput placeholder="Search…" />
//           <CommandList className="max-h-[50vh]">
//             <CommandEmpty>{emptyText}</CommandEmpty>
//             <CommandGroup>
//               {options.map((o) => (
//                 <CommandItem
//                   key={o.value}
//                   value={`${o.label} ${o.hint ?? ""}`}
//                   onSelect={() => { onChange(o.value); setOpen(false); }}
//                 >
//                   <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
//                   <div className="flex-1 min-w-0">
//                     <div className="truncate">{o.label}</div>
//                     {o.hint && <div className="text-[10px] text-slate-500 truncate">{o.hint}</div>}
//                   </div>
//                 </CommandItem>
//               ))}
//             </CommandGroup>
//           </CommandList>
//         </Command>
//       </PopoverContent>
//     </Popover>
//   );
// }

interface Props {
  options: ComboOption[];
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  onCreate?: (value: string) => void | Promise<void>;
  filter?: (value: string, search: string) => number;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  emptyText = "No results.",
  className,
  disabled,
  allowCreate,
  onCreate,
  filter,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const exactMatch = options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-[95vw]" align="start">
        <Command filter={filter}>
          <CommandInput placeholder="Search…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-[50vh]">
            {allowCreate && query.trim() && !exactMatch ? (
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.searchValue ?? `${o.label} ${o.hint ?? ""}`}
                    onSelect={() => {
                      onChange(o.value);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    + Add "{query.trim()}"
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.searchValue ?? `${o.label} ${o.hint ?? ""}`}
                  onSelect={() => {
                    onChange(o.value);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{o.label}</div>
                    {o.hint && <div className="text-[10px] text-slate-500 truncate">{o.hint}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
