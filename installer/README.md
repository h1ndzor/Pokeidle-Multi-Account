# Instalador online

Programa pequeno em C# / Windows Forms, compilado com o .NET Framework do Windows. Não incorpora Electron ou Node.js. Usa `release-config.json` durante a compilação e consulta a release estável mais recente do repositório público durante o uso.

## Gerar

Execute `npm.cmd run dist:online` no Windows x64 com o compilador .NET Framework em `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe`. Saída: `dist/PokeIdle-Multi-Install.exe`. O binário não é assinado digitalmente.

## Fluxo

1. O usuário clica em Baixar e instalar.
2. Consulta `/releases/latest` na API pública do GitHub, sem credenciais.
3. Seleciona um único asset `PokeIdle-Multi-Setup-X.Y.Z.exe`, com tamanho e digest SHA-256 válidos. Releases de teste e rascunhos são rejeitados.
4. Baixa por HTTPS para uma pasta temporária exclusiva. O endereço inicial precisa pertencer às releases do repositório configurado; redirecionamentos HTTPS do GitHub levam ao armazenamento dos assets.
5. Confere tamanho e SHA-256 antes de abrir o instalador normal, sem instalação silenciosa.
6. Aguarda o instalador terminar e tenta remover a pasta temporária. Cancelamentos e falhas também limpam o download; arquivos em uso podem permanecer até a limpeza de temporários do Windows.

A verificação detecta arquivos incompletos ou diferentes do digest publicado. Ela confia na conta/release do GitHub e não substitui assinatura digital. Falta de digest, limite da API ou falhas de rede impedem a instalação e permitem tentar novamente. O download pode ser cancelado e tem limite total de 30 minutos pela interface.

## Testar sem instalar

- `PokeIdle-Multi-Install.exe --self-test`: casos de hash/tamanho incorretos, URL externa, digest ausente, release de teste e assets ausentes/duplicados.
- `PokeIdle-Multi-Install.exe --verify-only`: baixa e verifica a última release real, remove o arquivo e sai **sem executar o instalador**.

Como é um executável gráfico, use `Start-Process -Wait -PassThru` no PowerShell para aguardar a saída. Código 0 indica sucesso; 1 indica falha nesses modos. A instalação interativa deve ser validada separadamente.

## Publicação (somente quando solicitada)

Mantenha o instalador completo, `.blockmap` e `latest.yml` em cada release, como hoje. Acrescente `PokeIdle-Multi-Install.exe` aos assets e atualize o README para anunciar sua disponibilidade. O bootstrap não precisa ser recompilado quando apenas a versão do app muda, mas deve acompanhar as releases para manter um link `/releases/latest/download/PokeIdle-Multi-Install.exe` válido. Não substitua o instalador completo nem altere `latest.yml` para apontar ao bootstrap.

Se mudar o repositório ou o padrão de nome dos assets, ajuste e recompile o bootstrap. Os comandos de compilação não publicam nada.
