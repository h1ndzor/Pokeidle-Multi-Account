# PokeIdle Multi

Aplicativo para Windows que reúne **quatro contas independentes do [PokeIdle](https://pokeidle.io)** na mesma janela, com login, zoom e áudio separados.

## Instalar

Baixe o [instalador online](https://github.com/h1ndzor/Pokeidle-Multi-Account/releases/latest/download/PokeIdle-Multi-Install.exe), execute e clique em **Baixar e instalar**. Ele busca a última versão estável. Depois abra o app e faça login em cada conta que deseja usar.

Disponível para Windows x64. Não precisa de Node.js para usar. O instalador ainda não possui assinatura digital.

O **instalador online** `PokeIdle-Multi-Install.exe` está disponível nas releases. Ao clicar em **Baixar e instalar**, ele busca a última versão estável no GitHub, mostra o progresso, verifica a integridade do download e abre a instalação normal. Você pode cancelar o download. Requer internet e .NET Framework 4.5 ou superior (incluído nas versões modernas do Windows). O arquivo inicial é pequeno, mas baixa o instalador completo; o tamanho do app instalado não muda.

## Como usar

- **Contas e grid:** clique no nome de uma conta para ampliá-la. Clique em **Grid** para ver as quatro telas novamente. As outras contas continuam carregadas em segundo plano.
- **Zoom:** use **−** e **+** de cada conta. Clique no percentual para restaurar 100%.
- **Áudio:** use **🔊 / 🔇** para silenciar ou ativar o som de cada conta. A escolha fica salva.
- **Recarregar:** clique em **↻** para atualizar apenas aquela conta. Dentro do jogo, **F5** também recarrega. Para atualizações do jogo, use **Ctrl+F5** ou **Shift+clique em ↻** para recarregar ignorando o cache.
- **Esconder a barra:** clique em **⌃** no canto superior direito para ganhar espaço. O botão flutuante **☰** mostra os controles novamente.
- **Links e lives:** em **Configurações**, escolha o navegador de cada conta: padrão do Windows, Chrome, Edge, Firefox ou **No aplicativo**. Isso vale para links de nova aba/janela e links diretos da Twitch. O navegador externo usa seus próprios logins; **No aplicativo** substitui a página daquela conta pelo link.
- **Votação nas contas 2, 3 e 4:** links de jogos do TopIdle abrem em um popup com a sessão da conta correspondente, preservando o `playerIdentifier` enviado pelo jogo. O jogo permanece aberto. Faça login e vote manualmente; o popup fecha se o site solicitar, ou pelo **X**. O login Google pode bloquear navegadores embutidos; o login real com Google/Discord ainda precisa ser validado.
- **Lives da conta principal (Conta 1):** escolha **Padrão do Windows** ou um navegador instalado nas Configurações dessa conta. Os links da Twitch abrem nesse navegador.
- **Endereço do jogo:** em **Configurações**, edite o endereço e clique em **Abrir nas 4 contas** para navegar todas elas para a página escolhida.

Os logins são mantidos entre aberturas, enquanto forem válidos no site. Dados e preferências ficam em `%APPDATA%\PokeIdleMulti`; preserve essa pasta para manter as contas. Para continuar jogando, deixe o app aberto e o computador sem suspensão.

## Atualizar o aplicativo

Abra **Configurações → Atualizações do aplicativo → Verificar**. Quando houver uma versão nova, clique em **Baixar versão nova** e depois em **Instalar e reiniciar**. A instalação fecha as quatro sessões e preserva os dados locais.

## Executar o código

Com Node.js LTS e npm instalados, abra um terminal na pasta do projeto:

```powershell
npm.cmd ci
npm.cmd start
```

Use `npm.cmd test` para executar os testes e `npm.cmd run dist` para gerar o instalador Windows na pasta `dist/`. Detalhes de publicação estão em [ATUALIZACOES.md](ATUALIZACOES.md).

Para compilar o instalador online no Windows, use `npm.cmd run dist:online`. O resultado fica em `dist/PokeIdle-Multi-Install.exe`. Instruções de manutenção e testes estão em [installer/README.md](installer/README.md).

Este README será atualizado junto com as novas funcionalidades.
