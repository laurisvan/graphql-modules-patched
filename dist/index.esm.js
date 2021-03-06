import { makeExecutableSchema } from '@graphql-tools/schema';
import { createHook, executionAsyncId } from 'async_hooks';
import {
  GraphQLSchema,
  execute as execute$1,
  subscribe,
  visit,
  Kind,
  GraphQLScalarType,
  concatAST,
  defaultFieldResolver,
  parse,
} from 'graphql';
import { wrapSchema } from '@graphql-tools/wrap';
import { mergeDeepWith } from 'ramda';

const ERROR_ORIGINAL_ERROR = 'diOriginalError';
function getOriginalError(error) {
  return error[ERROR_ORIGINAL_ERROR];
}
function wrappedError(message, originalError) {
  const msg = `${message} caused by: ${
    originalError instanceof Error ? originalError.message : originalError
  }`;
  const error = Error(msg);
  error[ERROR_ORIGINAL_ERROR] = originalError;
  return error;
}
function stringify(token) {
  if (typeof token === 'string') {
    return token;
  }
  if (token == null) {
    return '' + token;
  }
  if (token.name) {
    return `${token.name}`;
  }
  const res = token.toString();
  const newLineIndex = res.indexOf('\n');
  return newLineIndex === -1 ? res : res.substring(0, newLineIndex);
}

function invalidProviderError(provider) {
  return Error(
    `Invalid provider - only instances of Provider and Type are allowed, got: ${provider}`
  );
}
function noInjectableError(type) {
  return Error(`Missing @Injectable decorator for '${stringify(type)}'`);
}
function noAnnotationError(typeOrFunc, params) {
  const signature = [];
  for (let i = 0, len = params.length; i < len; i++) {
    const parameter = params[i];
    if (!parameter.type) {
      signature.push('?');
    } else {
      signature.push(stringify(parameter.type));
    }
  }
  return Error(
    "Cannot resolve all parameters for '" +
      stringify(typeOrFunc) +
      "'(" +
      signature.join(', ') +
      '). ' +
      "Make sure that all the parameters are decorated with Inject or have valid type annotations and that '" +
      stringify(typeOrFunc) +
      "' is decorated with Injectable."
  );
}
function cyclicDependencyError(injector, key) {
  return injectionError(injector, key, function () {
    return `Cannot instantiate cyclic dependency!${constructResolvingPath(
      this.keys
    )}`;
  });
}
function noProviderError(injector, key) {
  return injectionError(injector, key, function () {
    const first = stringify(this.keys[0].token);
    return `No provider for ${first}!${constructResolvingPath(this.keys)}`;
  });
}
function instantiationError(injector, originalException, key) {
  return injectionError(
    injector,
    key,
    function () {
      const first = stringify(this.keys[0].token);
      return `Error during instantiation of ${first}: ${
        getOriginalError(this).message
      }${constructResolvingPath(this.keys)}`;
    },
    originalException
  );
}
function injectionError(
  injector,
  key,
  constructResolvingMessage,
  originalError
) {
  const error = originalError ? wrappedError('', originalError) : Error();
  error.addKey = addKey;
  error.keys = [key];
  error.constructResolvingMessage =
    function wrappedConstructResolvingMessage() {
      return (
        constructResolvingMessage.call(this) + ` - in ${injector.displayName}`
      );
    };
  error.message = error.constructResolvingMessage();
  error[ERROR_ORIGINAL_ERROR] = originalError;
  return error;
}
function constructResolvingPath(keys) {
  if (keys.length > 1) {
    const reversed = findFirstClosedCycle(keys.slice().reverse());
    const tokenStrs = reversed.map((k) => stringify(k.token));
    return ' (' + tokenStrs.join(' -> ') + ')';
  }
  return '';
}
function findFirstClosedCycle(keys) {
  const res = [];
  for (let i = 0; i < keys.length; ++i) {
    if (res.indexOf(keys[i]) > -1) {
      res.push(keys[i]);
      return res;
    }
    res.push(keys[i]);
  }
  return res;
}
function addKey(key) {
  this.keys.push(key);
  this.message = this.constructResolvingMessage();
}

const INJECTABLE = Symbol('di:injectable');
function readInjectableMetadata(type, throwOnMissing) {
  const meta = type[INJECTABLE];
  if (!meta && throwOnMissing) {
    throw noInjectableError(type);
  }
  return meta;
}
function ensureInjectableMetadata(type) {
  if (!readInjectableMetadata(type)) {
    const meta = {
      params: [],
    };
    type[INJECTABLE] = meta;
  }
}

const Type = Function;
/// @ts-ignore
class InjectionToken {
  constructor(_desc) {
    this._desc = _desc;
  }
  toString() {
    return `InjectionToken ${this._desc}`;
  }
}
function isType(v) {
  return typeof v === 'function' && v !== Object;
}
var Scope;
(function (Scope) {
  Scope[(Scope['Singleton'] = 0)] = 'Singleton';
  Scope[(Scope['Operation'] = 1)] = 'Operation';
})(Scope || (Scope = {}));
function onlySingletonProviders(providers = []) {
  return providers.filter((provider) => {
    if (isType(provider)) {
      const { options } = readInjectableMetadata(provider, true);
      return (
        (options === null || options === void 0 ? void 0 : options.scope) !==
        Scope.Operation
      );
    } else {
      return provider.scope !== Scope.Operation;
    }
  });
}
function onlyOperationProviders(providers = []) {
  return providers.filter((provider) => {
    if (isType(provider)) {
      const { options } = readInjectableMetadata(provider, true);
      return (
        (options === null || options === void 0 ? void 0 : options.scope) ===
        Scope.Operation
      );
    } else {
      return provider.scope === Scope.Operation;
    }
  });
}
function isClassProvider(provider) {
  return typeof provider.useClass !== 'undefined';
}
function isFactoryProvider(provider) {
  return typeof provider.useFactory !== 'undefined';
}

const executionContextStore = new Map();
const executionContextHook = createHook({
  init(asyncId, _, triggerAsyncId) {
    // Store same context data for child async resources
    if (executionContextStore.has(triggerAsyncId)) {
      executionContextStore.set(
        asyncId,
        executionContextStore.get(triggerAsyncId)
      );
    }
  },
  destroy(asyncId) {
    if (executionContextStore.has(asyncId)) {
      executionContextStore.delete(asyncId);
    }
  },
});
const executionContext = {
  create(picker) {
    executionContextStore.set(executionAsyncId(), picker);
  },
  getModuleContext(moduleId) {
    const picker = executionContextStore.get(executionAsyncId());
    return picker.getModuleContext(moduleId);
  },
  getApplicationContext() {
    const picker = executionContextStore.get(executionAsyncId());
    return picker.getApplicationContext();
  },
};
function enableExecutionContext() {
  {
    executionContextHook.enable();
  }
}

function ensureReflect() {
  if (!(Reflect && Reflect.getOwnMetadata)) {
    throw 'reflect-metadata shim is required when using class decorators';
  }
}
function Injectable(options) {
  return (target) => {
    var _a;
    ensureReflect();
    enableExecutionContext();
    const params = (Reflect.getMetadata('design:paramtypes', target) || []).map(
      (param) => (isType(param) ? param : null)
    );
    const existingMeta = readInjectableMetadata(target);
    const meta = {
      params:
        ((_a =
          existingMeta === null || existingMeta === void 0
            ? void 0
            : existingMeta.params) === null || _a === void 0
          ? void 0
          : _a.length) > 0 && params.length === 0
          ? existingMeta === null || existingMeta === void 0
            ? void 0
            : existingMeta.params
          : params.map((param, i) => {
              var _a;
              const existingParam =
                (_a =
                  existingMeta === null || existingMeta === void 0
                    ? void 0
                    : existingMeta.params) === null || _a === void 0
                  ? void 0
                  : _a[i];
              return {
                type:
                  (existingParam === null || existingParam === void 0
                    ? void 0
                    : existingParam.type) || param,
                optional:
                  typeof (existingParam === null || existingParam === void 0
                    ? void 0
                    : existingParam.optional) === 'boolean'
                    ? existingParam.optional
                    : false,
              };
            }),
      options: {
        ...((existingMeta === null || existingMeta === void 0
          ? void 0
          : existingMeta.options) || {}),
        ...(options || {}),
      },
    };
    target[INJECTABLE] = meta;
    return target;
  };
}
function Optional() {
  return (target, _, index) => {
    ensureReflect();
    ensureInjectableMetadata(target);
    const meta = readInjectableMetadata(target);
    meta.params[index] = {
      ...meta.params[index],
      optional: true,
    };
  };
}
function Inject(type) {
  return (target, _, index) => {
    ensureReflect();
    ensureInjectableMetadata(target);
    const meta = readInjectableMetadata(target);
    meta.params[index] = {
      type,
      optional: false,
    };
  };
}
function ExecutionContext() {
  return (obj, propertyKey) => {
    ensureReflect();
    const target = obj.constructor;
    ensureInjectableMetadata(target);
    const meta = readInjectableMetadata(target);
    if (!meta.options) {
      meta.options = {};
    }
    if (!meta.options.executionContextIn) {
      meta.options.executionContextIn = [];
    }
    meta.options.executionContextIn.push(propertyKey);
  };
}

