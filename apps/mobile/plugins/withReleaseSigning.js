/**
 * Assina o APK/AAB de release com a chave própria do offly, lida de variáveis
 * de ambiente no momento da compilação (nunca guardadas no repositório):
 *   OFFLY_KEYSTORE_PATH, OFFLY_KEYSTORE_PASSWORD, OFFLY_KEY_ALIAS, OFFLY_KEY_PASSWORD
 * Sem estas variáveis, mantém a chave de depuração (compilações locais).
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// offly-release-signing';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARK)) return cfg;
    src = src.replace(
      /signingConfigs\s*\{/,
      `signingConfigs {
        ${MARK}
        if (System.getenv('OFFLY_KEYSTORE_PATH')) {
            release {
                storeFile file(System.getenv('OFFLY_KEYSTORE_PATH'))
                storePassword System.getenv('OFFLY_KEYSTORE_PASSWORD')
                keyAlias System.getenv('OFFLY_KEY_ALIAS')
                keyPassword System.getenv('OFFLY_KEY_PASSWORD')
            }
        }`,
    );
    src = src.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig System.getenv('OFFLY_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug`,
    );
    cfg.modResults.contents = src;
    return cfg;
  });
};
