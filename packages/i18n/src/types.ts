export type TranslationValue =
  | string
  | readonly string[]
  | ((...args: never[]) => string | readonly string[])

export type TranslationTree = {
  readonly [key: string]: TranslationValue | TranslationTree
}

export type TranslationShape<T> = {
  readonly [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => R
    : T[K] extends string
      ? string
      : T[K] extends readonly string[]
        ? readonly string[]
        : T[K] extends object
          ? TranslationShape<T[K]>
          : never
}

export type NestedKeys<T> = {
  [K in keyof T & string]: T[K] extends TranslationValue
    ? K
    : T[K] extends object
      ? `${K}.${NestedKeys<T[K]>}`
      : never
}[keyof T & string]

export type GetValueByPath<
  T,
  P extends string,
> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? GetValueByPath<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never

export type TranslateArgs<T> = T extends (
  ...args: infer A extends unknown[]
) => unknown
  ? A
  : []

export type TranslateFunction<T> = <K extends NestedKeys<T>>(
  key: K,
  ...args: TranslateArgs<GetValueByPath<T, K>>
) => string