const forwardRefSymbol = Symbol('__forward_ref__');
/**
 * Useful in "circular dependencies of modules" situation
 */
function forwardRef(forwardRefFn) {
  forwardRefFn[forwardRefSymbol] = forwardRef;
  forwardRefFn.toString = function () {
    return stringify(this());
  };
  return forwardRefFn;
}
function resolveForwardRef(type) {
  if (
    typeof type === 'function' &&
    type.hasOwnProperty(forwardRefSymbol) &&
    type[forwardRefSymbol] === forwardRef
  ) {
    return type();
  } else {
    return type;
  }
}

class Key {
  constructor(token, id) {
    this.token = token;
    this.id = id;
    if (!token) {
      throw new Error('Token must be defined!');
    }
  }
  /**
   * Returns a stringified token.
   */
  get displayName() {
    return stringify(this.token);
  }
  static get(token) {
    return _globalKeyRegistry.get(resolveForwardRef(token));
  }
}
class GlobalKeyRegistry {
  constructor() {
    this._allKeys = new Map();
  }
  get(token) {
    if (token instanceof Key) {
      return token;
    }
    if (this._allKeys.has(token)) {
      return this._allKeys.get(token);
    }
    const newKey = new Key(token, _globalKeyRegistry.numberOfKeys);
    this._allKeys.set(token, newKey);
    return newKey;
  }
  get numberOfKeys() {
    return this._allKeys.size;
  }
}
const _globalKeyRegistry = new GlobalKeyRegistry();

const _EMPTY_LIST = [];
class ResolvedProvider {
  constructor(key, factory) {
    this.key = key;
    this.factory = factory;
  }
}
class ResolvedFactory {
  constructor(
    /**
     * Factory function which can return an instance of an object represented by a key.
     */
    factory,
    /**
     * Arguments (dependencies) to the `factory` function.
     */
    dependencies,
    /**
     * Methods invoked within ExecutionContext.
     */
    executionContextIn,
    /**
     * Has onDestroy hook
     */
    hasOnDestroyHook,
    /**
     * Is Global
     */
    isGlobal
  ) {
    this.factory = factory;
    this.dependencies = dependencies;
    this.executionContextIn = executionContextIn;
    this.hasOnDestroyHook = hasOnDestroyHook;
    this.isGlobal = isGlobal;
  }
}
class Dependency {
  constructor(key, optional) {
    this.key = key;
    this.optional = optional;
  }
  static fromKey(key) {
    return new Dependency(key, false);
  }
}
function resolveProviders(providers) {
  const normalized = normalizeProviders(providers, []);
  const resolved = normalized.map(resolveProvider);
  const resolvedProviderMap = mergeResolvedProviders(resolved, new Map());
  return Array.from(resolvedProviderMap.values());
}
function resolveProvider(provider) {
  return new ResolvedProvider(
    Key.get(provider.provide),
    resolveFactory(provider)
  );
}
function mergeResolvedProviders(providers, normalizedProvidersMap) {
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    normalizedProvidersMap.set(provider.key.id, provider);
  }
  return normalizedProvidersMap;
}
function normalizeProviders(providers, res) {
  providers.forEach((token) => {
    if (token instanceof Type) {
      res.push({ provide: token, useClass: token });
    } else if (
      token &&
      typeof token === 'object' &&
      token.provide !== undefined
    ) {
      res.push(token);
    } else if (token instanceof Array) {
      normalizeProviders(token, res);
    } else {
      throw invalidProviderError(token);
    }
  });
  return res;
}
function resolveFactory(provider) {
  let factoryFn;
  let resolvedDeps = _EMPTY_LIST;
  let executionContextIn = _EMPTY_LIST;
  let hasOnDestroyHook = false;
  let isGlobal;
  if (isClassProvider(provider)) {
    const useClass = resolveForwardRef(provider.useClass);
    factoryFn = makeFactory(useClass);
    resolvedDeps = dependenciesFor(useClass);
    executionContextIn = executionContextInFor(useClass);
    isGlobal = globalFor(useClass);
    hasOnDestroyHook = typeof useClass.prototype.onDestroy === 'function';
  } else if (isFactoryProvider(provider)) {
    factoryFn = provider.useFactory;
    resolvedDeps = constructDependencies(
      provider.useFactory,
      provider.deps || []
    );
    isGlobal = provider.global;
    if (provider.executionContextIn) {
      executionContextIn = provider.executionContextIn;
    }
  } else {
    factoryFn = () => provider.useValue;
    resolvedDeps = _EMPTY_LIST;
    isGlobal = provider.global;
  }
  return new ResolvedFactory(
    factoryFn,
    resolvedDeps,
    executionContextIn,
    hasOnDestroyHook,
    isGlobal !== null && isGlobal !== void 0 ? isGlobal : false
  );
}
function dependenciesFor(type) {
  const { params } = readInjectableMetadata(type, true);
  if (!params) {
    return [];
  }
  if (params.some((p) => p.type == null)) {
    throw noAnnotationError(type, params);
  }
  return params.map((p) => extractToken(p, params));
}
function executionContextInFor(type) {
  const { options } = readInjectableMetadata(type, true);
  if (
    (options === null || options === void 0
      ? void 0
      : options.executionContextIn) &&
    options.executionContextIn !== _EMPTY_LIST
  ) {
    return options === null || options === void 0
      ? void 0
      : options.executionContextIn;
  }
  return [];
}
function globalFor(type) {
  var _a;
  const { options } = readInjectableMetadata(type);
  return (_a =
    options === null || options === void 0 ? void 0 : options.global) !==
    null && _a !== void 0
    ? _a
    : false;
}
function constructDependencies(typeOrFunc, dependencies) {
  if (!dependencies) {
    return dependenciesFor(typeOrFunc);
  } else {
    const params = dependencies.map((d) => ({ type: d, optional: false }));
    return params.map((t) => extractToken(t, params));
  }
}
function extractToken(param, params) {
  const token = resolveForwardRef(param.type);
  if (token) {
    return createDependency(token, param.optional);
  }
  throw noAnnotationError(param.type, params);
}
function createDependency(token, optional) {
  return new Dependency(Key.get(token), optional);
}
function makeFactory(t) {
  return (...args) => new t(...args);
}

const _THROW_IF_NOT_FOUND = new Object();
const UNDEFINED = new Object();
const NOT_FOUND = new Object();
function notInExecutionContext() {
  throw new Error('Not in execution context');
}
// Publicly available Injector.
// We use ReflectiveInjector everywhere
// but we don't want to leak its API to everyone
class Injector {}
class ReflectiveInjector {
  constructor({
    name,
    providers,
    parent,
    fallbackParent,
    globalProvidersMap = new Map(),
  }) {
    this._constructionCounter = 0;
    this._executionContextGetter = notInExecutionContext;
    this.displayName = name;
    this._parent = parent || null;
    this._fallbackParent = fallbackParent || null;
    this._providers = providers;
    this._globalProvidersMap = globalProvidersMap;
    const len = this._providers.length;
    this._keyIds = new Array(len);
    this._objs = new Array(len);
    for (let i = 0; i < len; i++) {
      this._keyIds[i] = this._providers[i].key.id;
      this._objs[i] = UNDEFINED;
    }
  }
  static createFromResolved({
    name,
    providers,
    parent,
    fallbackParent,
    globalProvidersMap,
  }) {
    return new ReflectiveInjector({
      name,
      providers,
      parent,
      fallbackParent,
      globalProvidersMap,
    });
  }
  static resolve(providers) {
    return resolveProviders(providers);
  }
  get parent() {
    return this._parent;
  }
  get fallbackParent() {
    return this._fallbackParent;
  }
  get(token, notFoundValue = _THROW_IF_NOT_FOUND) {
    return this._getByKey(Key.get(token), notFoundValue);
  }
  setExecutionContextGetter(getter) {
    this._executionContextGetter = getter;
  }
  _getByKey(key, notFoundValue) {
    let inj = this;
    function getObj() {
      while (inj instanceof ReflectiveInjector) {
        const inj_ = inj;
        const obj = inj_._getObjByKeyId(key.id);
        if (obj !== UNDEFINED) {
          return obj;
        }
        inj = inj_._parent;
      }
      return NOT_FOUND;
    }
    const resolvedValue = getObj();
    if (resolvedValue !== NOT_FOUND) {
      return resolvedValue;
    }
    // search in fallback Injector
    if (this._fallbackParent) {
      inj = this._fallbackParent;
      const resolvedFallbackValue = getObj();
      if (resolvedFallbackValue !== NOT_FOUND) {
        return resolvedFallbackValue;
      }
    }
    if (inj !== null) {
      return inj.get(key.token, notFoundValue);
    }
    return this._throwOrNull(key, notFoundValue);
  }
  _isObjectDefinedByKeyId(keyId) {
    for (let i = 0; i < this._keyIds.length; i++) {
      if (this._keyIds[i] === keyId) {
        return this._objs[i] !== UNDEFINED;
      }
    }
    return false;
  }
  _getObjByKeyId(keyId) {
    var _a, _b;
    if (
      (_a = this._globalProvidersMap) === null || _a === void 0
        ? void 0
        : _a.has(keyId)
    ) {
      return (_b = this._globalProvidersMap.get(keyId)) === null ||
        _b === void 0
        ? void 0
        : _b._getObjByKeyId(keyId);
    }
    for (let i = 0; i < this._keyIds.length; i++) {
      if (this._keyIds[i] === keyId) {
        if (this._objs[i] === UNDEFINED) {
          this._objs[i] = this._new(this._providers[i]);
        }
        return this._objs[i];
      }
    }
    return UNDEFINED;
  }
  _throwOrNull(key, notFoundValue) {
    if (notFoundValue !== _THROW_IF_NOT_FOUND) {
      return notFoundValue;
    } else {
      throw noProviderError(this, key);
    }
  }
  instantiateAll() {
    this._providers.forEach((provider) => {
      this._getByKey(provider.key, _THROW_IF_NOT_FOUND);
    });
  }
  _instantiateProvider(provider) {
    const factory = provider.factory.factory;
    let deps;
    try {
      deps = provider.factory.dependencies.map((dep) =>
        this._getByDependency(dep)
      );
    } catch (e) {
      if (e.addKey) {
        e.addKey(provider.key);
      }
      throw e;
    }
    let obj;
    try {
      obj = factory(...deps);
      // attach execution context getter
      if (provider.factory.executionContextIn.length > 0) {
        for (const prop of provider.factory.executionContextIn) {
          Object.defineProperty(obj, prop, {
            get: () => {
              return this._executionContextGetter();
            },
          });
        }
      }
    } catch (e) {
      throw instantiationError(this, e, provider.key);
    }
    return obj;
  }
  _getByDependency(dep) {
    return this._getByKey(dep.key, dep.optional ? null : _THROW_IF_NOT_FOUND);
  }
  _new(provider) {
    if (this._constructionCounter++ > this._getMaxNumberOfObjects()) {
      throw cyclicDependencyError(this, provider.key);
    }
    return this._instantiateProvider(provider);
  }
  _getMaxNumberOfObjects() {
    return this._objs.length;
  }
  toString() {
    return this.displayName;
  }
}

