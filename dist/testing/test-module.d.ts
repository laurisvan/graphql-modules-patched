import { ApplicationConfig } from '../application/types';
import { MockedModule, Module, ModuleConfig } from '../module/types';
declare type TestModuleConfig = {
  replaceExtensions?: boolean;
  inheritTypeDefs?: Module[];
} & Partial<
  Pick<
    ApplicationConfig,
    'providers' | 'modules' | 'middlewares' | 'schemaBuilder'
  >
> &
  Partial<Pick<ModuleConfig, 'typeDefs' | 'resolvers'>>;
declare type MockModuleConfig = Partial<Pick<ModuleConfig, 'providers'>>;
export declare function mockModule(
  testedModule: Module,
  overrideConfig: MockModuleConfig
): MockedModule;
export declare function testModule(
  testedModule: Module,
  config?: TestModuleConfig
): import('../application/types').Application;
export {};
