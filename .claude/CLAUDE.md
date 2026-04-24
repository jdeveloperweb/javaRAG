# Especificação do Projeto

## POC de RAG em Java com LangChain4j

### Objetivo

Construir uma prova de conceito de um sistema RAG em **Java + LangChain4j**, com:

* API de chat para perguntas e respostas sobre o acervo indexado
* APIs de ingestão e administração de conteúdo
* recuperação robusta com **busca híbrida + reranking + filtros por metadados**
* respostas com **citações rastreáveis**
* camadas de **segurança, permissões e auditoria**
* estrutura pronta para **avaliação offline e online**

### Princípios

1. **Grounded answers first**: responder com base nas fontes recuperadas.
2. **Recuperação antes de geração**: a qualidade do sistema depende mais da ingestão e retrieval do que do prompt isoladamente.
3. **Citações obrigatórias**: toda resposta factual derivada da base deve apontar a origem.
4. **Fail closed**: sem contexto suficiente, a resposta deve admitir limitação em vez de inventar.
5. **Observabilidade ponta a ponta**: tudo precisa ser mensurável.
6. **Separação clara de responsabilidades**: ingestão, indexação, retrieval, reranking, montagem de contexto, geração e avaliação.

---

## 1. Escopo

### Incluído na POC

* ingestão de documentos textuais e arquivos comuns
* extração de texto e normalização
* chunking com estratégia recursiva e enriquecimento por metadados
* geração de embeddings
* indexação em armazenamento vetorial
* indexação lexical para busca híbrida
* recuperação híbrida com fusão de resultados
* reranking antes da geração final
* prompt de resposta com contexto positivo e negativo
* resposta com citações por trecho
* filtros por tenant, coleção, documento, tipo e permissões
* avaliação de qualidade do retrieval e da resposta
* autenticação, autorização e trilha de auditoria

### Fora do escopo inicial

* OCR pesado e pipelines complexos de digitalização
* ingestão multimodal avançada
* edição colaborativa de documentos
* workflow completo de aprovação editorial
* fine-tuning de modelos

---

## 2. Casos de uso

### Chat

* Usuário faz pergunta em linguagem natural.
* Sistema recupera trechos relevantes.
* Sistema reranqueia os trechos.
* LLM responde somente com base no contexto permitido.
* Resposta retorna texto + citações + metadados das fontes.

### Ingestão

* Usuário autorizado envia documento ou texto bruto.
* Sistema extrai texto, normaliza, divide em chunks, gera embeddings e indexa.
* Metadados e ACLs são persistidos.
* Documento fica disponível para busca e chat.

### Administração

* listar documentos, status de indexação e falhas
* reprocessar documento
* excluir documento e seus chunks
* consultar histórico de ingestão

---

## 3. Arquitetura lógica

### Componentes

1. **API Gateway / REST API**
2. **Serviço de Chat**
3. **Serviço de Ingestão**
4. **Serviço de Indexação**
5. **Serviço de Retrieval**
6. **Serviço de Reranking**
7. **Serviço de Autorização/ACL**
8. **Banco transacional de metadados**
9. **Motor vetorial**
10. **Motor lexical/BM25**
11. **Observabilidade e avaliação**

### Fluxo de alto nível

**Ingestão**: upload -> parsing -> limpeza -> chunking -> metadados -> embeddings -> indexação vetorial + lexical -> pronto

**Consulta**: pergunta -> autenticação -> expansão/opcional normalização da query -> retrieval híbrido -> filtros ACL/metadados -> reranking -> montagem de contexto -> geração -> citações -> logs/métricas

---

## 4. Stack sugerida

### Backend

* Java 21
* Spring Boot 3
* LangChain4j
* Maven ou Gradle

### Persistência

* PostgreSQL para metadados transacionais
* Elasticsearch ou OpenSearch para busca híbrida, se quisermos unificar sparse + dense na POC

  * alternativa: PostgreSQL + pgvector para vetorial e OpenSearch/Elasticsearch para lexical

### Modelos

* **LLM de resposta**: configurável por provider
* **Embedding model**: separado do LLM de chat
* **Reranker**: modelo cross-encoder ou API externa dedicada

### Observabilidade

