# JavaRAG: Ecossistema RAG Profissional com Spring Boot & LangChain4j

Este projeto é uma Implementação de Referência (POC) de um sistema de **RAG (Retrieval-Augmented Generation)** de alto desempenho, desenvolvido com Java 21, utilizando o poder do **Spring Boot**, **Spring AI** e **LangChain4j**.

O objetivo é demonstrar como construir um pipeline de IA generativa que não apenas responde perguntas, mas o faz com precisão corporativa, citações de fontes, busca híbrida e técnicas avançadas de re-ranqueamento.

---

## 🧠 O que é RAG (Teoria)

RAG é uma técnica que resolve dois grandes problemas dos Modelos de Linguagem (LLMs): **alucinação** e **conhecimento datado**. Em vez de confiar apenas no que o modelo aprendeu durante o treino, o RAG permite que o modelo "leia" documentos específicos antes de responder.

### O Pipeline deste Projeto:
1.  **Ingestão**: Documentos (PDF, DOCX, TXT) são lidos via **Apache Tika**, divididos em pedaços (**Chunks**), convertidos em vetores matemáticos (**Embeddings**) e armazenados em um banco vetorial.
2.  **Recuperação (Retrieval)**: Quando o usuário faz uma pergunta, o sistema realiza uma **Busca Híbrida** (Vetorial + Lexical) para encontrar os trechos mais relevantes.
3.  **Re-ranqueamento (Reranking)**: Os trechos encontrados são reavaliados por um modelo especializado da **Cohere** para garantir que apenas o contexto mais pertinente seja enviado ao LLM.
4.  **Geração**: O LLM (OpenAI ou Anthropic) recebe a pergunta + o contexto curado e gera uma resposta baseada estritamente nos fatos fornecidos, com citações inline `[n]`.

---

## 🚀 Funcionalidades Principais

*   **Busca Híbrida**: Combina a semântica dos vetores (Dense Retrieval) com a precisão das palavras-chave (Lexical Search via SQL `LIKE` e índices).
*   **Reranking com Cohere**: Utiliza modelos de scoring de última geração para filtrar ruído e melhorar a qualidade da resposta final.
*   **Extração Inteligente**: Suporte a múltiplos formatos de arquivos através do Apache Tika.
*   **Gestão de Histórico**: Conversas persistidas no PostgreSQL com suporte a múltiplas sessões por usuário.
*   **Audit Log**: Rastreabilidade total de cada pergunta, resposta, modelo utilizado e tempo de latência.
*   **Configuração Dinâmica**: Interface para gerenciar chaves de API e alternar entre provedores (OpenAI, Anthropic, Cohere) em tempo real.

---

## 🛠️ Arquitetura Técnica

### Por que LangChain4j + Spring AI?
Utilizamos uma abordagem híbrida de frameworks para extrair o melhor de cada um:
*   **Spring AI**: Utilizado pela sua excelente integração com o ecossistema Spring Boot, facilitando a configuração de bancos vetoriais (Starter do PgVector) e integração nativa com o ciclo de vida da aplicação.
*   **LangChain4j**: Utilizado pela sua maturidade em pipelines de RAG avançados, oferecendo ferramentas superiores para splitters de documentos, integração com Cohere Rerank e uma API mais fluida para orquestração de memória e prompts.

### Stack Tecnológica
*   **Backend**: Java 21, Spring Boot 3.2.x.
*   **IA**: Spring AI (1.0.0-M1), LangChain4j (0.35.0).
*   **Frontend**: React, Vite, Tailwind CSS, Lucide Icons.
*   **Banco de Dados**: PostgreSQL com extensão `pgvector`.
*   **Segurança**: Spring Security com JWT (preparado para multi-tenancy).

---

## 📂 Estrutura de Serviços (O que cada um faz?)

*   **`IngestionService`**: Orquestra o pipeline de entrada. Faz o chunking (Recursive Split: 500 tokens / 100 overlap), gera os embeddings via OpenAI e salva simultaneamente no PostgreSQL e no PgVector.
*   **`RetrievalService`**: Responsável pela "busca da verdade". Implementa a lógica de buscar candidatos no banco vetorial e no banco relacional, fundindo os resultados.
*   **`RerankingService`**: O cérebro da relevância. Envia os candidatos para a API da Cohere para obter um score de relevância real em relação à pergunta.
*   **`ChatService`**: O maestro do chat. Gerencia o prompt de sistema (instruções de comportamento), o prompt do usuário, chama o LLM e salva o histórico da conversa.
*   **`TikaService`**: Camada de extração de texto agnóstica de formato.
*   **`ModelService`**: Factory que instancia os modelos corretos baseados nas configurações de API salvas no banco.

---

## ⚙️ Instalação e Configuração

### Pré-requisitos
*   Java 21 instalado.
*   Docker e Docker Compose.
*   Chaves de API (OpenAI, Anthropic ou Cohere).

### Passo a Passo
1.  **Subir o Banco de Dados**:
    ```bash
    docker-compose up -d
    ```
2.  **Executar o Backend**:
    ```bash
    ./mvnw spring-boot:run
    ```
3.  **Executar o Frontend**:
    ```bash
    cd web-ui
    npm install
    npm run dev
    ```
4.  **Configuração Inicial**:
    Acesse a aba **Configuração** na UI e insira suas chaves de API. O sistema salva essas chaves de forma segura no banco de dados.

---

## 📝 Configuração de Prompts
Os prompts estão centralizados no `ChatService.java`. Utilizamos um **System Prompt** rigoroso que instrui a IA a:
1.  Responder apenas com base no contexto fornecido.
2.  Citar fontes usando `[n]`.
3.  Admitir quando não possui a informação (evitando alucinações).
4.  Listar a "Base Consultada" ao final da resposta.

---

## 🚧 Roadmap e Melhorias Futuras

Embora funcional, este projeto é uma fundação. Próximos passos incluem:
*   **Semantic Chunking**: Divisão de documentos baseada em variação de significado, não apenas tamanho de texto.
*   **Observabilidade Avançada**: Integração com LangSmith ou Prometheus para métricas de custo e performance.
*   **OCR Integration**: Suporte para leitura de documentos digitalizados (imagens).
*   **Evaluation Framework**: Implementação de testes automatizados de qualidade de resposta (RAGAS).

---

## 🤝 Contribuições
Sinta-se à vontade para abrir Issues ou enviar Pull Requests. Este projeto foi feito para a comunidade Java explorar as fronteiras da IA Generativa!

**Desenvolvido por Jaime Vicente**