import {
  discovery,
  type Configuration,
} from 'openid-client';
import { BffSettingKeys, requiredSetting, requiredUrlSetting } from './settings';

let _config: Configuration | null = null;

export async function getOidcConfig(): Promise<Configuration> {
  if (_config !== null) {
    return _config;
  }

  const authority = requiredUrlSetting(BffSettingKeys.OidcAuthority);
  const clientId = requiredSetting(BffSettingKeys.ClientId);
  const clientSecret = requiredSetting(BffSettingKeys.ClientSecret);

  _config = await discovery(authority, clientId, clientSecret);

  return _config;
}
