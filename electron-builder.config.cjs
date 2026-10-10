const { build } = require('./package.json');
const release = require('./release-config.json');
const valid = /^[A-Za-z0-9_.-]+$/;
if ((release.owner || release.repo) && (!valid.test(release.owner) || !valid.test(release.repo))) {
  throw new Error('Preencha owner e repo em release-config.json com o repositório público de releases.');
}
module.exports = {
  ...build,
  publish: release.owner && release.repo
    ? [{ provider: 'github', owner: release.owner, repo: release.repo, releaseType: 'release' }]
    : null
};
