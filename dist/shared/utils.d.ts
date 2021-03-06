export declare function flatten<T>(arr: T[]): T extends (infer A)[] ? A[] : T[];
export declare function isDefined<T>(val: T | null | undefined): val is T;
export declare function isNil<T>(
  val: T | null | undefined
): val is null | undefined;
export declare function isObject(val: any): boolean;
export declare function isPrimitive(
  val: any
): val is number | string | boolean | symbol | bigint;
export declare function isAsyncIterable(
  obj: any
): obj is AsyncIterableIterator<any>;
export declare function tapAsyncIterator<T>(
  iterable: AsyncIterable<T>,
  doneCallback: () => void
): AsyncGenerator<T>;
export declare function once(cb: () => void): () => void;
export declare function share<T, A>(factory: (arg?: A) => T): (arg?: A) => T;
export declare function uniqueId(isNotUsed: (id: string) => boolean): string;
export declare function isNotSchema<T>(obj: any): obj is T;
export declare function merge<S extends object, T extends object>(
  source: S,
  target: T
): S & T;