* OpenTelemetry
* Micrometer + Prometheus
* Grafana
* logs estruturados em JSON

---

## 5. Modelo de dados

### Entidades principais

#### Document

* document_id
* tenant_id
* collection_id
* title
* source_type
* source_uri
* language
* checksum
* version
* status
* created_at
* updated_at
* created_by
* visibility

#### Chunk

* chunk_id
* document_id
* tenant_id
* collection_id
* ordinal
* text
* token_count
* char_count
* embedding_model
* embedding_dimension
* content_hash
* parent_section
* page_number
* start_offset
* end_offset

#### ChunkMetadata

* chunk_id
* document_title
* section_title
* tags
* acl_principals
* acl_groups
* custom_attributes (jsonb)

#### IngestionJob

* job_id
* tenant_id
* status
* requested_by
* submitted_at
* started_at
* finished_at
* error_message
* stats_json

#### ChatSession

* session_id
* tenant_id
* user_id
* created_at

#### ChatMessage

* message_id
* session_id
* role
* content
* created_at
* trace_id

---

## 6. Estratégia de ingestão

### Tipos de entrada

* texto bruto
* PDF com texto extraível
* Markdown
* HTML simplificado
* DOCX em fase posterior, se necessário

### Pipeline de ingestão

1. validar arquivo, tipo e permissões
2. extrair texto
3. normalizar conteúdo
4. detectar idioma
5. separar estrutura lógica (título, seções, subtítulos, páginas)
6. chunking
7. enriquecimento com metadados
8. embeddings
9. indexação lexical
10. indexação vetorial
11. validação pós-indexação

### Normalização

* remover cabeçalhos/rodapés repetitivos quando detectáveis
* colapsar espaços excessivos
* preservar listas e títulos
* manter identificadores úteis como códigos, nomes, tabelas textuais e datas
* registrar texto original e texto normalizado quando necessário

### Regras de qualidade da ingestão

* chunks não podem misturar documentos diferentes
* chunks devem preservar coerência semântica mínima
* chunks devem carregar metadados suficientes para citação
* conteúdo vazio, duplicado ou irrelevante deve ser descartado

---

## 7. Chunking

### Estratégia base

Usar **chunking recursivo por estrutura**, priorizando:

1. seção
2. subtítulo
3. parágrafo
4. sentença

### Tamanho inicial sugerido

* alvo: **300 a 700 tokens por chunk**
* overlap: **50 a 120 tokens**

### Regras adicionais

* não quebrar tabela textual no meio, quando evitável
* não quebrar listas enumeradas que dependem de continuidade
* chunk pequeno demais deve ser unido ao vizinho se mantiver coerência
* chunk grande demais deve ser dividido em fronteiras semânticas

### Metadados obrigatórios por chunk

* document_id
* tenant_id
* collection_id
* document_title
* section_title
* ordinal
* page_number ou marcador equivalente
* source_uri
* acl
* version

### Estratégias futuras

* chunking contextual com títulos anexados ao chunk
* parent-child retrieval
* summary chunk + detail chunk

---

## 8. Embeddings

### Requisitos

* embeddings devem ser gerados por modelo consistente por índice
* toda troca de modelo exige versionamento e reindexação controlada
* registrar modelo, dimensão e data da vetorização

### Boas práticas

* usar o mesmo idioma ou modelo multilíngue compatível com o corpus
* avaliar embeddings por recall@k em conjunto de perguntas reais
* evitar misturar embeddings de modelos distintos no mesmo espaço lógico

---

## 9. Busca híbrida

### Objetivo

Combinar:

* **dense retrieval** para semântica
* **sparse/lexical retrieval** para termos exatos, códigos, siglas, nomes próprios e filtros textuais

### Estratégia recomendada

1. executar busca vetorial
2. executar busca lexical BM25
3. fundir resultados com **RRF (Reciprocal Rank Fusion)** ou estratégia equivalente
4. remover duplicidades por chunk_id
5. aplicar corte para reranking

### Parâmetros iniciais da POC

* dense topK inicial: 30
* sparse topK inicial: 30
* fused topK: 20
* rerank topN final: 6 a 10

### Quando sparse deve pesar mais

* perguntas com IDs, números, nomes exatos, cláusulas, códigos e siglas

