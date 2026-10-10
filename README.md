# PokeIdle Multi — primeiro MVP

Um aplicativo Electron com quatro contas independentes de https://pokeidle.io.

## 1. Preparar e executar

Instale o Node.js LTS com npm a partir de https://nodejs.org. Abra esta pasta no VS Code e use **Terminal → Novo Terminal**. O terminal precisa estar na pasta que contém `package.json`.

```powershell
npm.cmd ci
npm.cmd start
```

`ci` baixa o Electron e o empacotador nas versões registradas. O primeiro download pode demorar. `start` executa o arquivo indicado em `main` no `package.json`. Usamos `npm.cmd` no Windows para evitar problemas com a política de execução de scripts do PowerShell.

O projeto inclui `package-lock.json`: mantenha esse arquivo. Ele registra as versões exatas das dependências transitivas. Ao adicionar uma dependência com `npm.cmd install`, esse registro é atualizado.

## 2. Usar

- O app abre em grid: contas 1 e 2 em cima; 3 e 4 embaixo.
- Faça login manualmente em cada quadrante com a conta correspondente.
- Clique em **Conta 1**, **Conta 2**, **Conta 3** ou **Conta 4** no topo para ampliar essa conta. Clicar dentro do jogo interage normalmente com o jogo.
- Clique em **Grid** para ver as quatro páginas novamente.
- O botão **⌃** no canto superior direito esconde os controles e libera toda a área para o jogo. O botão flutuante **☰** mostra os controles novamente, sem recarregar as contas. Ao reabrir o app, os controles começam visíveis.
- O cabeçalho mede 44 pixels. Passe o mouse sobre o botão da conta para consultar seu estado.
- Cada conta tem `−`, percentual de zoom, `+` e `↻`. Clicar no percentual restaura 100%. Os limites são 50% e 200%.
- `↻` recarrega somente a conta correspondente.
- Para atualizações do jogo: clique dentro da conta e pressione **Ctrl+F5**, ou use **Shift+clique em ↻**, para recarregar ignorando o cache HTTP. **F5/Ctrl+R** fazem recarga normal; **Ctrl+Shift+R** também ignora o cache. O botão direito dentro do jogo oferece essas opções mesmo com o cabeçalho oculto. No cabeçalho, o atalho atua na conta ampliada ou na última conta ativa (inicialmente a Conta 1).
- Se o site bloquear uma navegação/recarga por alterações não salvas, o app pede confirmação. Recargas solicitadas diretamente pelos controles do app prosseguem. A recarga não apaga cookies, localStorage ou IndexedDB, mas alterações ainda não salvas pela página podem ser perdidas. Ignorar cache HTTP não limpa Service Workers nem garante corrigir falhas do servidor.
- Clique em **Configurações** para escolher o navegador dos links de cada conta e editar o endereço do jogo. **Abrir nas 4 contas** navega todas as contas para esse endereço HTTPS e o salva para a próxima execução.

### Navegador dos links

Cada conta pode usar **Padrão do Windows**, **Google Chrome**, **Microsoft Edge**, **Mozilla Firefox** ou **No aplicativo**. O padrão inicial é o navegador padrão do Windows. Navegadores específicos são detectados nas pastas usuais de instalação; opções não encontradas ficam desativadas. Após instalar um navegador, reinicie o app para detectá-lo. Instalações portáteis e seleção de perfis específicos ainda não são suportadas.

As escolhas são salvas automaticamente e há um botão para aplicar a escolha da Conta 1 a todas. Isso vale para links que pedem nova aba/janela e links diretos para `twitch.tv` na página principal. Outros links que navegam na mesma aba permanecem no jogo para preservar os fluxos de navegação e login. Você também pode clicar com o botão direito em um link e escolher **Abrir link conforme Configurações**.

Ao abrir externamente, o jogo permanece na sua página. O navegador usa seu próprio perfil e login: cookies do jogo não são copiados para ele. A opção **No aplicativo** mantém o comportamento antigo de substituir a página da conta. Links de autenticação que dependem da comunicação com a janela original podem não funcionar com abertura externa. O crédito do bônus de Twitch continua sendo responsabilidade do jogo e não foi validado por estes testes.

