import { ModulesMap } from './application';
import { ResolvedModule } from '../module/factory';
import { ReflectiveInjector, Scope } from '../di';
import { ResolvedProvider } from '../di/resolution';
export declare function instantiateSingletonProviders({
  appInjector,
  modulesMap,
}: {
  appInjector: ReflectiveInjector;
  modulesMap: ModulesMap;
}): void;
export declare function createGlobalProvidersMap({
  modules,
  scope,
}: {
  modules: ResolvedModule[];
  scope: Scope;
}): {
  [key: string]: string;
};
export declare function attachGlobalProvidersMap({
  injector,
  globalProvidersMap,
  moduleInjectorGetter,
}: {
  injector: ReflectiveInjector;
  globalProvidersMap: {
    [key: string]: string;
  };
  moduleInjectorGetter: (moduleId: string) => ReflectiveInjector;
}): void;
export declare function duplicatedGlobalTokenError(
  provider: ResolvedProvider,
  modules: [string, string]
): Error;
