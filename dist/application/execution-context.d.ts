export interface ExecutionContextPicker {
  getModuleContext(moduleId: string): GraphQLModules.ModuleContext;
  getApplicationContext(): GraphQLModules.AppContext;
}
export declare const executionContext: {
  create(picker: ExecutionContextPicker): void;
  getModuleContext: ExecutionContextPicker['getModuleContext'];
  getApplicationContext: ExecutionContextPicker['getApplicationContext'];
};
export declare function enableExecutionContext(): void;
