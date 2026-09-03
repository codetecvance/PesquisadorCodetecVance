# PesquisadorCodetecVance

Coleta de leads públicos do Google Maps e dashboard local para análise e organização.

## Funcionalidades

- Pesquisa por cidade, bairro e categoria usando Playwright.
- Deduplicação e validação dos resultados coletados.
- Busca de e-mails disponíveis nos sites dos estabelecimentos.
- Dashboard local com filtros, indicadores, gráficos e exportação CSV.
- Controle local de status e anotações dos leads.

## Requisitos

- Node.js 18 ou superior.
- Navegador Chromium instalado pelo Playwright.

## Instalação

```bash
npm install
npx playwright install chromium
```

## Dashboard

```bash
npm start
```

Acesse `http://localhost:3000` no navegador.

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
