package com.jdeveloperweb.javarag.service;

import com.jdeveloperweb.javarag.model.AuditLog;
import com.jdeveloperweb.javarag.repository.AuditLogRepository;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ModelService modelService;
    private final RetrievalService retrievalService;
    private final AuditLogRepository auditLogRepository;
    private final ConversationService conversationService;
    private final com.jdeveloperweb.javarag.repository.ChatMessageRepository chatMessageRepository;
    private final TokenCostService tokenCostService;
    private final MetricsService metricsService;
    private final ValidationService validationService;

    public ChatResponse chat(String question, String provider, String tenantId, Long conversationId) {
        long startTime = System.currentTimeMillis();
        log.info("Chat request for tenant {}: {}", tenantId, question);

        // 1. Get models
        ChatLanguageModel chatModel = modelService.getChatModel(provider);

        // 2. Load History if exists
        List<com.jdeveloperweb.javarag.model.ChatMessage> dbHistory = new ArrayList<>();
        if (conversationId != null) {
            dbHistory = chatMessageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
            // Limit to last 10 messages to avoid token bloat
            if (dbHistory.size() > 10) {
                dbHistory = dbHistory.subList(dbHistory.size() - 10, dbHistory.size());
            }
        }

        // 3. Contextualize Question (Rewrite)
        String effectiveQuestion = question;
        if (!dbHistory.isEmpty()) {
            log.info("🔄 [REWRITE] Contextualizing question based on history...");
            effectiveQuestion = rewriteQuestion(question, dbHistory, chatModel);
            log.info("📝 [REWRITE] Standalone question: {}", effectiveQuestion);
        }

        // 4. Hybrid Retrieval using effective question
        log.info("🔍 [RETRIEVAL] Searching for context in database and vector store...");
        List<TextSegment> segments = retrievalService.retrieveHybrid(effectiveQuestion, tenantId, 10);
        log.info("✅ [RETRIEVAL] Found {} relevant segments", segments.size());

        if (segments.isEmpty()) {
            return ChatResponse.builder()
                    .answer("Não encontrei evidência suficiente no material recuperado para responder com segurança.")
                    .modelUsed(provider)
                    .build();
        }

        // 3. Construct context and citations
        StringBuilder contextBuilder = new StringBuilder();
        for (int i = 0; i < segments.size(); i++) {
            TextSegment segment = segments.get(i);
            contextBuilder.append(String.format("Citação [%d]: %s\nFonte: %s\n\n", 
                    i + 1, segment.text(), segment.metadata().getString("title")));
        }

        // 6. Construct Prompt (as defined in CLAUDE.md)
        String systemPrompt = """
                Você é um assistente de RAG corporativo focado em precisão e exaustão técnica.
                Responda APENAS com base no CONTEXTO AUTORIZADO fornecido.
                
                OBJETIVO:
                - fornecer resposta correta, objetiva e COMPLETAMENTE EXAUSTIVA (não omita dados presentes no contexto).
                - se o usuário perguntar por tabelas ou campos, liste TODOS que aparecerem no contexto relacionado.
                - citar as evidências utilizadas usando o formato [n]
                - indicar limitação quando faltarem dados
                
                NÃO FAÇA:
                - não invente
                - não complete lacunas com conhecimento externo
                - não cite fonte não presente no contexto
                
                POLÍTICA DE RESPOSTA:
                - Use apenas os fatos que aparecem no contexto.
                - Se houver evidência insuficiente, diga: "Não encontrei evidência suficiente no material recuperado para responder com segurança."
                - Sempre associe afirmações factuais a citações inline.
                
                FORMATO:
                - Resposta em português do Brasil.
                - Para dados estruturados (tabelas, campos, tipos), use o formato de TABELA.
                - REGRAS IMPORTANTES:
                    1. Pule DUAS LINHAS antes da tabela.
                    2. Use apenas UM '|' para separar colunas. NUNCA use '||' (mesmo que apareça assim no contexto).
                    3. A tabela deve ter cabeçalho e linha separadora (|---|).
                - Exemplo:
                
                | Campo | Tipo |
                |---|---|
                | ID | INT |
                
                - Ao final, inclua uma seção chamada "Base consultada" com os títulos dos documentos utilizados.
                """;

        String userPrompt = String.format("""
                PERGUNTA DO USUÁRIO:
                %s
                
                CONTEXTO AUTORIZADO:
                %s
                """, question, contextBuilder.toString());

        // 7. Initial Call
        log.info("🤖 [LLM] Sending prompt to {}...", provider);
        List<dev.langchain4j.data.message.ChatMessage> messages = new ArrayList<>();
        messages.add(new SystemMessage(systemPrompt));
        if (!dbHistory.isEmpty()) messages.addAll(mapToLangChainMessages(dbHistory));
        messages.add(new UserMessage(userPrompt));

        dev.langchain4j.model.output.Response<AiMessage> response = chatModel.generate(messages);
        AiMessage aiMessage = response.content();
        
        // 8. CRITIC VALIDATION
        ValidationService.ValidationResult validation = validationService.validate(question, aiMessage.text(), contextBuilder.toString(), provider);
        
        if (!validation.satisfactory()) {
            log.warn("⚠️ [CRITIC] Response flagged as incomplete: {}. Triggering exhaustive search...", validation.reason());
            
            // 9. Exhaustive Search
            List<TextSegment> moreSegments = retrievalService.retrieveExhaustive(effectiveQuestion, tenantId, 15, provider);
            
            // Merge segments (avoid duplicates)
            List<TextSegment> allSegments = new ArrayList<>(segments);
            Set<String> existingTexts = segments.stream().map(TextSegment::text).collect(Collectors.toSet());
            for (TextSegment s : moreSegments) {
                if (!existingTexts.contains(s.text())) {
                    allSegments.add(s);
                    existingTexts.add(s.text());
                }
            }
            segments = allSegments; // Update segments for citations later

            // Rebuild context
            StringBuilder expandedContext = new StringBuilder();
            for (int i = 0; i < allSegments.size(); i++) {
                TextSegment segment = allSegments.get(i);
                expandedContext.append(String.format("Citação [%d]: %s\nFonte: %s\n\n", 
                        i + 1, segment.text(), segment.metadata().getString("title")));
            }
            
            String expandedUserPrompt = String.format("""
                PERGUNTA DO USUÁRIO:
                %s
                
                CONTEXTO EXPANDIDO (Após busca exaustiva):
                %s
                
                Instrução do Auditor: A resposta anterior foi considerada incompleta (%s). 
                Por favor, forneça uma resposta completa e exaustiva usando todo o contexto disponível.
                """, question, expandedContext.toString(), validation.reason());
            
            messages.remove(messages.size() - 1);
            messages.add(new UserMessage(expandedUserPrompt));
            
            log.info("🤖 [LLM] Regenerating exhaustive response...");
            response = chatModel.generate(messages);
            aiMessage = response.content();
        }

        dev.langchain4j.model.output.TokenUsage usage = response.tokenUsage();
        log.info("✨ [LLM] Response received. Tokens: {}", usage);

        // 6. Persistence
        com.jdeveloperweb.javarag.model.Conversation conversation;
        if (conversationId == null) {
            String title = question.length() > 30 ? question.substring(0, 30) + "..." : question;
            conversation = conversationService.createConversation(title, tenantId);
        } else {
            conversation = conversationService.findById(conversationId).orElseGet(() -> 
                conversationService.createConversation(question.substring(0, Math.min(question.length(), 30)), tenantId)
            );
        }

        // Save User Message
        chatMessageRepository.save(com.jdeveloperweb.javarag.model.ChatMessage.builder()
                .conversation(conversation)
                .content(question)
                .role("USER")
                .build());

        // Build citations
        List<Citation> citations = segments.stream()
                .map(segment -> Citation.builder()
                        .source(segment.metadata().getString("title"))
                        .text(segment.text())
                        .documentId(Long.parseLong(segment.metadata().getString("documentId")))
                        .build())
                .collect(java.util.stream.Collectors.toList());

        // Serialize citations to JSON
        String citationsJson = null;
        try {
            citationsJson = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(citations);
        } catch (Exception e) {
            log.error("Failed to serialize citations", e);
        }

        // Save AI Message with citations
        chatMessageRepository.save(com.jdeveloperweb.javarag.model.ChatMessage.builder()
                .conversation(conversation)
                .content(aiMessage.text())
                .role("ASSISTANT")
                .citationsJson(citationsJson)
                .build());

        long duration = System.currentTimeMillis() - startTime;
        
        int pTokens = (usage != null) ? usage.inputTokenCount() : 0;
        int cTokens = (usage != null) ? usage.outputTokenCount() : 0;
        double cost = tokenCostService.calculateCost(provider, pTokens, cTokens);

        auditLogRepository.save(AuditLog.builder()
                .tenantId(tenantId)
                .userQuery(question)
                .aiResponse(aiMessage.text())
                .modelUsed(provider)
                .responseTimeMillis(duration)
                .promptTokens(pTokens)
                .completionTokens(cTokens)
                .totalTokens(pTokens + cTokens)
                .estimatedCost(cost)
                .build());
        
        metricsService.recordUsage(provider, pTokens, cTokens, cost);
        
        log.info("📊 [STATS] Chat completed in {}ms", duration);

        return ChatResponse.builder()
                .answer(aiMessage.text())
                .modelUsed(provider)
                .conversationId(conversation.getId())
                .citations(citations)
                .build();
    }

    private String rewriteQuestion(String question, List<com.jdeveloperweb.javarag.model.ChatMessage> history, ChatLanguageModel model) {
        if (history == null || history.isEmpty()) {
            return question;
        }

        StringBuilder historyBuilder = new StringBuilder();
        for (com.jdeveloperweb.javarag.model.ChatMessage msg : history) {
            historyBuilder.append(msg.getRole()).append(": ").append(msg.getContent()).append("\n");
        }

        String prompt = String.format("""
                Dada a seguinte conversa e uma pergunta de acompanhamento, reescreva a pergunta para que ela seja uma pergunta independente (standalone), mantendo o sentido original, mas incluindo o contexto necessário da conversa anterior.
                
                HISTÓRICO DA CONVERSA:
                %s
                
                PERGUNTA DE ACOMPANHAMENTO:
                %s
                
                REESCREVA APENAS A PERGUNTA (SEM EXPLICAÇÕES OU COMENTÁRIOS):
                """, historyBuilder.toString(), question);

        return model.generate(prompt);
    }

    private List<dev.langchain4j.data.message.ChatMessage> mapToLangChainMessages(List<com.jdeveloperweb.javarag.model.ChatMessage> history) {
        return history.stream().map(msg -> {
            if ("USER".equalsIgnoreCase(msg.getRole())) {
                return new UserMessage(msg.getContent());
            } else {
                return new AiMessage(msg.getContent());
            }
        }).collect(Collectors.toList());
    }

    @lombok.Data
    @lombok.Builder
    public static class Citation {
        private String source;
        private String text;
        private Long documentId;
    }

    @lombok.Data
    @lombok.Builder
    public static class ChatResponse {
        private String answer;
        private String modelUsed;
        private Long conversationId;
        private List<Citation> citations;
    }
}