`src/browser-links.js` detecta navegadores, valida URLs HTTP/HTTPS e abre o destino. Para o padrão do Windows, usa `shell.openExternal`; para navegadores específicos, inicia o executável conhecido com a URL como argumento separado, sem comandos de terminal. `main.js` escolhe a preferência da conta que originou o link. `renderer.js` apresenta as opções e envia a alteração pelo IPC. Referência: https://www.electronjs.org/docs/latest/api/shell

Execute `npm.cmd test` para verificar validação de links, detecção, encaminhamento e falhas de abertura. Também foram testados no Electron o painel em janela de 1000 pixels, preferências independentes, persistência após reiniciar, aplicação a todas e popup preservando a página original. Nesses testes, a abertura externa foi simulada; a reprodução e os bônus da Twitch precisam ser conferidos manualmente.

As contas ocultas continuam carregadas e com limitação de timers em segundo plano desativada. Isso não garante que o servidor do jogo mantenha uma conexão para sempre, nem mantém o jogo executando com o computador suspenso ou o programa fechado.

## 3. Entender cada arquivo

### `package.json`: a ficha do projeto

Define nome, versão, ponto de entrada e atalhos. `scripts.start` inicia o Electron; `scripts.dist` gera um instalador Windows. `devDependencies` contém as ferramentas necessárias para desenvolver e empacotar.

### `src/main.js`: o coordenador

Executa no **processo principal**, que pode criar janelas e acessar arquivos. `app.whenReady()` espera o Electron ficar pronto. `BrowserWindow` cria a janela com a interface de controle. `Array.from({ length: 4 }, ...)` cria quatro `WebContentsView`, cada um com sua página.

O índice `i` começa em zero. Por isso usamos `i + 1` nos nomes visíveis e nas partitions:

```javascript
partition: `persist:pokeidle-account-${i + 1}`
```

`partition` é o compartimento de armazenamento da sessão. Nomes diferentes separam cookies e armazenamento local. O prefixo `persist:` salva esses dados no disco. Isso permite usar quatro logins no mesmo endereço sem compartilhar cookies.

`selected` guarda qual conta está ampliada: `null` significa grid; `0`, `1`, `2` e `3` representam as contas. `layout()` calcula os retângulos disponíveis e chama `setBounds()`. O cabeçalho reserva 44 pixels; com as configurações abertas, 282 pixels; oculto, zero. O botão flutuante usa uma pequena view local acima das quatro views do jogo, pois elementos HTML da interface não podem se sobrepor às páginas nativas. Essa view só pode consultar e alternar a visibilidade dos controles. Ao redimensionar a janela ou alternar o painel, o layout é recalculado.

`setVisible(false)` oculta as outras views sem destruí-las. As páginas só são fechadas quando a janela termina. `backgroundThrottling: false` desativa a redução de atividade aplicada pelo Electron às páginas em segundo plano; quatro páginas ativas podem consumir bastante memória e CPU.

Eventos como `did-finish-load` atualizam os indicadores. `setZoomFactor(1)` corresponde a 100%; `0.8`, a 80%. Como as sessões são separadas, o zoom do mesmo site pode ser diferente em cada conta.

### `src/preload.js`: a ponte

A interface não recebe acesso direto ao Node.js. `contextBridge` expõe somente dois recursos: enviar comandos e receber atualizações. `ipcRenderer.invoke()` envia um pedido ao processo principal; `ipcMain.handle()` o recebe e responde. Essa troca é chamada IPC.

As páginas remotas do jogo não recebem esse preload. O processo principal valida a origem dos pedidos, o número da conta e os valores de zoom.

### `src/renderer.js`: os controles

Roda na página local da interface. `document.querySelector()` encontra elementos HTML. `onclick` registra a função executada ao clicar. `async` e `await` permitem esperar a resposta de um comando sem bloquear a interface. `render()` atualiza os percentuais, o estado das contas e o destaque da conta ampliada.

### `src/index.html` e `src/styles.css`: estrutura e aparência

