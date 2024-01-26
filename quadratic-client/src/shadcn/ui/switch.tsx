import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/shadcn/utils"
import { CaretLeftIcon, CaretRightIcon, CodeIcon } from "@radix-ui/react-icons"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

const SwitchApp = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer relative inline-flex h-8 w-12 shrink-0 cursor-pointer items-center rounded-full border border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:text-primary data-[state=unchecked]:text-muted-foreground",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-gray-300 shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-[1.6rem] data-[state=unchecked]:translate-x-1 data-[state=checked]:bg-primary"
      )}
    />
    
      {props.checked ? (
        <span className={`pointer-events-none flex cursor-pointer absolute left-0.5 top-1/2 -mt-[7.5px]`}>
          <CaretLeftIcon className={`text-primary -mr-1`} />
          <CaretRightIcon className={`text-primary -ml-1`} />
        </span>
      ) : (
        <span className={`pointer-events-none flex cursor-pointer absolute right-[.35rem] top-1/2 -mt-[7.5px]`}>
          <CodeIcon className={`text-muted-foreground`} />
        </span>
      )}
    
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch, SwitchApp };
