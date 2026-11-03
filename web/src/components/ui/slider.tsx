import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "cn"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const _values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max]

  return (
    <SliderPrimitive.Root
      // Values glide between updates (playback ticks, presets, wheel), but track the pointer exactly while dragging.
      className={cn(
        "data-horizontal:w-full data-vertical:h-full [&:not([data-dragging])_[data-slot=slider-range]]:transition-[width,height] [&:not([data-dragging])_[data-slot=slider-range]]:duration-300 [&:not([data-dragging])_[data-slot=slider-range]]:ease-linear [&:not([data-dragging])_[data-slot=slider-thumb]]:transition-[inset-inline-start,bottom,scale,box-shadow,opacity] [&:not([data-dragging])_[data-slot=slider-thumb]]:duration-300 [&:not([data-dragging])_[data-slot=slider-thumb]]:ease-linear",
        className,
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="well relative grow overflow-hidden rounded-full select-none data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1.5"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="rounded-full bg-primary select-none data-horizontal:h-full data-horizontal:bg-linear-to-r data-horizontal:from-primary data-horizontal:to-glow data-vertical:w-full data-vertical:bg-linear-to-t data-vertical:from-primary data-vertical:to-glow"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="relative block size-3.5 shrink-0 rounded-full bg-foreground shadow-[0_1px_3px_rgb(0_0_0/0.6),inset_0_-1px_0_rgb(0_0_0/0.15)] ring-primary/40 transition-[box-shadow,transform] duration-(--duration-fast) select-none after:absolute after:-inset-2 hover:scale-110 hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden active:scale-95 active:ring-4 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
