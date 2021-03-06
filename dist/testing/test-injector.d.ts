import { Injector } from '../di/injector';
import { Provider, TypeProvider } from '../di/providers';
export declare function testInjector(providers: Provider[]): Injector;
export declare function readProviderOptions<T>(
  provider: TypeProvider<T>
): import('../di/providers').ProviderOptions | undefined;