### Quando dense deve pesar mais

* perguntas semânticas, reformulações, sinônimos, descrições indiretas

---

## 10. Reranker

### Objetivo

Ordenar os candidatos recuperados pela real relevância para a pergunta do usuário.

### Requisitos

* receber query + lista de chunks candidatos
* retornar score de relevância por chunk
* permitir threshold mínimo

### Política sugerida

* rerank sempre que houver mais de 3 chunks candidatos
* limitar o contexto final a orçamento de tokens
* priorizar diversidade de fonte quando houver empate forte

### Observação de arquitetura

O **reranker deve ser componente explícito**, não um efeito colateral do prompt.

---

## 11. Filtros e metadados

### Filtros obrigatórios

* tenant_id
* collection_id
* document_id
* language
* source_type
* version
* intervalos de data
* tags
* ACL do usuário

### Regra crítica

**Filtros de segurança devem ser aplicados antes da geração e preferencialmente antes ou durante a retrieval.**

### Exemplo de uso

* usuário pode consultar apenas documentos da coleção X
* gestor pode consultar coleção X e Y
* admin pode consultar tudo no tenant

---

## 12. Citações

### Objetivo

Toda resposta baseada na base deve retornar evidência rastreável.

### Formato mínimo por citação

* citation_id
* document_id
* document_title
* chunk_id
* trecho utilizado
* page_number ou seção
* source_uri

### Regras

* a resposta textual deve referenciar as citações inline, por exemplo `[1]`, `[2]`
* a API deve retornar as citações estruturadas separadamente
* não citar chunk não utilizado no contexto final
* se a resposta combinar múltiplas fontes, isso deve ficar explícito

---

## 13. Prompting e engenharia de prompt

### Objetivo do prompt

Garantir que o modelo:

* responda apenas com base no contexto permitido
* reconheça insuficiência de evidência
* cite corretamente as fontes
* não exponha conteúdo fora da autorização do usuário

### Estrutura recomendada do prompt de sistema

#### Papel

Você é um assistente de perguntas e respostas sobre um conjunto privado de documentos. Sua tarefa é responder exclusivamente com base no contexto recuperado e autorizado para este usuário.

#### Objetivos positivos

* responder de forma objetiva, correta e verificável
* usar prioritariamente os trechos recuperados
* citar as fontes usadas
* informar quando a evidência for insuficiente ou conflitante
* distinguir fato presente no contexto de inferência razoável

#### Contexto negativo

* não invente fatos ausentes no contexto
* não use conhecimento externo como se fosse fato do acervo
* não oculte incerteza
* não misture documentos diferentes como se fossem a mesma fonte
* não responda com dados que não estejam autorizados para o usuário
* não afirme que viu documentos ou trechos que não foram recuperados
* não cite fonte inexistente
* não extrapole política, prazo, regra ou número sem evidência textual

#### Regras de decisão

1. Se o contexto for suficiente, responda usando as evidências.
2. Se o contexto for parcialmente suficiente, responda parcialmente e explicite a limitação.
3. Se o contexto for insuficiente, diga claramente que não há evidência suficiente.
4. Se houver conflito entre fontes, aponte o conflito e cite ambas.
5. Nunca apresente hipótese como fato.

#### Formato de saída esperado do modelo

* resposta principal em linguagem natural
* citações inline referenciando os chunks
* campo opcional de limitações

### Template de prompt de sistema sugerido

```text
Você é um assistente de RAG corporativo.

Responda APENAS com base no CONTEXTO AUTORIZADO fornecido.

OBJETIVO:
- fornecer resposta correta, objetiva e verificável
- citar as evidências utilizadas
- indicar limitação quando faltarem dados

NÃO FAÇA:
- não invente
- não complete lacunas com conhecimento externo
- não cite fonte não presente no contexto
- não exponha conteúdo não autorizado
- não trate inferência como fato

POLÍTICA DE RESPOSTA:
- Use apenas os fatos que aparecem no contexto.
- Se houver evidência insuficiente, diga: "Não encontrei evidência suficiente no material recuperado para responder com segurança."
- Se houver conflito entre fontes, descreva o conflito.
- Sempre associe afirmações factuais a citações inline.

FORMATO:
- Resposta em português do Brasil.
- Seja objetivo.
- Ao final, inclua uma seção curta chamada "Base consultada" com os IDs das citações utilizadas.
```

