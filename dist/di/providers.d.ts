export declare const Type: FunctionConstructor;
export declare class InjectionToken<T> {
  private _desc;
  constructor(_desc: string);
  toString(): string;
}
export declare function isToken(v: any): v is InjectionToken<any>;
export declare function isType(v: any): v is Type<any>;
export interface AbstractType<T> extends Function {
  prototype: T;
}
export interface Type<T> extends Function {
  new (...args: any[]): T;
}
export interface ValueProvider<T> extends BaseProvider<T> {
  useValue: T;
}
export interface ClassProvider<T> extends BaseProvider<T> {
  useClass: Type<T>;
}
export declare type Factory<T> = (...args: any[]) => T;
export interface FactoryProvider<T> extends BaseProvider<T> {
  useFactory: Factory<T>;
  deps?: any[];
}
export interface BaseProvider<T> extends ProviderOptions {
  provide: Type<T> | InjectionToken<T>;
}
export interface TypeProvider<T> extends Type<T> {}
export declare type Provider<T = any> =
  | TypeProvider<T>
  | ValueProvider<T>
  | ClassProvider<T>
  | FactoryProvider<T>;
export interface ProviderOptions {
  scope?: Scope;
  executionContextIn?: Array<string | symbol>;
  global?: boolean;
}
export declare enum Scope {
  Singleton = 0,
  Operation = 1,
}
export declare function onlySingletonProviders(
  providers?: Provider[]
): Provider[];
export declare function onlyOperationProviders(
  providers?: Provider[]
): Provider[];
export declare function isClassProvider(
  provider: any
): provider is ClassProvider<any>;
export declare function isFactoryProvider(
  provider: any
): provider is FactoryProvider<any>;
