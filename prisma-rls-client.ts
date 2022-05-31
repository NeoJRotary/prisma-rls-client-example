import { PrismaClient, PrismaPromise } from "@prisma/client";

type AnyFunction = (...args: any[]) => any;

export const globalClient = new PrismaClient();

// we don't directly extend PrismaClient so we need to extend it in TS for typing
export interface PrismaRlsClient extends PrismaClient {}

export class PrismaRlsClient {
  _global = globalClient;

  rls: {
    orgId?: string;
  } = {};

  constructor() {
    this._reflectProto();
    this._reflectModel();
  }

  private _reflectProto() {
    // bind all from global client by default
    Object.keys(globalClient).forEach((k) => {
      this[k] = globalClient[k];
    });

    this.$executeRaw = this._rebuildQueryMethod(globalClient.$executeRaw);
    this.$executeRawUnsafe = this._rebuildQueryMethod(
      globalClient.$executeRawUnsafe
    );
    this.$queryRaw = this._rebuildQueryMethod(globalClient.$queryRaw);
    this.$queryRawUnsafe = this._rebuildQueryMethod(
      globalClient.$queryRawUnsafe
    );
    this.$transaction = this._rebuildTransaction();

    // prevent unexpected connect/disconnect
    this.$connect = () => null;
    this.$disconnect = () => null;
  }

  private _reflectModel() {
    Object.keys(globalClient).forEach((name) => {
      const delegate = globalClient[name];
      if (typeof delegate?.findUnique !== "function") {
        // model delegate should have `findUnique` method
        return;
      }

      // create delegate object on this instance
      this[name] = {};

      Object.keys(delegate).forEach((k) => {
        this[name][k] = this._rebuildQueryMethod(delegate[k]);
      });
    });
  }

  private _getRlsPromises() {
    // custom your
    return {
      before: [globalClient.$executeRawUnsafe(`SET orgId='${this.rls.orgId}'`)],
      after: [globalClient.$executeRawUnsafe(`SET orgId=''`)],
    };
  }

  private _rebuildQueryMethod<Fn extends AnyFunction>(method: Fn): Fn {
    // rebuild function only
    if (typeof method !== "function") return method;
    const newFn = (...args: Parameters<Fn>) => {
      const { before, after } = this._getRlsPromises();
      return (
        globalClient
          .$transaction([
            ...before,
            Reflect.apply(method, globalClient, args),
            ...after,
          ])
          // extract real method result
          .then((results) => results[before.length])
      );
    };
    return newFn as Fn;
  }

  private _rebuildTransaction() {
    return <P extends PrismaPromise<any>[]>(arg: [...P]) => {
      const { before, after } = this._getRlsPromises();
      return (
        globalClient
          .$transaction([...before, ...arg, ...after] as [...P])
          // extract real method result
          .then(
            (results) =>
              results.slice(
                before.length,
                before.length + arg.length
              ) as typeof results
          )
      );
    };
  }
}