### Template de prompt de usuário interno

```text
PERGUNTA DO USUÁRIO:
{{user_question}}

CONTEXTO AUTORIZADO:
{{retrieved_context}}

INSTRUÇÕES DE CITAÇÃO:
- Use apenas as citações disponíveis no contexto.
- Cada afirmação factual relevante deve apontar para uma ou mais citações.
```

---

## 14. Orquestração da resposta

### Pipeline online

1. autenticar usuário
2. resolver tenant, coleções e ACLs
3. normalizar pergunta
4. aplicar filtros de metadados e segurança
5. dense retrieval
6. sparse retrieval
7. fusão híbrida
8. reranking
9. seleção final por relevância + orçamento de tokens
10. montar contexto com metadados de citação
11. chamar LLM
12. validar citações de saída
13. retornar resposta estruturada

### Validações finais antes de responder

* há pelo menos 1 chunk válido?
* as citações emitidas existem no contexto?
* o texto não menciona fonte ausente?
* o contexto excedeu orçamento de tokens?

---

## 15. APIs

### 15.1 API de chat

#### POST /api/v1/chat/query

Request:

```json
{
  "sessionId": "string",
  "message": "string",
  "filters": {
    "collectionIds": ["string"],
    "documentIds": ["string"],
    "tags": ["string"],
    "language": "pt-BR"
  },
  "options": {
    "topK": 20,
    "rerankTopN": 8,
    "maxCitations": 5,
    "temperature": 0.1
  }
}
```

Response:

```json
{
  "answer": "texto com citações [1][2]",
  "citations": [
    {
      "citationId": "1",
      "documentId": "doc-123",
      "documentTitle": "Política Comercial",
      "chunkId": "chk-99",
      "excerpt": "...",
      "sectionTitle": "Cancelamento",
      "pageNumber": 4,
      "sourceUri": "s3://bucket/doc.pdf"
    }
  ],
  "retrieval": {
    "denseHits": 30,
    "sparseHits": 30,
    "fusedHits": 20,
    "rerankedHits": 8
  },
  "limitations": [
    "Resposta baseada apenas no material recuperado."
  ],
  "traceId": "string"
}
```

### 15.2 API de ingestão

#### POST /api/v1/ingestion/documents/upload

* multipart file upload
* metadados obrigatórios: tenantId, collectionId, title

Response:

```json
{
  "jobId": "string",
  "documentId": "string",
  "status": "RECEIVED"
}
```

#### POST /api/v1/ingestion/documents/text

Request:

```json
{
  "tenantId": "string",
  "collectionId": "string",
  "title": "string",
  "text": "conteúdo bruto",
  "metadata": {
    "tags": ["manual", "faq"],
    "sourceType": "TEXT"
  },
  "acl": {
    "users": ["u1"],
    "groups": ["g1"]
  }
}
```

#### GET /api/v1/ingestion/jobs/{jobId}

#### POST /api/v1/ingestion/documents/{documentId}/reindex

#### DELETE /api/v1/ingestion/documents/{documentId}

### 15.3 API administrativa

* GET /api/v1/documents
* GET /api/v1/documents/{documentId}
* GET /api/v1/documents/{documentId}/chunks

---

## 16. Segurança e permissões

### Autenticação

* JWT/OAuth2

### Autorização

* RBAC + ACL por documento/chunk
* filtros de tenant obrigatórios em toda consulta

### Requisitos de segurança

* impedir enumeração entre tenants
* validar MIME type e tamanho de upload
* sanitizar nome de arquivo e metadados livres
* auditar quem subiu, consultou, reprocessou e excluiu
* criptografia em trânsito e em repouso
* mascaramento de logs sensíveis

### Regra de ouro

**Nenhum chunk pode entrar no prompt se o usuário não tiver permissão explícita para ele.**

---

## 17. Observabilidade

### Métricas mínimas

* tempo de parsing
* tempo de chunking
* tempo de embedding
* tempo de indexação
* tempo de dense retrieval
* tempo de sparse retrieval
* tempo de reranking
* tempo total de resposta
* tokens de entrada e saída
* taxa de respostas sem evidência suficiente
* taxa de citações inválidas

