# Scrape PDF

Converte páginas web em PDFs. Executa crawling de links e gera arquivos PDF organizados.

## Instalação

1. **Clone o repositório**
   ```bash
   git clone https://github.com/italogmoura/mirror-PDF && cd mirror-PDF
   ```

2. **Instale o pnpm e dependências**
   ```bash
   npm install -g pnpm && pnpm install
   ```

3. **Execute o scraping**
   ```bash
   pnpm run scrape "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering"
   ```

Os PDFs serão salvos no diretório `output/`.

## Exemplos de links:

# 1
https://python.langchain.com/docs/tutorials/

# 2
https://python.langchain.com/docs/how_to/

# 3
https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering