import { randomInt, randomUUID } from 'node:crypto';
import {
  BffSettingKeys,
  InvalidSettingError,
  PRODUCTION_ENVIRONMENT,
  REQUIRED_PRODUCTION_TEXT_SETTINGS,
  REQUIRED_PRODUCTION_URL_SETTINGS,
  REQUIRED_TEXT_SETTINGS,
  REQUIRED_URL_SETTINGS,
  assertRequiredBffSettings,
  isProductionEnvironment,
  requiredIntegerSetting,
  requiredPositiveIntegerSetting,
  requiredSetting,
  requiredUrlSetting,
} from './settings';

function newUrl(): string {
  return `https://${randomUUID()}.example/`;
}

describe('required settings', () => {
  const key = BffSettingKeys.SessionSecret;
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env[key];
    delete process.env[key];
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved;
    }
  });

  it('returns a configured value', () => {
    const value = randomUUID();
    process.env[key] = value;

    expect(requiredSetting(key)).toBe(value);
  });

  it('throws naming the setting when it is absent', () => {
    expect(() => requiredSetting(key)).toThrow(new InvalidSettingError(key));
  });

  it('throws naming the setting when it is whitespace', () => {
    process.env[key] = ' '.repeat(randomInt(1, 5));

    expect(() => requiredSetting(key)).toThrow(new InvalidSettingError(key));
  });

  it('returns a configured integer', () => {
    const value = randomInt(1, 65536);
    process.env[key] = String(value);

    expect(requiredIntegerSetting(key)).toBe(value);
  });

  it('throws naming the setting when it is not an integer', () => {
    process.env[key] = randomUUID();

    expect(() => requiredIntegerSetting(key)).toThrow(new InvalidSettingError(key));
  });

  it('returns a configured positive integer', () => {
    const value = randomInt(1, 65536);
    process.env[key] = String(value);

    expect(requiredPositiveIntegerSetting(key)).toBe(value);
  });

  it('throws naming the setting when an integer that must be positive is not', () => {
    process.env[key] = String(-randomInt(0, 65536));

    expect(() => requiredPositiveIntegerSetting(key)).toThrow(new InvalidSettingError(key));
  });

  it('returns a configured URL', () => {
    const value = newUrl();
    process.env[key] = value;

    expect(requiredUrlSetting(key).toString()).toBe(value);
  });

  it('throws naming the setting when it is not a URL', () => {
    process.env[key] = randomUUID();

    expect(() => requiredUrlSetting(key)).toThrow(new InvalidSettingError(key));
  });

  it('carries the setting on the error so callers never parse the message', () => {
    const error = new InvalidSettingError(key);

    expect(error.setting).toBe(key);
  });
});

describe('production startup settings check', () => {
  const productionNames = [...REQUIRED_PRODUCTION_URL_SETTINGS, ...REQUIRED_PRODUCTION_TEXT_SETTINGS];
  const names = [...REQUIRED_URL_SETTINGS, ...REQUIRED_TEXT_SETTINGS, ...productionNames, BffSettingKeys.NodeEnv];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    names.forEach(name => {
      saved[name] = process.env[name];
    });
    [...REQUIRED_URL_SETTINGS, ...REQUIRED_PRODUCTION_URL_SETTINGS].forEach(name => {
      process.env[name] = newUrl();
    });
    [...REQUIRED_TEXT_SETTINGS, ...REQUIRED_PRODUCTION_TEXT_SETTINGS].forEach(name => {
      process.env[name] = randomUUID();
    });
    process.env[BffSettingKeys.NodeEnv] = PRODUCTION_ENVIRONMENT;
  });

  afterEach(() => {
    names.forEach(name => {
      if (saved[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = saved[name];
      }
    });
  });

  it('passes in production when every telemetry setting is present and valid', () => {
    expect(() => assertRequiredBffSettings()).not.toThrow();
  });

  it.each(productionNames)('refuses to start in production without %s', missing => {
    delete process.env[missing];

    expect(() => assertRequiredBffSettings()).toThrow(new InvalidSettingError(missing));
  });

  it.each(REQUIRED_PRODUCTION_URL_SETTINGS)('refuses to start in production when %s is not a URL', invalid => {
    process.env[invalid] = randomUUID();

    expect(() => assertRequiredBffSettings()).toThrow(new InvalidSettingError(invalid));
  });

  it.each(productionNames)('does not require %s outside production', missing => {
    process.env[BffSettingKeys.NodeEnv] = randomUUID();
    delete process.env[missing];

    expect(() => assertRequiredBffSettings()).not.toThrow();
  });
});

describe('production environment', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env[BffSettingKeys.NodeEnv];
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env[BffSettingKeys.NodeEnv];
    } else {
      process.env[BffSettingKeys.NodeEnv] = saved;
    }
  });

  it('is production when NODE_ENV names the production environment', () => {
    process.env[BffSettingKeys.NodeEnv] = PRODUCTION_ENVIRONMENT;

    expect(isProductionEnvironment()).toBe(true);
  });

  it('is not production for any other NODE_ENV', () => {
    process.env[BffSettingKeys.NodeEnv] = randomUUID();

    expect(isProductionEnvironment()).toBe(false);
  });
});

describe('startup settings check', () => {
  const names = [...REQUIRED_URL_SETTINGS, ...REQUIRED_TEXT_SETTINGS];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    names.forEach(name => {
      saved[name] = process.env[name];
    });
    REQUIRED_URL_SETTINGS.forEach(name => {
      process.env[name] = newUrl();
    });
    REQUIRED_TEXT_SETTINGS.forEach(name => {
      process.env[name] = randomUUID();
    });
  });

  afterEach(() => {
    names.forEach(name => {
      if (saved[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = saved[name];
      }
    });
  });

  it('passes when every required setting is present and valid', () => {
    expect(() => assertRequiredBffSettings()).not.toThrow();
  });

  it.each(names)('refuses to start without %s', missing => {
    delete process.env[missing];

    expect(() => assertRequiredBffSettings()).toThrow(new InvalidSettingError(missing));
  });

  it.each(REQUIRED_URL_SETTINGS)('refuses to start when %s is not a URL', invalid => {
    process.env[invalid] = randomUUID();

    expect(() => assertRequiredBffSettings()).toThrow(new InvalidSettingError(invalid));
  });
});
