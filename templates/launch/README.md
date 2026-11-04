# Launchfile

O Project Runner usa **apenas** o ficheiro `Launchfile` na raiz do repositório clonado  
(`{pastaApps}/{orgSlug}/{appFolder}/repositories/{repo}/`).

Se o ficheiro não existir, no primeiro **Start** o agente DeepSeek (token em Perfil) explora o projecto com tools e cria o `Launchfile`.

## Campos

| Campo | Obrigatório | Descrição |
| --- | --- | --- |
| `version` | sim | `launch/v1` |
| `name` | sim | Nome da app |
| `runtime` | sim | `node` \| `python` \| `rust` \| `binary` \| `other` |
| `kind` | sim | `site` \| `api` \| `desktop` \| `cli` |
| `commands.pre-start` | não | Passos que terminam (instalar dependências) |
| `commands.start` | **sim** | Comando de arranque. O último fica vivo |
| `env` | não | Variáveis (sem segredos). `PORT` é a porta; se faltar, o Project Runner grava `3000` |
| `env.PORT` | sim | Porta local. A URL de abrir é `http://localhost` mais este número, para `site` e `api` |

## Exemplo

Ver [`Launchfile`](./Launchfile) nesta pasta.
