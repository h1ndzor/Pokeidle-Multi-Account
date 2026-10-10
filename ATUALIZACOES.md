# Atualizações do aplicativo

## Para quem usa

No aplicativo instalado, abra **Configurações → Atualizações do aplicativo**. Ele verifica novas versões ao iniciar; você também pode clicar em **Verificar**. Se houver uma versão nova, clique em **Baixar versão nova**, acompanhe o percentual e depois em **Instalar e reiniciar**.

A instalação fecha as quatro sessões. Cookies pendentes são gravados antes da instalação; a pasta `%APPDATA%\PokeIdleMulti` e os nomes das partitions permanecem os mesmos. O site ainda pode expirar um login. Fechar normalmente o app não instala automaticamente uma atualização baixada.

Ao executar com `npm.cmd start`, a atualização fica desativada: o código de desenvolvimento é atualizado pelo desenvolvedor. Para começar a receber atualizações, é necessário instalar uma primeira versão com o canal configurado.

## Configurar o canal de distribuição

1. Crie ou escolha um repositório **público** no GitHub.
2. Preencha `release-config.json` com `owner` (usuário/organização) e `repo` (nome do repositório). Não coloque URL completa nem credenciais. Enquanto os dois estiverem vazios, o app informa que o canal ainda não está configurado.
3. Rode `npm.cmd ci` e `npm.cmd run dist` no Windows. O comando gera os arquivos localmente; não publica nada.
4. Publique na mesma GitHub Release o instalador `.exe`, seu `.exe.blockmap` e `latest.yml`, gerados juntos em `dist`. Use uma release pública normal, não draft ou prerelease. O manifesto e o instalador precisam pertencer à mesma compilação.
5. Instale essa primeira versão manualmente. Em versões futuras, aumente `version` no `package.json` (por exemplo, `npm.cmd version patch --no-git-tag-version`), compile novamente e publique os três arquivos na nova release.

`electron-builder.config.cjs` gera a configuração interna `app-update.yml` automaticamente. Não é necessário um servidor próprio nem um token GitHub dentro do aplicativo. Não altere o appId, a pasta de dados ou as partitions entre versões.

## Como o código funciona

`src/app-updates.js` controla os estados: verificando, disponível, baixando, pronta e erro. A biblioteca `electron-updater` consulta o canal e verifica o download contra os metadados da release. O processo principal aceita comandos de atualização somente da interface local; as páginas do jogo não recebem essa ponte. A escolha do repositório fica na compilação e não pode ser alterada pelas páginas remotas.

Os testes usam um atualizador simulado para verificar transições, erros, duplicação de comandos e a instalação somente após o download e a gravação de cookies. Execute `npm.cmd test`.

## Antes da distribuição pública

O projeto atual não tem certificado de assinatura Windows configurado. Os hashes de download não substituem a assinatura do editor. Configure e teste a assinatura de código antes de distribuição pública; mantenha a validação de assinatura do atualizador habilitada. O exemplo atual de empacotamento conserva a opção anterior `signAndEditExecutable: false`, que precisa ser revista ao configurar o certificado.

O teste completo exige duas versões publicadas e uma instalação Windows: instalar a primeira, baixar a segunda pelo app, reiniciar e confirmar a versão, as configurações e os logins. Sem um repositório configurado, essa validação real permanece pendente.

Documentação da linha utilizada: https://www.electron.build/v26/docs/features/auto-update/
