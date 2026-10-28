import { Info } from "lucide-react";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Small "i" icon that explains a number on hover (or keyboard focus). */
export function InfoTip({
  text,
  label = "Como este número é calculado",
}: {
  text: string;
  label?: string;
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <UiTooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-normal text-left leading-relaxed">
          {text}
        </TooltipContent>
      </UiTooltip>
    </TooltipProvider>
  );
}
