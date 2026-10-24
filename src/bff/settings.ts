export const MEMORY_SESSION_STORE = 'memory';

export const BffSettingKeys = {
  NodeEnv: 'NODE_ENV',
  WebsiteSiteName: 'WEBSITE_SITE_NAME',
  Port: 'PORT',
  SessionSecret: 'SessionSecret',
  SessionStore: 'SessionStore',
  RedisHost: 'RedisHost',
  RedisPort: 'RedisPort',
  RedisPassword: 'RedisPassword',
  RedisSocketTimeoutMs: 'RedisSocketTimeoutMs',
  RedisPingIntervalMs: 'RedisPingIntervalMs',
  RedisReconnectStepMs: 'RedisReconnectStepMs',
  RedisReconnectMaxDelayMs: 'RedisReconnectMaxDelayMs',
  RedisReconnectJitterMs: 'RedisReconnectJitterMs',
  OidcAuthority: 'OidcAuthority',
  ClientId: 'ChurchesClientId',
  ClientSecret: 'ChurchesClientSecret',
  DirectoryApiAddress: 'DirectoryApiAddress',
  SitemapBlobBaseUrl: 'SitemapBlobBaseUrl',
  ElasticsearchNode: 'ElasticsearchNode',
  ElasticsearchUsername: 'ElasticsearchUsername',
  ElasticsearchPassword: 'ElasticsearchPassword',
  AlloyEndpoint: 'AlloyEndpoint',
} as const;

export type BffSettingKey = (typeof BffSettingKeys)[keyof typeof BffSettingKeys];

export const PRODUCTION_ENVIRONMENT = 'production';

export function isProductionEnvironment(): boolean {
  return process.env[BffSettingKeys.NodeEnv] === PRODUCTION_ENVIRONMENT;
}

export class InvalidSettingError extends Error {
  constructor(readonly setting: BffSettingKey) {
    super(`Invalid '${setting}'.`);
    this.name = 'InvalidSettingError';
  }
}

export function requiredSetting(name: BffSettingKey): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new InvalidSettingError(name);
  }

  return value;
}

export function requiredUrlSetting(name: BffSettingKey): URL {
  const value = requiredSetting(name);
  if (!URL.canParse(value)) {
    throw new InvalidSettingError(name);
  }

  return new URL(value);
}

export function requiredIntegerSetting(name: BffSettingKey): number {
  const value = Number(requiredSetting(name));
  if (!Number.isInteger(value)) {
    throw new InvalidSettingError(name);
  }

  return value;
}

export function requiredPositiveIntegerSetting(name: BffSettingKey): number {
  const value = requiredIntegerSetting(name);
  if (value <= 0) {
    throw new InvalidSettingError(name);
  }

  return value;
}

export const REQUIRED_URL_SETTINGS = [
  BffSettingKeys.OidcAuthority,
  BffSettingKeys.DirectoryApiAddress,
  BffSettingKeys.SitemapBlobBaseUrl,
] as const;

export const REQUIRED_TEXT_SETTINGS = [BffSettingKeys.ClientId, BffSettingKeys.ClientSecret] as const;

export const REQUIRED_PRODUCTION_URL_SETTINGS = [BffSettingKeys.AlloyEndpoint, BffSettingKeys.ElasticsearchNode] as const;

export const REQUIRED_PRODUCTION_TEXT_SETTINGS = [
  BffSettingKeys.ElasticsearchUsername,
  BffSettingKeys.ElasticsearchPassword,
] as const;

export function assertRequiredBffSettings(): void {
  REQUIRED_URL_SETTINGS.forEach(requiredUrlSetting);
  REQUIRED_TEXT_SETTINGS.forEach(requiredSetting);
  if (isProductionEnvironment()) {
    REQUIRED_PRODUCTION_URL_SETTINGS.forEach(requiredUrlSetting);
    REQUIRED_PRODUCTION_TEXT_SETTINGS.forEach(requiredSetting);
  }
}