class ModuleNonUniqueIdError extends ExtendableBuiltin(Error) {
  constructor(message, ...rest) {
    super(composeMessage(message, ...rest));
    this.name = this.constructor.name;
    this.message = composeMessage(message, ...rest);
  }
}
class ModuleDuplicatedError extends ExtendableBuiltin(Error) {
  constructor(message, ...rest) {
    super(composeMessage(message, ...rest));
    this.name = this.constructor.name;
    this.message = composeMessage(message, ...rest);
  }
}
class ExtraResolverError extends ExtendableBuiltin(Error) {
  constructor(message, ...rest) {
    super(composeMessage(message, ...rest));
    this.name = this.constructor.name;
    this.message = composeMessage(message, ...rest);
  }
}
class ExtraMiddlewareError extends ExtendableBuiltin(Error) {
  constructor(message, ...rest) {
    super(composeMessage(message, ...rest));
    this.name = this.constructor.name;
    this.message = composeMessage(message, ...rest);
  }
}
class ResolverDuplicatedError extends ExtendableBuiltin(Error) {
  constructor(message, ...rest) {
    super(composeMessage(message, ...rest));
    this.name = this.constructor.name;
    this.message = composeMessage(message, ...rest);
  }
}
class ResolverInvalidError extends ExtendableBuiltin(Error) {
  constructor(message, ...rest) {
    super(composeMessage(message, ...rest));
    this.name = this.constructor.name;
    this.message = composeMessage(message, ...rest);
  }
}
class NonDocumentNodeError extends ExtendableBuiltin(Error) {
  constructor(message, ...rest) {
    super(composeMessage(message, ...rest));
    this.name = this.constructor.name;
    this.message = composeMessage(message, ...rest);
  }
}
// helpers
function useLocation({ dirname, id }) {
  return dirname
    ? `Module "${id}" located at ${dirname}`
    : [
        `Module "${id}"`,
        `Hint: pass __dirname to "dirname" option of your modules to get more insightful errors`,
      ].join('\n');
}
function ExtendableBuiltin(cls) {
  function ExtendableBuiltin() {
    cls.apply(this, arguments);
  }
  ExtendableBuiltin.prototype = Object.create(cls.prototype);
  Object.setPrototypeOf(ExtendableBuiltin, cls);
  return ExtendableBuiltin;
}
function composeMessage(...lines) {
  return lines.join('\n');
}

