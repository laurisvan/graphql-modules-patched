import { ValueProvider } from './../di/providers';
export declare function provideEmpty<T = any>(
  token: ValueProvider<T>['provide']
): ValueProvider<T>;