### Logs estruturados

* trace_id
* tenant_id
* session_id
* user_id
* query_hash
* filtros aplicados
* chunks recuperados
* chunks reranqueados
* chunks finais usados

---

## 18. Avaliação

### Objetivo

Medir separadamente:

1. qualidade de ingestão
2. qualidade de retrieval
3. qualidade de resposta final

### Dataset de avaliação

Criar um conjunto curado com:

* pergunta
* resposta esperada
* documentos/chunks relevantes
* filtros aplicáveis
* dificuldade

### Métricas de retrieval

* Recall@k
* Precision@k
* MRR
* nDCG

### Métricas de resposta

* groundedness
* citation accuracy
* answer relevance
* completeness
* refusal correctness quando falta evidência

### Estratégia

* avaliação offline em lote a cada mudança relevante
* smoke tests online em ambiente de homologação
* regressão obrigatória antes de trocar embeddings, chunking ou reranker

---

## 19. Requisitos não funcionais

### Performance inicial da POC

* p95 chat < 4s sem streaming, dependendo do modelo
* ingestão síncrona apenas para arquivos pequenos; preferir job assíncrono para arquivos maiores

### Confiabilidade

* idempotência em reprocessamento
* reindexação segura por versão
* deleção consistente entre metadados e índices

### Escalabilidade

* separar serviços de chat e ingestão
* filas para jobs de ingestão
* índices particionados por tenant/coleção quando necessário

---

## 20. Decisões de implementação sugeridas para a POC

### Escolha pragmática

Para simplificar a prova de conceito sem perder estrutura:

* **Spring Boot + LangChain4j**
* **PostgreSQL** para metadados
* **OpenSearch ou Elasticsearch** para híbrido (dense + BM25)
* **provider configurável** para LLM/embeddings/reranker

### Motivo

Isso reduz complexidade operacional e facilita testar busca híbrida, filtros e observabilidade com menos componentes.

---

## 21. Integração com LangChain4j

### Papel do LangChain4j no projeto

* abstração do modelo de chat
* abstração do embedding model
* construção do retriever e pipeline RAG
* composição com múltiplos retrievers
* injeção de conteúdo recuperado no prompt

### Ponto importante

A POC deve usar o LangChain4j como **orquestrador**, mas manter a lógica de negócio de ingestão, segurança, citações e avaliação em componentes próprios do projeto.

---

## 22. Critérios de aceite

### Ingestão

* documento enviado é persistido com metadados e ACL
* chunks são gerados com tamanho aceitável e rastreabilidade
* embeddings e índice lexical são criados

### Chat

* resposta usa apenas chunks autorizados
* resposta retorna citações válidas
* quando não houver evidência suficiente, sistema recusa corretamente
* filtros por coleção/documento/tags funcionam

### Qualidade

* busca híbrida supera busca vetorial isolada em benchmark interno da POC
* reranker melhora precision@k do contexto final

### Segurança

* usuário sem permissão não consegue recuperar nem citar conteúdo restrito

---

## 23. Roadmap sugerido

### Fase 1

* ingestão simples
* chunking recursivo
* embeddings
* busca vetorial básica
* chat com citações

### Fase 2

* busca híbrida
* reranker
* filtros completos
* ACL por documento/chunk

### Fase 3

* avaliação offline
* observabilidade avançada
* tuning de chunking, ranking e prompts

---

## 24. Riscos

* chunking ruim degradar recall
* embeddings inadequados para idioma/domínio
* híbrido mal calibrado aumentar ruído
* prompt mascarar falha de retrieval
* ACL aplicada tarde demais expor informação sensível

### Mitigação

* avaliação offline desde cedo
* logs detalhados do retrieval
* validação automática de citações
* testes de autorização em nível de chunk

---

## 25. Resumo executivo

Esta POC deve nascer com estrutura de produto real: ingestão robusta, chunking consistente, embeddings versionados, busca híbrida, reranking, filtros e ACLs fortes, respostas citadas, avaliação contínua e prompting disciplinado com contexto negativo. O objetivo não é apenas “fazer responder”, mas demonstrar um RAG confiável, auditável e pronto para evoluir.
