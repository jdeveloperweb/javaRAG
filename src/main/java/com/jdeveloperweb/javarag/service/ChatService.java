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

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ModelService modelService;
    private final RetrievalService retrievalService;
    private final AuditLogRepository auditLogRepository;
    private final ConversationService conversationService;
    private final com.jdeveloperweb.javarag.repository.ChatMessageRepository chatMessageRepository;

    public ChatResponse chat(String question, String provider, String tenantId, Long conversationId) {
        long startTime = System.currentTimeMillis();
        log.info("Chat request for tenant {}: {}", tenantId, question);

        // 1. Get models
        ChatLanguageModel chatModel = modelService.getChatModel(provider);

        // 2. Hybrid Retrieval
        log.info("🔍 [RETRIEVAL] Searching for context in database and vector store...");
        List<TextSegment> segments = retrievalService.retrieveHybrid(question, tenantId, 5);
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

        // 4. Construct Prompt (as defined in CLAUDE.md)
        String systemPrompt = """
                Você é um assistente de RAG corporativo.
                Responda APENAS com base no CONTEXTO AUTORIZADO fornecido.
                
                OBJETIVO:
                - fornecer resposta correta, objetiva e verificável
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
                - Ao final, inclua uma seção chamada "Base consultada" com os títulos dos documentos utilizados.
                """;

        String userPrompt = String.format("""
                PERGUNTA DO USUÁRIO:
                %s
                
                CONTEXTO AUTORIZADO:
                %s
                """, question, contextBuilder.toString());

        // 5. Call LLM
        log.info("🤖 [LLM] Sending prompt to {}...", provider);
        AiMessage aiMessage = chatModel.generate(
                new SystemMessage(systemPrompt),
                new UserMessage(userPrompt)
        ).content();
        log.info("✨ [LLM] Response received");

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

        // Save AI Message
        chatMessageRepository.save(com.jdeveloperweb.javarag.model.ChatMessage.builder()
                .conversation(conversation)
                .content(aiMessage.text())
                .role("ASSISTANT")
                .build());

        long duration = System.currentTimeMillis() - startTime;
        auditLogRepository.save(AuditLog.builder()
                .tenantId(tenantId)
                .userQuery(question)
                .aiResponse(aiMessage.text())
                .modelUsed(provider)
                .responseTimeMillis(duration)
                .build());
        
        log.info("📊 [STATS] Chat completed in {}ms", duration);

        return ChatResponse.builder()
                .answer(aiMessage.text())
                .modelUsed(provider)
                .conversationId(conversation.getId())
                .build();
    }

    @lombok.Data
    @lombok.Builder
    public static class ChatResponse {
        private String answer;
        private String modelUsed;
        private Long conversationId;
    }
}