HTML define os elementos; CSS controla cores, espaçamento e os quatro grupos de botões. As páginas do jogo são views nativas posicionadas pelo processo principal, não `iframes` dentro do HTML. Se alterar a altura do cabeçalho, atualize também a constante `top` de `layout()`.

## 4. Onde ficam os logins

Os dados ficam em `%APPDATA%\PokeIdleMulti`, separados das pastas de código e instalação. O Electron administra as partitions persistentes. `preferences.json` guarda endereço, zoom e navegador dos links por conta; o app não cria um arquivo de senhas.

Fechar e abrir o app mantém cookies e armazenamento local. A duração real do login depende também da expiração definida pelo site; cookies temporários de sessão podem exigir novo login. Não apague a pasta de dados se quiser manter as contas. Evite renomear as partitions após começar a usar o programa.

## 5. Empacotar para Windows

No Windows, depois de instalar as dependências:

```powershell
npm.cmd run pack
npm.cmd run dist
```

`pack` gera a pasta executável `dist\win-unpacked`. `dist` gera o instalador NSIS `.exe` em `dist`. O alvo é Windows x64. O instalador permite escolher o diretório e não requer instalação para todos os usuários. O pacote inclui o Electron; quem o instalar não precisa de Node.js.

Este MVP não tem certificado de assinatura: o Windows pode exibir aviso de aplicativo desconhecido. O fluxo de atualização foi adicionado em **Configurações → Atualizações do aplicativo**. Para ativá-lo nas versões instaladas, configure um repositório público conforme [ATUALIZACOES.md](ATUALIZACOES.md). O modo de desenvolvimento não baixa nem instala atualizações. A assinatura e o teste real entre duas versões publicadas ainda precisam ser concluídos antes da distribuição pública.

## 6. Verificação manual

1. Entre com contas diferentes nas quatro páginas. Confirme que trocar uma não troca as outras.
2. Amplie cada conta e volte ao grid. A navegação e o estado das páginas devem permanecer.
3. Coloque a conta 1 em 80% e a conta 2 em 120%. Confirme que as outras continuam em 100%.
4. Recarregue a conta 2 e confira que as demais não recarregam.
5. Redimensione e maximize a janela; as páginas devem preencher a área abaixo dos controles.
6. Feche e abra novamente; confira os logins e percentuais de zoom.
7. Desconecte a rede, recarregue uma conta e confira a mensagem de erro. Reconecte e tente novamente.
8. Repita os passos no aplicativo de `dist\win-unpacked` e depois no instalado.

## Limites desta versão

O app permite uso manual, sem automatizar ações no jogo. Links seguem as escolhas em Configurações. Logins que dependem de uma janela auxiliar e comunicação com a janela original podem precisar de implementação adicional. Solicitações de câmera, microfone e outras permissões são negadas neste MVP.

A sintaxe dos três arquivos JavaScript foi verificada com `node --check`. Também foram executados testes no Electron 44.7.0 com páginas locais e dados descartáveis: quatro views, cookies e localStorage separados, foco/grid, zoom independente, timer em página oculta e persistência de cookies e zoom após reiniciar. Esses testes não substituem a verificação de login no PokeIdle com suas contas reais.

O instalador NSIS x64 foi gerado com sucesso em uma cópia temporária. A cópia do binário para a pasta de entrega foi negada pelo ambiente; por isso esta entrega contém o código e a configuração para gerá-lo com `npm.cmd run dist`. A instalação interativa do pacote não foi testada.

A auditoria npm apontou oito avisos moderados na cadeia de dependências das ferramentas de empacotamento, ligados a `sprintf-js`. Essas ferramentas são dependências de desenvolvimento e não são incluídas como bibliotecas de execução do aplicativo. A revisão dessas dependências fica pendente antes de distribuição pública.

## Referências

- WebContentsView: https://www.electronjs.org/docs/latest/api/web-contents-view
- Sessões e partitions: https://www.electronjs.org/docs/latest/api/session
- Controle de páginas e zoom: https://www.electronjs.org/docs/latest/api/web-contents
- Empacotamento: https://www.electron.build/
