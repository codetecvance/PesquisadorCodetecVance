# PesquisadorCodetecVance

Coleta de leads públicos do Google Maps e dashboard local para análise e organização.

Guia completo de instalação e uso: [GUIA_USO.txt](GUIA_USO.txt).

Para baixar uma versão pronta para uso local, acesse os [Releases](https://github.com/codetecvance/PesquisadorCodetecVance/releases).

## Funcionalidades

- Pesquisa por cidade, bairro e categoria usando Playwright.
- Deduplicação e validação dos resultados coletados.
- Busca de e-mails disponíveis nos sites dos estabelecimentos.
- Dashboard local com filtros, indicadores, gráficos e exportação CSV.
- Controle local de status e anotações dos leads.

## Requisitos

- Node.js 20 ou superior.
- Navegador Chromium instalado pelo Playwright.

## Instalação

```bash
npm install
npx playwright install chromium
```

Esta versão não usa tokens, senhas ou chaves de API. O arquivo `exemple.env`
contém apenas um exemplo da configuração opcional de porta. O projeto não
carrega automaticamente arquivos `.env`.

## Dashboard

```bash
npm start
```

Acesse a URL exibida no terminal, normalmente `http://localhost:3000`.
Se a porta 3000 estiver ocupada, o servidor tenta automaticamente a próxima
porta livre e informa a URL correta no terminal.

Para iniciar o servidor em modo de desenvolvimento, use:

```bash
npm run dev
```

O comando inicia o mesmo dashboard local do `npm start`. Se a porta padrão
estiver ocupada, a próxima porta livre será usada automaticamente.

## Coleta

```bash
node leads_geral.js --cidade "São José" --categorias "nutrição,fisioterapia,psicologia" --limite 300
```

Para buscar por bairros:

```bash
node leads_bairro.js --cidade "Salvador" --bairros "Pituba,Stella Maris" --categorias "hamburgueria,pizzaria" --limite 300
```

Para enriquecer os dados existentes com e-mails encontrados nos sites:

```bash
npm run emails
```

## Privacidade

Os arquivos com leads, telefones, e-mails, status e backups são dados locais e estão bloqueados pelo `.gitignore`. Eles não devem ser publicados neste repositório.

Use os dados coletados de forma responsável, observando a LGPD, os termos dos
serviços consultados e as regras aplicáveis ao contato comercial.
