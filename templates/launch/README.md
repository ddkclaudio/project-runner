# Launchfile

O Painel usa **apenas** o ficheiro `Launchfile` na raiz do repositório clonado  
(`{pastaApps}/{orgSlug}/{appFolder}/repositories/{repo}/`).

Se o ficheiro não existir, no primeiro **Start** o agente DeepSeek (token em Perfil) explora o projecto com tools e cria o `Launchfile`.

## Campos

| Campo | Obrigatório | Descrição |
| --- | --- | --- |
| `version` | sim | `launch/v1` |
| `name` | sim | Nome da app |
| `runtime` | sim | `node` \| `python` \| `rust` \| `binary` \| `other` |
| `kind` | sim | `site` \| `api` \| `desktop` \| `cli` |
| `port` | não | Porta local (ex. 3000) |
| `url` | não | URL Abrir no browser |
| `cwd` | não | Pasta de trabalho relativa (default `.`) |
| `commands.install` | não | Instalar dependências |
| `commands.start` | **sim** | Comando de arranque |
| `env` | não | Variáveis (sem segredos) |

## Exemplo

Ver [`Launchfile`](./Launchfile) nesta pasta.
