package com.jdeveloperweb.javarag.service;

import com.jdeveloperweb.javarag.model.AuditLog;
import com.jdeveloperweb.javarag.repository.AuditLogRepository;
import dev.langchain4j.data.segment.TextSegment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SpringAiChatService {

    private final ModelService modelService;
    private final RetrievalService retrievalService;
    private final AuditLogRepository auditLogRepository;
    private final ConversationService conversationService;
    private final com.jdeveloperweb.javarag.repository.ChatMessageRepository chatMessageRepository;
    private final TokenCostService tokenCostService;
    private final MetricsService metricsService;

    public ChatService.ChatResponse chat(String question, String provider, String tenantId, Long conversationId) {
        long startTime = System.currentTimeMillis();
        log.info("Spring AI Chat request for tenant {}: {}", tenantId, question);

        // 1. Get models
        ChatModel chatModel = modelService.getSpringAiChatModel(provider);

        // 2. Hybrid Retrieval
        List<TextSegment> segments = retrievalService.retrieveHybrid(question, tenantId, 5);

        if (segments.isEmpty()) {
            return ChatService.ChatResponse.builder()
                    .answer("Não encontrei evidência suficiente no material recuperado para responder com segurança.")
                    .modelUsed(provider + " (Spring AI)")
                    .build();
        }

        // 3. Construct context
        StringBuilder contextBuilder = new StringBuilder();
        for (int i = 0; i < segments.size(); i++) {
            TextSegment segment = segments.get(i);
            contextBuilder.append(String.format("Citação [%d]: %s\nFonte: %s\n\n", 
                    i + 1, segment.text(), segment.metadata().getString("title")));
        }

        // 4. Spring AI ChatClient
        ChatClient chatClient = ChatClient.builder(chatModel).build();

        String systemPrompt = """
                Você é um assistente de RAG corporativo usando Spring AI.
                Responda APENAS com base no CONTEXTO AUTORIZADO fornecido.
                
                OBJETIVO:
                - fornecer resposta correta, objetiva e verificável
                - citar as evidências utilizadas usando o formato [n]
                - indicar limitação quando faltarem dados
                
                POLÍTICA DE RESPOSTA:
                - Use apenas os fatos que aparecem no contexto.
                - Sempre associe afirmações factuais a citações inline.
                
                FORMATO:
                - Resposta em português do Brasil.
                - Ao final, inclua uma seção chamada "Base consultada" com os títulos dos documentos utilizados.
                """;

        org.springframework.ai.chat.model.ChatResponse response = chatClient.prompt()
                .system(systemPrompt)
                .user(u -> u.text("PERGUNTA: {question}\n\nCONTEXTO:\n{context}")
                        .param("question", question)
                        .param("context", contextBuilder.toString()))
                .call()
                .chatResponse();

        String answer = response.getResult().getOutput().getContent();
        org.springframework.ai.chat.metadata.Usage usage = response.getMetadata().getUsage();

        // 5. Persistence
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
        List<ChatService.Citation> citations = segments.stream()
                .map(segment -> ChatService.Citation.builder()
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
                .content(answer)
                .role("ASSISTANT")
                .citationsJson(citationsJson)
                .build());

        long duration = System.currentTimeMillis() - startTime;
        int pTokens = (usage != null && usage.getPromptTokens() != null) ? usage.getPromptTokens().intValue() : 0;
        int cTokens = (usage != null && usage.getGenerationTokens() != null) ? usage.getGenerationTokens().intValue() : 0;
        double cost = tokenCostService.calculateCost(provider, pTokens, cTokens);

        // 6. Audit Log
        auditLogRepository.save(AuditLog.builder()
                .tenantId(tenantId)
                .userQuery(question)
                .aiResponse(answer)
                .modelUsed(provider + " (Spring AI)")
                .responseTimeMillis(duration)
                .promptTokens(pTokens)
                .completionTokens(cTokens)
                .totalTokens(pTokens + cTokens)
                .estimatedCost(cost)
                .build());

        metricsService.recordUsage(provider, pTokens, cTokens, cost);

        return ChatService.ChatResponse.builder()
                .answer(answer)
                .modelUsed(provider + " (Spring AI)")
                .conversationId(conversation.getId())
                .citations(citations)
                .build();
    }
}