function flatten(arr) {
  return Array.prototype.concat(...arr);
}
function isDefined(val) {
  return !isNil(val);
}
function isNil(val) {
  return val === null || typeof val === 'undefined';
}
function isPrimitive(val) {
  return ['number', 'string', 'boolean', 'symbol', 'bigint'].includes(
    typeof val
  );
}
function isAsyncIterable(obj) {
  return obj && typeof obj[Symbol.asyncIterator] === 'function';
}
function tapAsyncIterator(iterable, doneCallback) {
  const iteratorMethod = iterable[Symbol.asyncIterator];
  const iterator = iteratorMethod.call(iterable);
  function mapResult(result) {
    if (result.done) {
      doneCallback();
    }
    return result;
  }
  return {
    async next() {
      try {
        let result = await iterator.next();
        return mapResult(result);
      } catch (error) {
        doneCallback();
        throw error;
      }
    },
    async return() {
      try {
        const result = await iterator.return();
        return mapResult(result);
      } catch (error) {
        doneCallback();
        throw error;
      }
    },
    async throw(error) {
      doneCallback();
      return iterator.throw(error);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
function once(cb) {
  let called = false;
  return () => {
    if (!called) {
      called = true;
      cb();
    }
  };
}
function share(factory) {
  let cached = null;
  return (arg) => {
    if (!cached) {
      cached = factory(arg);
    }
    return cached;
  };
}
function uniqueId(isNotUsed) {
  let id;
  while (!isNotUsed((id = Math.random().toString(16).substr(2)))) {}
  return id;
}
function isNotSchema(obj) {
  return obj instanceof GraphQLSchema === false;
}
function merge(source, target) {
  const result = {
    ...source,
    ...target,
  };
  function attachSymbols(obj) {
    const symbols = Object.getOwnPropertySymbols(obj);
    for (const symbol of symbols) {
      result[symbol] = obj[symbol];
    }
  }
  if (source) {
    attachSymbols(source);
  }
  attachSymbols(target);
  return result;
}

function instantiateSingletonProviders({ appInjector, modulesMap }) {
  appInjector.instantiateAll();
  modulesMap.forEach((mod) => {
    mod.injector.instantiateAll();
  });
}
function createGlobalProvidersMap({ modules, scope }) {
  const globalProvidersMap = {};
  const propType =
    scope === Scope.Singleton ? 'singletonProviders' : 'operationProviders';
  modules.forEach((mod) => {
    mod[propType].forEach((provider) => {
      if (provider.factory.isGlobal) {
        const key = provider.key.id;
        if (globalProvidersMap[key]) {
          throw duplicatedGlobalTokenError(provider, [
            mod.id,
            globalProvidersMap[key],
          ]);
        }
        globalProvidersMap[key] = mod.id;
      }
    });
  });
  return globalProvidersMap;
}
function attachGlobalProvidersMap({
  injector,
  globalProvidersMap,
  moduleInjectorGetter,
}) {
  injector._globalProvidersMap = {
    has(key) {
      return typeof globalProvidersMap[key] === 'string';
    },
    get(key) {
      return moduleInjectorGetter(globalProvidersMap[key]);
    },
  };
}
function duplicatedGlobalTokenError(provider, modules) {
  return Error(
    [
      `Failed to define '${provider.key.displayName}' token as global.`,
      `Token provided by two modules: '${modules.join("', '")}'`,
    ].join(' ')
  );
}

/**
 * @api
 * `CONTEXT` is an InjectionToken representing the provided `GraphQLModules.GlobalContext`
 *
 * @example
 *
 * ```typescript
 * import { CONTEXT, Inject, Injectable } from 'graphql-modules';
 *
 * (A)Injectable()
 * export class Data {
 *   constructor((A)Inject(CONTEXT) private context: GraphQLModules.GlobalContext) {}
 * }
 * ```
 */
const CONTEXT = new InjectionToken('context');

function createContextBuilder({
  appInjector,
  modulesMap,
  appLevelOperationProviders,
  singletonGlobalProvidersMap,
  operationGlobalProvidersMap,
}) {
  // This is very critical. It creates an execution context.
  // It has to run on every operation.
  const contextBuilder = (context) => {
    // Cache for context per module
    let contextCache = {};
    // A list of providers with OnDestroy hooks
    // It's a tuple because we want to know which Injector controls the provider
    // and we want to know if the provider was even instantiated.
    let providersToDestroy = [];
    function registerProvidersToDestroy(injector) {
      injector._providers.forEach((provider) => {
        if (provider.factory.hasOnDestroyHook) {
          // keep provider key's id (it doesn't change over time)
          // and related injector
          providersToDestroy.push([injector, provider.key.id]);
        }
      });
    }
    let appContext;
    attachGlobalProvidersMap({
      injector: appInjector,
      globalProvidersMap: singletonGlobalProvidersMap,
      moduleInjectorGetter(moduleId) {
        return modulesMap.get(moduleId).injector;
      },
    });
    appInjector.setExecutionContextGetter(
      executionContext.getApplicationContext
    );
    function createModuleExecutionContextGetter(moduleId) {
      return function moduleExecutionContextGetter() {
        return executionContext.getModuleContext(moduleId);
      };
    }
    modulesMap.forEach((mod, moduleId) => {
      mod.injector.setExecutionContextGetter(
        createModuleExecutionContextGetter(moduleId)
      );
    });
    const executionContextPicker = {
      getApplicationContext() {
        return appContext;
      },
      getModuleContext(moduleId) {
        return getModuleContext(moduleId, context);
      },
    };
    executionContext.create(executionContextPicker);
    // As the name of the Injector says, it's an Operation scoped Injector
    // Application level
    // Operation scoped - means it's created and destroyed on every GraphQL Operation
    const operationAppInjector = ReflectiveInjector.createFromResolved({
      name: 'App (Operation Scope)',
      providers: appLevelOperationProviders.concat(
        ReflectiveInjector.resolve([
          {
            provide: CONTEXT,
            useValue: context,
          },
        ])
      ),
      parent: appInjector,
    });
    // Create a context for application-level ExecutionContext
    appContext = merge(context, {
      injector: operationAppInjector,
    });
    // Track Providers with OnDestroy hooks
    registerProvidersToDestroy(operationAppInjector);
    function getModuleContext(moduleId, ctx) {
      var _a;
      // Reuse a context or create if not available
      if (!contextCache[moduleId]) {
        // We're interested in operation-scoped providers only
        const providers =
          (_a = modulesMap.get(moduleId)) === null || _a === void 0
            ? void 0
            : _a.operationProviders;
        // Create module-level Operation-scoped Injector
        const operationModuleInjector = ReflectiveInjector.createFromResolved({
          name: `Module "${moduleId}" (Operation Scope)`,
          providers: providers.concat(
            ReflectiveInjector.resolve([
              {
                provide: CONTEXT,
                useFactory() {
                  return contextCache[moduleId];
                },
              },
            ])
          ),
          // This injector has a priority
          parent: modulesMap.get(moduleId).injector,
          // over this one
          fallbackParent: operationAppInjector,
        });
        // Same as on application level, we need to collect providers with OnDestroy hooks
        registerProvidersToDestroy(operationModuleInjector);
        contextCache[moduleId] = merge(ctx, {
          injector: operationModuleInjector,
          moduleId,
        });
      }
      return contextCache[moduleId];
    }
    const sharedContext = merge(
      // We want to pass the received context
      context || {},
      {
        // Here's something very crutial
        // It's a function that is used in module's context creation
        ??getModuleContext: getModuleContext,
      }
    );
    attachGlobalProvidersMap({
      injector: operationAppInjector,
      globalProvidersMap: operationGlobalProvidersMap,
      moduleInjectorGetter(moduleId) {
        return getModuleContext(moduleId, sharedContext).injector;
      },
    });
    return {
      ??destroy: once(() => {
        providersToDestroy.forEach(([injector, keyId]) => {
          // If provider was instantiated
          if (injector._isObjectDefinedByKeyId(keyId)) {
            // call its OnDestroy hook
            injector._getObjByKeyId(keyId).onDestroy();
          }
        });
        contextCache = {};
      }),
      ??injector: operationAppInjector,
      context: sharedContext,
    };
  };
  return contextBuilder;
}

function executionCreator({ contextBuilder }) {
  const createExecution = (options) => {
    // Custom or original execute function
    const executeFn =
      (options === null || options === void 0 ? void 0 : options.execute) ||
      execute$1;
    return (
      argsOrSchema,
      document,
      rootValue,
      contextValue,
      variableValues,
      operationName,
      fieldResolver,
      typeResolver
    ) => {
      var _a;
      // Create an execution context
      const { context, ??destroy: destroy } =
        (_a =
          options === null || options === void 0
            ? void 0
            : options.controller) !== null && _a !== void 0
          ? _a
          : contextBuilder(
              isNotSchema(argsOrSchema)
                ? argsOrSchema.contextValue
                : contextValue
            );
      const executionArgs = isNotSchema(argsOrSchema)
        ? {
            ...argsOrSchema,
            contextValue: context,
          }
        : {
            schema: argsOrSchema,
            document: document,
            rootValue,
            contextValue: context,
            variableValues,
            operationName,
            fieldResolver,
            typeResolver,
          };
      // It's important to wrap the executeFn within a promise
      // so we can easily control the end of execution (with finally)
      return Promise.resolve()
        .then(() => executeFn(executionArgs))
        .finally(destroy);
    };
  };
  return createExecution;
}

function subscriptionCreator({ contextBuilder }) {
  const createSubscription = (options) => {
    // Custom or original subscribe function
    const subscribeFn =
      (options === null || options === void 0 ? void 0 : options.subscribe) ||
      subscribe;
    return (
      argsOrSchema,
      document,
      rootValue,
      contextValue,
      variableValues,
      operationName,
      fieldResolver,
      subscribeFieldResolver
    ) => {
      var _a;
      // Create an subscription context
      const { context, ??destroy: destroy } =
        (_a =
          options === null || options === void 0
            ? void 0
            : options.controller) !== null && _a !== void 0
          ? _a
          : contextBuilder(
              isNotSchema(argsOrSchema)
                ? argsOrSchema.contextValue
                : contextValue
            );
      const subscriptionArgs = isNotSchema(argsOrSchema)
        ? {
            ...argsOrSchema,
            contextValue: context,
          }
        : {
            schema: argsOrSchema,
            document: document,
            rootValue,
            contextValue: context,
            variableValues,
            operationName,
            fieldResolver,
            subscribeFieldResolver,
          };
      let isIterable = false;
      // It's important to wrap the subscribeFn within a promise
      // so we can easily control the end of subscription (with finally)
      return Promise.resolve()
        .then(() => subscribeFn(subscriptionArgs))
        .then((sub) => {
          if (isAsyncIterable(sub)) {
            isIterable = true;
            return tapAsyncIterator(sub, destroy);
          }
          return sub;
        })
        .finally(() => {
          if (!isIterable) {
            destroy();
          }
        });
    };
  };
  return createSubscription;
}

const CONTEXT_ID = Symbol.for('context-id');
function apolloExecutorCreator({ createExecution }) {
  return function createApolloExecutor(options) {
    const executor = createExecution(options);
    return function executorAdapter(requestContext) {
      return executor({
        schema: requestContext.schema,
        document: requestContext.document,
        operationName: requestContext.operationName,
        variableValues: requestContext.request.variables,
        contextValue: requestContext.context,
      });
    };
  };
}
function apolloSchemaCreator({ createSubscription, contextBuilder, schema }) {
  const createApolloSchema = () => {
    const sessions = {};
    const subscription = createSubscription();
    function getSession(ctx) {
      if (!ctx[CONTEXT_ID]) {
        ctx[CONTEXT_ID] = uniqueId((id) => !sessions[id]);
        const { context, ??destroy: destroy } = contextBuilder(ctx);
        sessions[ctx[CONTEXT_ID]] = {
          count: 0,
          session: {
            context,
            destroy() {
              if (--sessions[ctx[CONTEXT_ID]].count === 0) {
                destroy();
                delete sessions[ctx[CONTEXT_ID]];
                delete ctx[CONTEXT_ID];
              }
            },
          },
        };
      }
      sessions[ctx[CONTEXT_ID]].count++;
      return sessions[ctx[CONTEXT_ID]].session;
    }
    return wrapSchema({
      schema,
      executor(input) {
        // Create an execution context
        const { context, destroy } = getSession(input.context);
        // It's important to wrap the executeFn within a promise
        // so we can easily control the end of execution (with finally)
        return Promise.resolve()
          .then(() => {
            var _a;
            return execute$1({
              schema,
              document: input.document,
              contextValue: context,
              variableValues: input.variables,
              rootValue:
                (_a = input.info) === null || _a === void 0
                  ? void 0
                  : _a.rootValue,
            });
          })
          .finally(destroy);
      },
      subscriber(input) {
        var _a;
        return subscription({
          schema,
          document: input.document,
          variableValues: input.variables,
          contextValue: input.context,
          rootValue:
            (_a = input.info) === null || _a === void 0 ? void 0 : _a.rootValue,
        });
      },
    });
  };
  return createApolloSchema;
}

function operationControllerCreator(options) {
  const { contextBuilder } = options;
  return (input) => {
    const operation = contextBuilder(input.context);
    const ??destroy = input.autoDestroy ? operation.??destroy : () => {};
    return {
      context: operation.context,
      injector: operation.??injector,
      destroy: operation.??destroy,
      ??destroy,
    };
  };
}

/**
 * @api
 * Creates Application out of Modules. Accepts `ApplicationConfig`.
 *
 * @example
 *
 * ```typescript
 * import { createApplication } from 'graphql-modules';
 * import { usersModule } from './users';
 * import { postsModule } from './posts';
 * import { commentsModule } from './comments';
 *
 * const app = createApplication({
 *   modules: [
 *     usersModule,
 *     postsModule,
 *     commentsModule
 *   ]
 * })
 * ```
 */
function createApplication(applicationConfig) {
  function applicationFactory(cfg) {
    const config = cfg || applicationConfig;
    const providers =
      config.providers && typeof config.providers === 'function'
        ? config.providers()
        : config.providers;
    // Creates an Injector with singleton classes at application level
    const appSingletonProviders = ReflectiveInjector.resolve(
      onlySingletonProviders(providers)
    );
    const appInjector = ReflectiveInjector.createFromResolved({
      name: 'App (Singleton Scope)',
      providers: appSingletonProviders,
    });
    // Filter Operation-scoped providers, and keep it here
    // so we don't do it over and over again
    const appOperationProviders = ReflectiveInjector.resolve(
      onlyOperationProviders(providers)
    );
    const middlewareMap = config.middlewares || {};
    // Validations
    ensureModuleUniqueIds(config.modules);
    // Create all modules
    const modules = config.modules.map((mod) =>
      mod.factory({
        injector: appInjector,
        middlewares: middlewareMap,
      })
    );
    const modulesMap = createModulesMap(modules);
    const singletonGlobalProvidersMap = createGlobalProvidersMap({
      modules,
      scope: Scope.Singleton,
    });
    const operationGlobalProvidersMap = createGlobalProvidersMap({
      modules,
      scope: Scope.Operation,
    });
    attachGlobalProvidersMap({
      injector: appInjector,
      globalProvidersMap: singletonGlobalProvidersMap,
      moduleInjectorGetter(moduleId) {
        return modulesMap.get(moduleId).injector;
      },
    });
    // Creating a schema, flattening the typedefs and resolvers
    // is not expensive since it happens only once
    const typeDefs = flatten(modules.map((mod) => mod.typeDefs));
    const resolvers = modules.map((mod) => mod.resolvers).filter(isDefined);
    const schema = (applicationConfig.schemaBuilder || makeExecutableSchema)({
      typeDefs,
      resolvers,
    });
    const contextBuilder = createContextBuilder({
      appInjector,
      appLevelOperationProviders: appOperationProviders,
      modulesMap: modulesMap,
      singletonGlobalProvidersMap,
      operationGlobalProvidersMap,
    });
    const createOperationController = operationControllerCreator({
      contextBuilder,
    });
    const createSubscription = subscriptionCreator({ contextBuilder });
    const createExecution = executionCreator({ contextBuilder });
    const createSchemaForApollo = apolloSchemaCreator({
      createSubscription,
      contextBuilder,
      schema,
    });
    const createApolloExecutor = apolloExecutorCreator({
      createExecution,
    });
    instantiateSingletonProviders({
      appInjector,
      modulesMap,
    });
    return {
      typeDefs,
      resolvers,
      schema,
      injector: appInjector,
      createOperationController,
      createSubscription,
      createExecution,
      createSchemaForApollo,
      createApolloExecutor,
      ??factory: applicationFactory,
      ??config: config,
    };
  }
  return applicationFactory();
}
function createModulesMap(modules) {
  var _a;
  const modulesMap = new Map();
  for (const module of modules) {
    if (modulesMap.has(module.id)) {
      const location = module.metadata.dirname;
      const existingLocation =
        (_a = modulesMap.get(module.id)) === null || _a === void 0
          ? void 0
          : _a.metadata.dirname;
      const info = [];
      if (existingLocation) {
        info.push(`Already registered module located at: ${existingLocation}`);
      }
      if (location) {
        info.push(`Duplicated module located at: ${location}`);
      }
      throw new ModuleDuplicatedError(
        `Module "${module.id}" already exists`,
        ...info
      );
    }
    modulesMap.set(module.id, module);
  }
  return modulesMap;
}
function ensureModuleUniqueIds(modules) {
  const collisions = modules
    .filter((mod, i, all) => i !== all.findIndex((m) => m.id === mod.id))
    .map((m) => m.id);
  if (collisions.length) {
    throw new ModuleNonUniqueIdError(
      `Modules with non-unique ids: ${collisions.join(', ')}`,
      `All modules should have unique ids, please locate and fix them.`
    );
  }
}

function metadataFactory(typeDefs, config) {
  const implemented = {};
  const extended = {};
  function collectObjectDefinition(node) {
    if (!implemented[node.name.value]) {
      implemented[node.name.value] = [];
    }
    if (node.fields && node.fields.length > 0) {
      implemented[node.name.value].push(
        ...node.fields.map((field) => field.name.value)
      );
    }
    if (node.kind === Kind.OBJECT_TYPE_DEFINITION) {
      implemented[node.name.value].push('__isTypeOf');
    }
    if (node.kind === Kind.OBJECT_TYPE_DEFINITION) {
      implemented[node.name.value].push('__resolveReference');
      implemented[node.name.value].push('__resolveObject');
    }
    if (node.kind === Kind.INTERFACE_TYPE_DEFINITION) {
      implemented[node.name.value].push('__resolveType');
    }
  }
  function collectObjectExtension(node) {
    if (node.fields) {
      if (!extended[node.name.value]) {
        extended[node.name.value] = [];
      }
      node.fields.forEach((field) => {
        extended[node.name.value].push(field.name.value);
      });
    }
  }
  for (const doc of typeDefs) {
    visit(doc, {
      // Object
      ObjectTypeDefinition(node) {
        collectObjectDefinition(node);
      },
      ObjectTypeExtension(node) {
        collectObjectExtension(node);
      },
      // Interface
      InterfaceTypeDefinition(node) {
        collectObjectDefinition(node);
      },
      InterfaceTypeExtension(node) {
        collectObjectExtension(node);
      },
      // Union
      UnionTypeDefinition(node) {
        if (!implemented[node.name.value]) {
          implemented[node.name.value] = [];
        }
        if (node.types) {
          implemented[node.name.value].push(
            ...node.types.map((type) => type.name.value)
          );
        }
        implemented[node.name.value].push('__resolveType');
      },
      UnionTypeExtension(node) {
        if (node.types) {
          if (!extended[node.name.value]) {
            extended[node.name.value] = [];
          }
          extended[node.name.value].push(
            ...node.types.map((type) => type.name.value)
          );
        }
      },
      // Input
      InputObjectTypeDefinition(node) {
        collectObjectDefinition(node);
      },
      InputObjectTypeExtension(node) {
        collectObjectExtension(node);
      },
      // Enum
      EnumTypeDefinition(node) {
        if (node.values) {
          if (!implemented[node.name.value]) {
            implemented[node.name.value] = [];
          }
          implemented[node.name.value].push(
            ...node.values.map((value) => value.name.value)
          );
        }
      },
      EnumTypeExtension(node) {
        if (node.values) {
          if (!extended[node.name.value]) {
            extended[node.name.value] = [];
          }
          extended[node.name.value].push(
            ...node.values.map((value) => value.name.value)
          );
        }
      },
      // Scalar
      ScalarTypeDefinition(node) {
        if (!implemented.__scalars) {
          implemented.__scalars = [];
        }
        implemented.__scalars.push(node.name.value);
      },
    });
  }
  return {
    id: config.id,
    typeDefs,
    implements: implemented,
    extends: extended,
    dirname: config.dirname,
  };
}

function compose(middleware) {
  if (!Array.isArray(middleware)) {
    throw new TypeError('Middleware stack must be an array!');
  }
  for (const fn of middleware) {
    if (typeof fn !== 'function') {
      throw new TypeError('Middleware must be composed of functions!');
    }
  }
  return function composed(context, next) {
    // last called middleware
    let index = -1;
    function dispatch(i) {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;
      const fn = i === middleware.length ? next : middleware[i];
      if (!fn) {
        return Promise.resolve();
      }
      try {
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }
    return dispatch(0);
  };
}
function createMiddleware(path, middlewareMap) {
  const middlewares = middlewareMap ? pickMiddlewares(path, middlewareMap) : [];
  return compose(middlewares);
}
function mergeMiddlewareMaps(app, mod) {
  const merge = (left, right) => {
    return mergeDeepWith(
      (l, r) => {
        if (Array.isArray(l)) {
          return l.concat(r || []);
        }
        return merge(l, r);
      },
      left,
      right
    );
  };
  return merge(app, mod);
}
function pickMiddlewares(path, middlewareMap) {
  var _a;
  const middlewares = [];
  const [type, field] = path;
  if ((_a = middlewareMap['*']) === null || _a === void 0 ? void 0 : _a['*']) {
    middlewares.push(...middlewareMap['*']['*']);
  }
  const typeMap = middlewareMap[type];
  if (typeMap) {
    if (typeMap['*']) {
      middlewares.push(...typeMap['*']);
    }
    if (field && typeMap[field]) {
      middlewares.push(...typeMap[field]);
    }
  }
  return middlewares.filter(isDefined);
}
function validateMiddlewareMap(middlewareMap, metadata) {
  const exists = checkExistence(metadata);
  for (const typeName in middlewareMap.types) {
    if (middlewareMap.types.hasOwnProperty(typeName)) {
      const typeMiddlewareMap = middlewareMap[typeName];
      if (!exists.type(typeName)) {
        throw new ExtraMiddlewareError(
          `Cannot apply a middleware to non existing "${typeName}" type`,
          useLocation({ dirname: metadata.dirname, id: metadata.id })
        );
      }
      for (const fieldName in typeMiddlewareMap[typeName]) {
        if (typeMiddlewareMap[typeName].hasOwnProperty(fieldName)) {
          if (!exists.field(typeName, fieldName)) {
            throw new ExtraMiddlewareError(
              `Cannot apply a middleware to non existing "${typeName}.${fieldName}" type.field`,
              useLocation({ dirname: metadata.dirname, id: metadata.id })
            );
          }
        }
      }
    }
  }
}
/**
 * Helps to make sure a middleware has a corresponding type/field definition.
 * We don't want to pass a module-level middlewares that are not related to the module.
 * Not because it's dangerous but to prevent unused middlewares.
 */
function checkExistence(metadata) {
  return {
    type(name) {
      var _a, _b;
      return isDefined(
        ((_a = metadata.implements) === null || _a === void 0
          ? void 0
          : _a[name]) ||
          ((_b = metadata.extends) === null || _b === void 0
            ? void 0
            : _b[name])
      );
    },
    field(type, name) {
      var _a, _b, _c, _d;
      return isDefined(
        ((_b =
          (_a = metadata.implements) === null || _a === void 0
            ? void 0
            : _a[type]) === null || _b === void 0
          ? void 0
          : _b.includes(name)) ||
          ((_d =
            (_c = metadata.extends) === null || _c === void 0
              ? void 0
              : _c[type]) === null || _d === void 0
            ? void 0
            : _d.includes(name))
      );
    },
  };
}

const resolverMetadataProp = Symbol('metadata');
function createResolvers(config, metadata, app) {
  const ensure = ensureImplements(metadata);
  const normalizedModuleMiddlewareMap = config.middlewares || {};
  const middlewareMap = mergeMiddlewareMaps(
    app.middlewareMap,
    normalizedModuleMiddlewareMap
  );
  validateMiddlewareMap(normalizedModuleMiddlewareMap, metadata);
  const resolvers = addDefaultResolvers(
    mergeResolvers(config),
    middlewareMap,
    config
  );
  // Wrap resolvers
  for (const typeName in resolvers) {
    if (resolvers.hasOwnProperty(typeName)) {
      const obj = resolvers[typeName];
      if (isScalarResolver(obj)) {
        continue;
      } else if (isEnumResolver(obj)) {
        continue;
      } else if (obj && typeof obj === 'object') {
        for (const fieldName in obj) {
          if (obj.hasOwnProperty(fieldName)) {
            ensure.type(typeName, fieldName);
            const path = [typeName, fieldName];
            // function
            if (isResolveFn(obj[fieldName])) {
              const resolver = wrapResolver({
                config,
                resolver: obj[fieldName],
                middlewareMap,
                path,
                isTypeResolver:
                  fieldName === '__isTypeOf' || fieldName === '__resolveType',
                isReferenceResolver: fieldName === '__resolveReference',
                isObjectResolver: fieldName === '__resolveObject',
              });
              resolvers[typeName][fieldName] = resolver;
            } else if (isResolveOptions(obj[fieldName])) {
              // { resolve }
              if (isDefined(obj[fieldName].resolve)) {
                const resolver = wrapResolver({
                  config,
                  resolver: obj[fieldName].resolve,
                  middlewareMap,
                  path,
                });
                resolvers[typeName][fieldName].resolve = resolver;
              }
              // { subscribe }
              if (isDefined(obj[fieldName].subscribe)) {
                const resolver = wrapResolver({
                  config,
                  resolver: obj[fieldName].subscribe,
                  middlewareMap,
                  path,
                });
                resolvers[typeName][fieldName].subscribe = resolver;
              }
            }
          }
        }
      }
    }
  }
  return resolvers;
}
/**
 * Wrap a resolver so we use module's context instead of app context.
 * Use a middleware if available.
 * Attach metadata to a resolver (we will see if it's helpful, probably in error handling)
 */
function wrapResolver({
  resolver,
  config,
  path,
  middlewareMap,
  isTypeResolver,
  isReferenceResolver,
  isObjectResolver,
}) {
  if (isTypeResolver || isReferenceResolver) {
    const wrappedResolver = (root, context, info) => {
      const ctx = {
        root,
        context: context.??getModuleContext(config.id, context),
        info,
      };
      return resolver(ctx.root, ctx.context, ctx.info);
    };
    writeResolverMetadata(wrappedResolver, config);
    return wrappedResolver;
  }
  if (isObjectResolver) {
    const wrappedResolver = (root, fields, context, info) => {
      const moduleContext = context.??getModuleContext(config.id, context);
      return resolver(root, fields, moduleContext, info);
    };
    writeResolverMetadata(wrappedResolver, config);
    return wrappedResolver;
  }
  const middleware = createMiddleware(path, middlewareMap);
  const wrappedResolver = (root, args, context, info) => {
    const ctx = {
      root,
      args,
      context: context.??getModuleContext(config.id, context),
      info,
    };
    return middleware(ctx, () =>
      resolver(ctx.root, ctx.args, ctx.context, ctx.info)
    );
  };
  writeResolverMetadata(wrappedResolver, config);
  return wrappedResolver;
}
/**
 * We iterate over every defined resolver and check if it's valid and not duplicated
 */
function mergeResolvers(config) {
  if (!config.resolvers) {
    return {};
  }
  const resolvers = Array.isArray(config.resolvers)
    ? config.resolvers
    : [config.resolvers];
  const container = {};
  for (const currentResolvers of resolvers) {
    for (const typeName in currentResolvers) {
      if (currentResolvers.hasOwnProperty(typeName)) {
        const value = currentResolvers[typeName];
        if (isNil(value)) {
          continue;
        } else if (isScalarResolver(value)) {
          addScalar({ typeName, resolver: value, container, config });
        } else if (isEnumResolver(value)) {
          addEnum({ typeName, resolver: value, container, config });
        } else if (value && typeof value === 'object') {
          addObject({ typeName, fields: value, container, config });
        } else {
          throw new ResolverInvalidError(
            `Resolver of "${typeName}" is invalid`,
            useLocation({ dirname: config.dirname, id: config.id })
          );
        }
      }
    }
  }
  return container;
}
function addObject({ typeName, fields, container, config }) {
  if (!container[typeName]) {
    container[typeName] = {};
  }
  for (const fieldName in fields) {
    if (fields.hasOwnProperty(fieldName)) {
      const resolver = fields[fieldName];
      if (isResolveFn(resolver)) {
        if (container[typeName][fieldName]) {
          throw new ResolverDuplicatedError(
            `Duplicated resolver of "${typeName}.${fieldName}"`,
            useLocation({ dirname: config.dirname, id: config.id })
          );
        }
        writeResolverMetadata(resolver, config);
        container[typeName][fieldName] = resolver;
      } else if (isResolveOptions(resolver)) {
        if (!container[typeName][fieldName]) {
          container[typeName][fieldName] = {};
        }
        // resolve
        if (isDefined(resolver.resolve)) {
          if (container[typeName][fieldName].resolve) {
            throw new ResolverDuplicatedError(
              `Duplicated resolver of "${typeName}.${fieldName}" (resolve method)`,
              useLocation({ dirname: config.dirname, id: config.id })
            );
          }
          writeResolverMetadata(resolver.resolve, config);
          container[typeName][fieldName].resolve = resolver.resolve;
        }
        // subscribe
        if (isDefined(resolver.subscribe)) {
          if (container[typeName][fieldName].subscribe) {
            throw new ResolverDuplicatedError(
              `Duplicated resolver of "${typeName}.${fieldName}" (subscribe method)`,
              useLocation({ dirname: config.dirname, id: config.id })
            );
          }
          writeResolverMetadata(resolver.subscribe, config);
          container[typeName][fieldName].subscribe = resolver.subscribe;
        }
      }
    }
  }
}
function addScalar({ typeName, resolver, container, config }) {
  if (container[typeName]) {
    throw new ResolverDuplicatedError(
      `Duplicated resolver of scalar "${typeName}"`,
      useLocation({ dirname: config.dirname, id: config.id })
    );
  }
  writeResolverMetadata(resolver.parseLiteral, config);
  writeResolverMetadata(resolver.parseValue, config);
  writeResolverMetadata(resolver.serialize, config);
  container[typeName] = resolver;
}
function addEnum({ typeName, resolver, container, config }) {
  if (!container[typeName]) {
    container[typeName] = {};
  }
  for (const key in resolver) {
    if (resolver.hasOwnProperty(key)) {
      const value = resolver[key];
      if (container[typeName][key]) {
        throw new ResolverDuplicatedError(
          `Duplicated resolver of "${typeName}.${key}" enum value`,
          useLocation({ dirname: config.dirname, id: config.id })
        );
      }
      container[typeName][key] = value;
    }
  }
}
/**
 * Helps to make sure a resolver has a corresponding type/field definition.
 * We don't want to pass resolve function that are not related to the module.
 */
function ensureImplements(metadata) {
  return {
    type(name, field) {
      var _a, _b;
      const type = []
        .concat(
          (_a = metadata.implements) === null || _a === void 0
            ? void 0
            : _a[name],
          (_b = metadata.extends) === null || _b === void 0 ? void 0 : _b[name]
        )
        .filter(isDefined);
      if (type === null || type === void 0 ? void 0 : type.includes(field)) {
        return true;
      }
      const id = `"${name}.${field}"`;
      throw new ExtraResolverError(
        `Resolver of "${id}" type cannot be implemented`,
        `${id} is not defined`,
        useLocation({ dirname: metadata.dirname, id: metadata.id })
      );
    },
    scalar(name) {
      var _a;
      if (
        (
          ((_a = metadata.implements) === null || _a === void 0
            ? void 0
            : _a.__scalars) || []
        ).includes(name)
      ) {
        return true;
      }
      throw new ExtraResolverError(
        `Resolver of "${name}" scalar cannot be implemented`,
        `${name} is not defined`,
        useLocation({ dirname: metadata.dirname, id: metadata.id })
      );
    },
  };
}
function writeResolverMetadata(resolver, config) {
  if (!resolver) {
    return;
  }
  resolver[resolverMetadataProp] = {
    moduleId: config.id,
  };
}
/**
 * In order to use middlewares on fields
 * that are defined in SDL but have no implemented resolvers,
 * we would have to recreate GraphQLSchema and wrap resolve functions.
 *
 * Since we can't access GraphQLSchema on a module level
 * and recreating GraphQLSchema seems unreasonable,
 * we can create default resolvers instead.
 *
 * @example
 *
 * gql`
 *  type Query {
 *    me: User!
 *  }
 *
 *  type User {
 *    name: String!
 *  }
 * `
 *
 * The resolver of `Query.me` is implemented and resolver of `User.name` is not.
 * In case where a middleware wants to intercept the resolver of `User.name`,
 * we use a default field resolver from `graphql` package
 * and put it next to other defined resolvers.
 *
 * This way our current logic of wrapping resolvers and running
 * middleware functions stays untouched.
 */
function addDefaultResolvers(resolvers, middlewareMap, config) {
  const container = resolvers;
  const sdl = Array.isArray(config.typeDefs)
    ? concatAST(config.typeDefs)
    : config.typeDefs;
  function hasMiddleware(typeName, fieldName) {
    var _a, _b, _c, _d, _e, _f;
    return (
      (((_b =
        (_a = middlewareMap['*']) === null || _a === void 0
          ? void 0
          : _a['*']) === null || _b === void 0
        ? void 0
        : _b.length) ||
        ((_d =
          (_c = middlewareMap[typeName]) === null || _c === void 0
            ? void 0
            : _c['*']) === null || _d === void 0
          ? void 0
          : _d.length) ||
        ((_f =
          (_e = middlewareMap[typeName]) === null || _e === void 0
            ? void 0
            : _e[fieldName]) === null || _f === void 0
          ? void 0
          : _f.length)) > 0
    );
  }
  sdl.definitions.forEach((definition) => {
    if (
      definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
      definition.kind === Kind.OBJECT_TYPE_EXTENSION
    ) {
      // Right now we only support Object type
      if (definition.fields) {
        const typeName = definition.name.value;
        definition.fields.forEach((field) => {
          var _a;
          const fieldName = field.name.value;
          if (
            !((_a = container[typeName]) === null || _a === void 0
              ? void 0
              : _a[fieldName]) &&
            hasMiddleware(typeName, fieldName)
          ) {
            if (!container[typeName]) {
              container[typeName] = {};
            }
            container[typeName][fieldName] = defaultFieldResolver;
          }
        });
      }
    }
  });
  return container;
}
//
// Resolver helpers
//
function isResolveFn(value) {
  return typeof value === 'function';
}
function isResolveOptions(value) {
  return isDefined(value.resolve) || isDefined(value.subscribe);
}
function isScalarResolver(obj) {
  return obj instanceof GraphQLScalarType;
}
function isEnumResolver(obj) {
  return Object.values(obj).every(isPrimitive);
}

/**
 * Create a list of DocumentNode objects based on Module's config.
 * Add a location, so we get richer errors.
 */
function createTypeDefs(config) {
  const typeDefs = Array.isArray(config.typeDefs)
    ? config.typeDefs
    : [config.typeDefs];
  ensureDocumentNode(config, typeDefs);
  return typeDefs;
}
function ensureDocumentNode(config, typeDefs) {
  function ensureEach(doc, i) {
    if (
      (doc === null || doc === void 0 ? void 0 : doc.kind) !== Kind.DOCUMENT
    ) {
      throw new NonDocumentNodeError(
        `Expected parsed document but received ${typeof doc} at index ${i} in typeDefs list`,
        useLocation(config)
      );
    }
  }
  typeDefs.forEach(ensureEach);
}

/**
 * @api
 * `MODULE_ID` is an InjectionToken representing module's ID
 *
 * @example
 * ```typescript
 * import { MODULE_ID, Inject, Injectable } from 'graphql-modules';
 *
 * (A)Injectable()
 * export class Data {
 *   constructor((A)Inject(MODULE_ID) moduleId: string) {
 *     console.log(`Data used in ${moduleId} module`)
 *   }
 * }
 * ```
 */
const MODULE_ID = new InjectionToken('module-id');

function moduleFactory(config) {
  const typeDefs = createTypeDefs(config);
  const metadata = metadataFactory(typeDefs, config);
  const providers =
    typeof config.providers === 'function'
      ? config.providers()
      : config.providers;
  // Filter providers and keep them this way
  // so we don't do this filtering multiple times.
  // Providers don't change over time, so it's safe to do it.
  const operationProviders = ReflectiveInjector.resolve(
    onlyOperationProviders(providers)
  );
  const singletonProviders = ReflectiveInjector.resolve(
    onlySingletonProviders(providers)
  );
  const mod = {
    id: config.id,
    config,
    metadata,
    typeDefs,
    providers,
    operationProviders,
    singletonProviders,
    // Factory is called once on application creation,
    // before we even handle GraphQL Operation
    factory(app) {
      const resolvedModule = mod;
      resolvedModule.singletonProviders = singletonProviders;
      resolvedModule.operationProviders = operationProviders;
      // Create a  module-level Singleton injector
      const injector = ReflectiveInjector.createFromResolved({
        name: `Module "${config.id}" (Singleton Scope)`,
        providers: resolvedModule.singletonProviders.concat(
          resolveProviders([
            {
              // with module's id, useful in Logging and stuff
              provide: MODULE_ID,
              useValue: config.id,
            },
          ])
        ),
        parent: app.injector,
      });
      // We attach injector property to existing `mod` object
      // because we want to keep references
      // that are later on used in testing utils
      resolvedModule.injector = injector;
      // Create resolvers object based on module's config
      // It involves wrapping a resolver with middlewares
      // and other things like validation
      resolvedModule.resolvers = createResolvers(config, metadata, {
        middlewareMap: app.middlewares,
      });
      return resolvedModule;
    },
  };
  return mod;
}

/**
 * @api
 * Creates a Module, an element used by Application. Accepts `ModuleConfig`.
 *
 * @example
 *
 * ```typescript
 * import { createModule, gql } from 'graphql-modules';
 *
 * export const usersModule = createModule({
 *   id: 'users',
 *   typeDefs: gql`
 *     // GraphQL SDL
 *   `,
 *   resolvers: {
 *     // ...
 *   }
 * });
 * ```
 */
function createModule(config) {
  return moduleFactory(config);
}

function gql(literals) {
  const result = typeof literals === 'string' ? literals : literals[0];
  const parsed = parse(result);
  if (!parsed || parsed.kind !== Kind.DOCUMENT) {
    throw new Error('Not a valid GraphQL document.');
  }
  return parsed;
}

function mockApplication(app) {
  function mockedFactory(newConfig) {
    const sharedFactory = share(() => app.??factory(newConfig));
    return {
      get typeDefs() {
        return sharedFactory().typeDefs;
      },
      get resolvers() {
        return sharedFactory().resolvers;
      },
      get schema() {
        return sharedFactory().schema;
      },
      get injector() {
        return sharedFactory().injector;
      },
      createOperationController(options) {
        return sharedFactory().createOperationController(options);
      },
      createSubscription(options) {
        return sharedFactory().createSubscription(options);
      },
      createExecution(options) {
        return sharedFactory().createExecution(options);
      },
      createSchemaForApollo() {
        return sharedFactory().createSchemaForApollo();
      },
      createApolloExecutor() {
        return sharedFactory().createApolloExecutor();
      },
      get ??factory() {
        return sharedFactory().??factory;
      },
      get ??config() {
        return sharedFactory().??config;
      },
      replaceModule(newModule) {
        const config = sharedFactory().??config;
        return mockedFactory({
          ...config,
          modules: config.modules.map((mod) =>
            mod.id === newModule.??originalModule.id ? newModule : mod
          ),
        });
      },
      addProviders(newProviders) {
        const config = sharedFactory().??config;
        const existingProviders =
          typeof config.providers === 'function'
            ? config.providers()
            : config.providers;
        const providers = Array.isArray(existingProviders)
          ? existingProviders.concat(newProviders)
          : newProviders;
        return mockedFactory({
          ...config,
          providers,
        });
      },
    };
  }
  return mockedFactory();
}

function mockModule(testedModule, overrideConfig) {
  const sourceProviders =
    typeof testedModule.config.providers === 'function'
      ? testedModule.config.providers()
      : testedModule.config.providers;
  const overrideProviders =
    typeof overrideConfig.providers === 'function'
      ? overrideConfig.providers()
      : overrideConfig.providers;
  const newModule = createModule({
    ...testedModule.config,
    providers: [...(sourceProviders || []), ...(overrideProviders || [])],
  });
  newModule['??originalModule'] = testedModule;
  return newModule;
}
function testModule(testedModule, config) {
  var _a;
  const mod = transformModule(testedModule, config);
  const modules = [mod].concat(
    (_a = config === null || config === void 0 ? void 0 : config.modules) !==
      null && _a !== void 0
      ? _a
      : []
  );
  return createApplication({
    ...(config || {}),
    modules,
    providers: config === null || config === void 0 ? void 0 : config.providers,
    middlewares:
      config === null || config === void 0 ? void 0 : config.middlewares,
  });
}
function transformModule(mod, config) {
  const transforms = [];
  if (
    config === null || config === void 0 ? void 0 : config.replaceExtensions
  ) {
    transforms.push((m) =>
      moduleFactory({
        ...m.config,
        typeDefs: replaceExtensions(m.typeDefs),
      })
    );
  }
  if (config === null || config === void 0 ? void 0 : config.typeDefs) {
    transforms.push((m) =>
      moduleFactory({
        ...m.config,
        typeDefs: m.typeDefs.concat(config.typeDefs),
      })
    );
  }
  if (config === null || config === void 0 ? void 0 : config.inheritTypeDefs) {
    transforms.push((m) =>
      moduleFactory({
        ...m.config,
        typeDefs: inheritTypeDefs(m.typeDefs, config.inheritTypeDefs),
      })
    );
  }
  if (config === null || config === void 0 ? void 0 : config.resolvers) {
    transforms.push((m) => {
      const resolvers = m.config.resolvers
        ? Array.isArray(m.config.resolvers)
          ? m.config.resolvers
          : [m.config.resolvers]
        : [];
      return moduleFactory({
        ...m.config,
        resolvers: resolvers.concat(config.resolvers),
      });
    });
  }
  if (transforms) {
    return transforms.reduce((m, transform) => transform(m), mod);
  }
  return mod;
}
function inheritTypeDefs(originalTypeDefs, modules) {
  const original = concatAST(originalTypeDefs);
  const typeDefs = treeshakeTypesDefs(
    original,
    modules.reduce(
      (typeDefs, externalMod) => typeDefs.concat(externalMod.typeDefs),
      []
    )
  );
  return typeDefs;
}
function replaceExtensions(typeDefs) {
  const types = [];
  const extensions = [];
  // List all object types
  typeDefs.forEach((doc) => {
    visit(doc, {
      ObjectTypeDefinition(node) {
        types.push(node.name.value);
      },
    });
  });
  // turn object type extensions into object types
  return typeDefs.map((doc) => {
    return visit(doc, {
      ObjectTypeExtension(node) {
        // only if object type doesn't exist
        if (
          extensions.includes(node.name.value) ||
          types.includes(node.name.value)
        ) {
          return node;
        }
        return {
          ...node,
          kind: Kind.OBJECT_TYPE_DEFINITION,
        };
      },
    });
  });
}
function treeshakeTypesDefs(originalSource, sources) {
  const namedTypes = originalSource.definitions.filter(isNamedTypeDefinition);
  const typesToVisit = namedTypes.map((def) => def.name.value);
  const rootFields = namedTypes.reduce((acc, node) => {
    const typeName = node.name.value;
    if (isRootType(typeName) && hasFields(node)) {
      if (!acc[typeName]) {
        acc[typeName] = [];
      }
      node.fields.forEach((field) => {
        acc[typeName].push(field.name.value);
      });
    }
    return acc;
  }, {});
  const schema = concatAST([originalSource].concat(sources));
  const involvedTypes = new Set(visitTypes(schema, typesToVisit, rootFields));
  return {
    kind: Kind.DOCUMENT,
    definitions: schema.definitions.filter((def) => {
      var _a, _b;
      if (isNamedTypeDefinition(def)) {
        const typeName = def.name.value;
        if (!involvedTypes.has(def.name.value)) {
          return false;
        }
        if (
          (_a = rootFields[typeName]) === null || _a === void 0
            ? void 0
            : _a.length
        ) {
          const rootType = def;
          if (
            (_b = rootType.fields) === null || _b === void 0
              ? void 0
              : _b.every(
                  (field) => !rootFields[typeName].includes(field.name.value)
                )
          ) {
            return false;
          }
        }
      }
      return true;
    }),
  };
}
function isNamedTypeDefinition(def) {
  return (
    !!def &&
    def.kind !== Kind.SCHEMA_DEFINITION &&
    def.kind !== Kind.SCHEMA_EXTENSION
  );
}
function visitTypes(schema, types, rootFields) {
  const visitedTypes = [];
  const scalars = schema.definitions
    .filter(
      (def) =>
        def.kind === Kind.SCALAR_TYPE_DEFINITION ||
        def.kind === Kind.SCALAR_TYPE_EXTENSION
    )
    .map((def) => def.name.value);
  for (const typeName of types) {
    collectType(typeName);
  }
  return visitedTypes;
  function collectField(field, parentTypeName) {
    var _a;
    if (
      parentTypeName &&
      isRootType(parentTypeName) &&
      ((_a = rootFields[parentTypeName]) === null || _a === void 0
        ? void 0
        : _a.length) &&
      !rootFields[parentTypeName].includes(field.name.value)
    ) {
      return;
    }
    collectType(resolveType(field.type));
    if (field.arguments) {
      field.arguments.forEach((arg) => {
        collectType(resolveType(arg.type));
      });
    }
    if (field.directives) {
      field.directives.forEach((directive) => {
        collectType(directive.name.value);
      });
    }
  }
  function collectType(typeName) {
    if (visitedTypes.includes(typeName)) {
      return;
    }
    if (isScalar(typeName)) {
      visitedTypes.push(typeName);
      return;
    }
    const types = findTypes(typeName);
    visitedTypes.push(typeName);
    types.forEach((type) => {
      if (hasFields(type)) {
        type.fields.forEach((field) => {
          collectField(field, typeName);
        });
      }
      if (hasTypes(type)) {
        type.types.forEach((t) => {
          collectType(resolveType(t));
        });
      }
      if (hasInterfaces(type)) {
        type.interfaces.forEach((i) => {
          collectType(resolveType(i));
        });
      }
    });
  }
  function resolveType(type) {
    if (type.kind === 'ListType') {
      return resolveType(type.type);
    }
    if (type.kind === 'NonNullType') {
      return resolveType(type.type);
    }
    return type.name.value;
  }
  function isScalar(name) {
    return scalars
      .concat(['String', 'Boolean', 'Int', 'ID', 'Float'])
      .includes(name);
  }
  function findTypes(typeName) {
    const types = schema.definitions.filter(
      (def) => isNamedTypeDefinition(def) && def.name.value === typeName
    );
    if (!types.length) {
      throw new Error(`Missing type "${typeName}"`);
    }
    return types;
  }
}
function hasInterfaces(def) {
  return (
    hasPropValue(def, 'interfaces') &&
    [
      Kind.OBJECT_TYPE_DEFINITION,
      Kind.OBJECT_TYPE_EXTENSION,
      Kind.INTERFACE_TYPE_DEFINITION,
      Kind.INTERFACE_TYPE_EXTENSION,
    ].includes(def.kind)
  );
}
function hasTypes(def) {
  return (
    [Kind.UNION_TYPE_DEFINITION, Kind.UNION_TYPE_EXTENSION].includes(
      def.kind
    ) && hasPropValue(def, 'types')
  );
}
function hasFields(def) {
  return (
    [
      Kind.OBJECT_TYPE_DEFINITION,
      Kind.OBJECT_TYPE_EXTENSION,
      Kind.INTERFACE_TYPE_DEFINITION,
      Kind.INTERFACE_TYPE_EXTENSION,
      Kind.INPUT_OBJECT_TYPE_DEFINITION,
      Kind.INPUT_OBJECT_TYPE_EXTENSION,
    ].includes(def.kind) && hasPropValue(def, 'fields')
  );
}
function hasPropValue(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop) && obj[prop];
}
function isRootType(typeName) {
  return (
    typeName === 'Query' ||
    typeName === 'Mutation' ||
    typeName === 'Subscription'
  );
}

function testInjector(providers) {
  const resolvedProviders = ReflectiveInjector.resolve([
    { provide: CONTEXT, useValue: {} },
    ...providers,
  ]);
  const injector = ReflectiveInjector.createFromResolved({
    name: 'test',
    providers: resolvedProviders,
  });
  injector.instantiateAll();
  return injector;
}
function readProviderOptions(provider) {
  return readInjectableMetadata(provider, true).options;
}

function execute(app, inputs, options) {
  const executor = app.createExecution(options);
  return executor({
    schema: app.schema,
    ...inputs,
  });
}

function provideEmpty(token) {
  return {
    provide: token,
    useValue: {},
  };
}

const testkit = {
  mockApplication,
  mockModule,
  testModule,
  testInjector,
  readProviderOptions,
  provideEmpty,
  execute,
};

export {
  CONTEXT,
  ExecutionContext,
  Inject,
  Injectable,
  InjectionToken,
  Injector,
  MODULE_ID,
  Optional,
  Scope,
  createApplication,
  createModule,
  forwardRef,
  gql,
  metadataFactory,
  testkit,
};
//# sourceMappingURL=index.esm.js.map
