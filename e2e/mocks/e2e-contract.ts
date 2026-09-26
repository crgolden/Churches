import { newPathSegment } from '@crgolden/modules/testing';
import { E2E_CONTRACT_VARIABLE } from './e2e-contract-constants';

export { E2E_CONTRACT_VARIABLE };

export interface ControlRoutePaths {
  readonly reset: string;
  readonly churches: string;
  readonly corrections: string;
}

export interface E2eContract {
  readonly mockDirectoryPort: number;
  readonly controlRoutes: ControlRoutePaths;
}

function newControlRoute(): string {
  return `/${newPathSegment()}/${newPathSegment()}`;
}

export function newE2eContract(mockDirectoryPort: number): E2eContract {
  return {
    mockDirectoryPort,
    controlRoutes: {
      reset: newControlRoute(),
      churches: newControlRoute(),
      corrections: newControlRoute(),
    },
  };
}

export function e2eContract(): E2eContract {
  const serialized = process.env[E2E_CONTRACT_VARIABLE];
  if (serialized === undefined || serialized.length === 0) {
    throw new Error(
      `${E2E_CONTRACT_VARIABLE} is unset; playwright.config.ts generates it once for the runner, its workers and the mock Directory.`,
    );
  }
  return JSON.parse(serialized) as E2eContract;
}
