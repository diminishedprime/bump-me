type HexDigit =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f";

type HexDigits<
  S extends string,
  Counted extends unknown[] = [],
> = S extends `${HexDigit}${infer Rest}`
  ? HexDigits<Rest, [...Counted, unknown]>
  : S extends ""
    ? Counted["length"]
    : -1;

export type HexColorLike = `#${string}`;

export type HexColor<S> = S extends `#${infer Digits}`
  ? HexDigits<Digits> extends 6
    ? S
    : never
  : never;

export type HexColors<Colors> = { [K in keyof Colors]: HexColor<Colors[K]> };
