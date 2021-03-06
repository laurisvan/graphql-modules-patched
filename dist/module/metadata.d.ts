import { DocumentNode } from 'graphql';
import { ModuleConfig } from './types';
import { ID } from '../shared/types';
export declare type Registry = Record<string, string[]>;
export interface ModuleMetadata {
  id: ID;
  typeDefs: DocumentNode[];
  implements?: Registry;
  extends?: Registry;
  dirname?: string;
}
export declare function metadataFactory(
  typeDefs: DocumentNode[],
  config: ModuleConfig
): ModuleMetadata;
