# Scrape PDF

Converte páginas web em PDFs com **detecção automática de bot protection**. Executa crawling de links e gera arquivos PDF organizados, contornando automaticamente sistemas de detecção de bot.

## ✨ Características

- 🤖 **Detecção automática de bot protection** - Identifica e contorna proteções automaticamente
- 🔄 **Sistema progressivo de bypass** - Escala as medidas anti-detecção conforme necessário  
- 📱 **Stealth browsing** - Simula comportamento humano (mouse, teclado, scrolling)
- 📁 **Organização automática** - PDFs salvos por domínio no diretório `output/`
- 🎯 **Funciona com qualquer site** - Anthropic, LangChain, e outros sites com proteção

## Instalação

1. **Clone o repositório**
   ```bash
   git clone https://github.com/italogmoura/mirror-PDF && cd mirror-PDF
   ```

2. **Instale o pnpm e dependências**
   ```bash
   npm install -g pnpm && pnpm install
   ```

## Uso

### Comando básico (recomendado)
```bash
pnpm run scrape "https://python.langchain.com/docs/tutorials/"
```

O sistema detecta e contorna automaticamente qualquer proteção de bot. Não é necessário configuração adicional.

### Opções avançadas
```bash
# Dry run (apenas lista URLs, não gera PDFs)
pnpm run scrape "link" -d

# Modo verbose (mais detalhes no output)
pnpm run scrape "link" -v

# Com headers e footers nos PDFs
pnpm run scrape "link" -h

# Modo não-headless (para debugging ou proteções muito fortes)
pnpm run scrape "link" -H
```

## Como Funciona a Detecção Automática

O sistema monitora automaticamente indicadores de bot protection:

- ✅ **Texto placeholder** ("word word word", etc.)
- ✅ **Mensagens de bloqueio** ("Access denied", "Please enable JavaScript")
- ✅ **Conteúdo suspeito** (páginas muito pequenas ou vazias)

Quando detectada proteção, aplica progressivamente:
1. **🤖 Simulação humana** - Movimentos de mouse, cliques, scroll natural
2. **🛡️ Anti-detecção avançada** - Headers customizados, comportamento randomizado
3. **⚠️ Fallback robusto** - Múltiplas tentativas com estratégias diferentes

## Exemplos de Sites Testados

```bash
# LangChain (com bot protection)
pnpm run scrape "https://python.langchain.com/docs/tutorials/"

# Anthropic (sem bot protection)  
pnpm run scrape "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering"

# Outros sites com proteção
pnpm run scrape "https://python.langchain.com/docs/how_to/"
```

## Estrutura de Output

```
output/
├── anthropic/
│   ├── ___urls.txt
│   └── *.pdf
└── langchain/
    ├── ___urls.txt  
    └── *.pdf
```

Os PDFs são automaticamente organizados por domínio, facilitando a navegação e organização do conteúdo baixado.