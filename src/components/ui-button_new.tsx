// 입체 버튼. 아래쪽 두꺼운 테두리가 그림자 역할을 하고, 누르면 그만큼 내려앉는다.
// <button>은 Button을, Link처럼 다른 요소는 className={buttonClass(...)}를 쓴다.

type Variant = "primary" | "success" | "neutral";
type Size = "sm" | "md";

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl font-bold " +
  "transition-[transform,background-color,filter] duration-75 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand " +
  // 눌림: 테두리가 사라진 만큼 내려앉는다. 높이를 줄이고 같은 만큼 margin을 둬서 주변 배치는 그대로 둔다.
  "not-disabled:active:translate-y-1 not-disabled:active:mb-1 " +
  "disabled:cursor-not-allowed disabled:border-b-0 disabled:border-transparent disabled:bg-zinc-200 disabled:text-zinc-400";

const VARIANTS: Record<Variant, string> = {
  primary:
    "border-b-4 border-brand-dark bg-brand text-white not-disabled:hover:brightness-110 not-disabled:active:border-b-0",
  success:
    "border-b-4 border-forest-dark bg-forest text-white not-disabled:hover:brightness-110 not-disabled:active:border-b-0",
  neutral:
    "border-2 border-b-4 border-zinc-300 bg-white text-ink not-disabled:hover:bg-zinc-50 not-disabled:active:border-b-2",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm not-disabled:active:h-8",
  md: "h-11 px-6 text-base not-disabled:active:h-10",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

export function Button({
  variant,
  size,
  className,
  ...props
}: React.ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={buttonClass({ variant, size, className })} />;
}
