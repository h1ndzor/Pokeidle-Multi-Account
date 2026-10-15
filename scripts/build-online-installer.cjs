const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const { owner, repo } = require('../release-config.json');
if (process.platform !== 'win32') throw new Error('Compile o instalador no Windows.');
if (![owner, repo].every(value => typeof value === 'string' && /^[A-Za-z0-9_.-]+$/.test(value))) throw new Error('Repositório inválido.');
const compiler = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pokeidle-bootstrap-build-'));
try {
  const source = fs.readFileSync(path.join(root, 'installer', 'OnlineInstaller.cs'), 'utf8').replace('__REPOSITORY__', `${owner}/${repo}`);
  const input = path.join(temporary, 'OnlineInstaller.cs');
  fs.writeFileSync(input, source);
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  const output = path.join(root, 'dist', 'PokeIdle-Multi-Install.exe');
  execFileSync(compiler, ['/nologo', '/target:winexe', '/platform:anycpu', '/optimize+', `/out:${output}`, '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.Net.Http.dll', '/reference:System.Web.Extensions.dll', input], { stdio: 'inherit' });
  console.log(`Instalador online gerado: ${output} (${fs.statSync(output).size} bytes)`);
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
