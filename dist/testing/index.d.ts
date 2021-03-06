import { mockApplication } from './test-application';
import { testModule, mockModule } from './test-module';
import { testInjector, readProviderOptions } from './test-injector';
import { execute } from './graphql';
import { provideEmpty } from './di';
export declare const testkit: {
  mockApplication: typeof mockApplication;
  mockModule: typeof mockModule;
  testModule: typeof testModule;
  testInjector: typeof testInjector;
  readProviderOptions: typeof readProviderOptions;
  provideEmpty: typeof provideEmpty;
  execute: typeof execute;
};
