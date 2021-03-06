import {
  Provider,
  ValueProvider,
  ClassProvider,
  FactoryProvider,
} from './providers';
import { Key } from './registry';
import { ReflectiveInjector } from './injector';
export declare type NormalizedProvider<T = any> =
  | ValueProvider<T>
  | ClassProvider<T>
  | FactoryProvider<T>;
export declare type GlobalProviderMap = {
  has(key: Key['id']): boolean;
  get(key: Key['id']): ReflectiveInjector;
};
export declare class ResolvedProvider {
  key: Key;
  factory: ResolvedFactory;
  constructor(key: Key, factory: ResolvedFactory);
}
export declare class ResolvedFactory {
  /**
   * Factory function which can return an instance of an object represented by a key.
   */
  factory: Function;
  /**
   * Arguments (dependencies) to the `factory` function.
   */
  dependencies: Dependency[];
  /**
   * Methods invoked within ExecutionContext.
   */
  executionContextIn: Array<string | symbol>;
  /**
   * Has onDestroy hook
   */
  hasOnDestroyHook: boolean;
  /**
   * Is Global
   */
  isGlobal: boolean;
  constructor(
    /**
     * Factory function which can return an instance of an object represented by a key.
     */
    factory: Function,
    /**
     * Arguments (dependencies) to the `factory` function.
     */
    dependencies: Dependency[],
    /**
     * Methods invoked within ExecutionContext.
     */
    executionContextIn: Array<string | symbol>,
    /**
     * Has onDestroy hook
     */
    hasOnDestroyHook: boolean,
    /**
     * Is Global
     */
    isGlobal: boolean
  );
}
export declare class Dependency {
  key: Key;
  optional: boolean;
  constructor(key: Key, optional: boolean);
  static fromKey(key: Key): Dependency;
}
export declare function resolveProviders(
  providers: Provider[]
): ResolvedProvider[];
