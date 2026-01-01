import { PrismaClient } from '@prisma/client';

type AnyDelegate = {
  [key: string]: (...args: any[]) => any;
};

declare module '@prisma/client' {
  interface PrismaClient {
    planningEntry: AnyDelegate;
  }
}

export {};
