# Apps só com binário (release GitHub)

Não é obrigatório manifesto. O Project Runner:

1. Descarrega o asset da release para a pasta da app, **ou** clona o repo.
2. Procura executáveis (`.exe`, `.bat`, `.cmd` no Windows; AppImage / binários no Linux; `.app` no macOS).
3. Preferência: raiz da pasta → depois subpastas (mais perto da raiz primeiro).
4. Se houver vários, a UI pede escolha e grava `selected_executable.txt`.

## Forçar um comando custom

Na tela **Executável**, use **Criar painel.launch.json** (ou copie `painel.launch.json` desta pasta) com por exemplo:

```json
{
  "version": 1,
  "start": "./MeuJogo.exe"
}
```
